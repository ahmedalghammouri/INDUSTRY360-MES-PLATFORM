import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import {
  ModbusTcpClient, type RegisterType, type ModbusDataType, type EdgeType, type TagBinding,
} from '@star-mes/industrial-drivers';

import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../services/mqtt.service';
import { GatewayContextService } from '../context/gateway-context.service';
import { IngestService, type TagReadingRecord } from './ingest.service';
import { CounterService, type CounterTag } from './counter.service';

interface PolledTag {
  binding: TagBinding;
  tagId: string;
  code: string;
  factoryId: string;
  machineId: string | null;
  machineCode: string | null;
  isCounter: boolean;
  counterTag: CounterTag;
}

interface DeviceRuntime {
  id: string;
  name: string;
  client: ModbusTcpClient;
  tags: PolledTag[];
  intervalMs: number;
  timer: NodeJS.Timeout | null;
  busy: boolean;
  signature: string; // detects config changes to trigger rebuild
}

/**
 * Owns one Modbus connection per device assigned to this gateway, polls every
 * bound tag on its interval, and fans readings to the counter + ingest layers.
 * Reloads device/tag config periodically so online edits apply without restart.
 */
@Injectable()
export class ModbusPollerService implements OnModuleDestroy {
  private readonly logger = new Logger(ModbusPollerService.name);
  private readonly devices = new Map<string, DeviceRuntime>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttService,
    private readonly ingest: IngestService,
    private readonly counter: CounterService,
    private readonly ctx: GatewayContextService,
    private readonly config: ConfigService,
  ) {}

  onModuleDestroy() {
    for (const d of this.devices.values()) {
      if (d.timer) clearInterval(d.timer);
      void d.client.disconnect();
    }
  }

  /** Reconcile runtime against DB config every 10s (also the first load). */
  @Interval('poller-reload', 10_000)
  async reload() {
    const gatewayId = this.ctx.getGatewayId();
    if (!gatewayId) return;

    let configured;
    try {
      configured = await this.prisma.device.findMany({
        where: { gatewayId, protocol: 'MODBUS', isActive: true },
        include: {
          machine: { select: { id: true, code: true } },
          tagDefinitions: {
            where: { isActive: true, address: { not: null } },
            include: { machine: { select: { id: true, code: true } } },
          },
        },
      });
    } catch (err) {
      this.logger.debug(`Device reload failed: ${(err as Error).message}`);
      return;
    }

    const seen = new Set<string>();
    const defaultInterval = this.config.get<number>('defaultPollIntervalMs') ?? 1000;

    for (const dev of configured) {
      seen.add(dev.id);
      const signature = JSON.stringify({
        ip: dev.ipAddress, port: dev.port, unit: dev.unitId, poll: dev.pollIntervalMs,
        tags: dev.tagDefinitions.map((t) => [t.id, t.address, t.registerType, t.dataType, t.scaleFactor, t.offset, t.wordCount, t.wordOrder, t.counterRole, t.edgeType, t.machineId]),
      });
      const existing = this.devices.get(dev.id);
      if (existing && existing.signature === signature) continue; // unchanged

      // (Re)build this device's runtime.
      if (existing) {
        if (existing.timer) clearInterval(existing.timer);
        await existing.client.disconnect().catch(() => undefined);
      }

      const client = new ModbusTcpClient({
        host: dev.ipAddress ?? '127.0.0.1',
        port: dev.port ?? 502,
        unitId: dev.unitId ?? 1,
        timeoutMs: 3000,
      });

      const tags: PolledTag[] = dev.tagDefinitions.map((t) => {
        const binding: TagBinding = {
          id: t.id,
          code: t.code,
          address: parseInt(String(t.address), 10) || 0,
          registerType: (t.registerType as RegisterType) ?? 'HOLDING',
          dataType: t.dataType as ModbusDataType,
          wordCount: t.wordCount ?? 1,
          wordOrder: (t.wordOrder as 'BIG' | 'LITTLE') ?? 'BIG',
          scaleFactor: t.scaleFactor,
          offset: t.offset,
          counterRole: t.counterRole as any,
          edgeType: (t.edgeType as EdgeType) ?? 'RISING',
        };
        return {
          binding,
          tagId: t.id,
          code: t.code,
          factoryId: t.factoryId,
          machineId: t.machineId ?? dev.machineId ?? null,
          machineCode: t.machine?.code ?? dev.machine?.code ?? null,
          isCounter: t.tagType === 'COUNTER' && !!t.counterRole && t.counterRole !== 'NONE',
          counterTag: {
            id: t.id,
            machineId: t.machineId ?? dev.machineId ?? null,
            factoryId: t.factoryId,
            counterRole: t.counterRole as any,
            edgeType: (t.edgeType as EdgeType) ?? 'RISING',
          },
        };
      });

      const runtime: DeviceRuntime = {
        id: dev.id,
        name: dev.name,
        client,
        tags,
        intervalMs: dev.pollIntervalMs ?? defaultInterval,
        timer: null,
        busy: false,
        signature,
      };
      runtime.timer = setInterval(() => void this.pollDevice(runtime), runtime.intervalMs);
      this.devices.set(dev.id, runtime);
      this.logger.log(`Device "${dev.name}" loaded: ${tags.length} tag(s) @ ${runtime.intervalMs}ms`);
    }

    // Drop devices no longer assigned to this gateway.
    for (const [id, d] of this.devices) {
      if (seen.has(id)) continue;
      if (d.timer) clearInterval(d.timer);
      await d.client.disconnect().catch(() => undefined);
      this.devices.delete(id);
    }
  }

  private async pollDevice(dev: DeviceRuntime) {
    if (dev.busy) return; // skip if previous cycle still running
    dev.busy = true;
    let anyError = false;
    try {
      for (const tag of dev.tags) {
        const res = await dev.client.readTag(tag.binding);
        const ts = res.timestamp.toISOString();

        if (res.quality !== 'GOOD') { anyError = true; continue; }

        const numeric =
          typeof res.value === 'number' ? res.value
          : typeof res.value === 'boolean' ? (res.value ? 1 : 0)
          : null;

        const record: TagReadingRecord = {
          tagId: tag.tagId,
          factoryId: tag.factoryId,
          code: tag.code,
          machineId: tag.machineId,
          machineCode: tag.machineCode,
          deviceId: dev.id,
          value: String(res.value ?? ''),
          numeric,
          quality: res.quality,
          timestamp: ts,
        };
        await this.ingest.ingest(record);

        if (tag.isCounter) {
          const event = await this.counter.process(tag.counterTag, res.raw, ts);
          if (event) {
            this.mqtt.publish(`star-mes/${tag.factoryId}/jo/${event.jobOrderId}/count`, event);
          }
        }
      }
      await this.markDevice(dev.id, anyError ? 'ERROR' : 'CONNECTED', anyError ? 'One or more tag reads failed' : null);
    } catch (err) {
      await this.markDevice(dev.id, 'ERROR', (err as Error).message);
    } finally {
      dev.busy = false;
    }
  }

  private async markDevice(id: string, status: string, lastError: string | null) {
    await this.prisma.device
      .update({ where: { id }, data: { status, lastSeenAt: new Date(), lastError } })
      .catch(() => undefined);
  }

  /** Drain disk buffers periodically when sinks recover. */
  @Interval('buffer-drain', 20_000)
  async drain() {
    await this.ingest.drainBuffers().catch(() => undefined);
  }

  /** Snapshot for the local dashboard. */
  status() {
    return Array.from(this.devices.values()).map((d) => ({
      id: d.id,
      name: d.name,
      connected: d.client.isConnected(),
      tagCount: d.tags.length,
      intervalMs: d.intervalMs,
    }));
  }
}
