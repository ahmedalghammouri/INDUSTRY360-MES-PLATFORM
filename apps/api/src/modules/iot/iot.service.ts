import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';

export interface TelemetryDto {
  machineId: string;
  state?: string;           // MachineState enum value
  actualSpeed?: number;     // units/hour
  goodCount?: number;
  rejectCount?: number;
  runtimeDelta?: number;    // minutes of runtime to add since last call
  tagValues?: Array<{ tagCode: string; value: string; quality?: string }>;
}

@Injectable()
export class IotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async ingestTelemetry(factoryId: string | null, dto: TelemetryDto) {
    const machine = await this.prisma.machine.findFirst({
      where: {
        id: dto.machineId,
        ...(factoryId ? { factoryId } : {}),
        isActive: true,
      },
      select: { id: true, name: true, code: true, factoryId: true },
    });
    if (!machine) throw new NotFoundException(`Machine ${dto.machineId} not found`);

    const previous = await this.prisma.machineCurrentStatus.findUnique({
      where: { machineId: dto.machineId },
      select: { state: true, goodCount: true, rejectCount: true },
    });

    const now = new Date();
    const updateData: Record<string, unknown> = { lastEventAt: now };
    if (dto.state !== undefined) updateData.state = dto.state;
    if (dto.actualSpeed !== undefined) updateData.actualSpeed = dto.actualSpeed;
    if (dto.goodCount !== undefined) updateData.goodCount = dto.goodCount;
    if (dto.rejectCount !== undefined) updateData.rejectCount = dto.rejectCount;
    if (dto.runtimeDelta !== undefined) updateData.runtimeMinutes = { increment: dto.runtimeDelta };

    const status = await this.prisma.machineCurrentStatus.upsert({
      where: { machineId: dto.machineId },
      create: {
        machineId: dto.machineId,
        state: (dto.state as any) ?? 'OFFLINE',
        actualSpeed: dto.actualSpeed,
        goodCount: dto.goodCount ?? 0,
        rejectCount: dto.rejectCount ?? 0,
        lastEventAt: now,
      },
      update: updateData,
    });

    // Bulk-resolve and update tag current values
    if (dto.tagValues?.length) {
      const tagCodes = dto.tagValues.map((t) => t.tagCode);
      const tags = await this.prisma.tagDefinition.findMany({
        where: { machineId: dto.machineId, code: { in: tagCodes }, isActive: true },
        select: { id: true, code: true },
      });
      const tagMap = new Map(tags.map((t) => [t.code, t.id]));

      await Promise.all(
        dto.tagValues.map((tv) => {
          const tagId = tagMap.get(tv.tagCode);
          if (!tagId) return;
          return this.prisma.tagCurrentValue.upsert({
            where: { tagId },
            create: {
              tagId,
              factoryId: machine.factoryId,
              value: tv.value,
              quality: (tv.quality as any) ?? 'GOOD',
              timestamp: now,
            },
            update: {
              value: tv.value,
              quality: (tv.quality as any) ?? 'GOOD',
              timestamp: now,
            },
          });
        }),
      );
    }

    // Broadcast live telemetry to dashboard clients
    this.eventEmitter.emit('iot.machine.telemetry', {
      machineId: machine.id,
      machineName: machine.name,
      machineCode: machine.code,
      factoryId: machine.factoryId,
      state: status.state,
      actualSpeed: status.actualSpeed,
      goodCount: status.goodCount,
      rejectCount: status.rejectCount,
      timestamp: now.toISOString(),
    });

    // Emit state-change event for downtime auto-detection
    if (dto.state && dto.state !== previous?.state) {
      this.eventEmitter.emit('machine.state.changed', {
        machineId: machine.id,
        machineName: machine.name,
        factoryId: machine.factoryId,
        previousState: previous?.state ?? 'OFFLINE',
        newState: dto.state,
        timestamp: now.toISOString(),
      });
    }

    return {
      machineId: machine.id,
      machineName: machine.name,
      state: status.state,
      timestamp: now.toISOString(),
    };
  }

  async getDevices(factoryId: string | null, filters: { status?: string }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    return this.prisma.device.findMany({
      where: {
        ...factoryFilter,
        ...(filters.status && { status: filters.status }),
        isActive: true,
      },
      include: { machine: { select: { name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getDeviceStatus(deviceId: string) {
    return this.prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        machine: { select: { name: true, code: true } },
        tagDefinitions: {
          where: { isActive: true },
          include: { currentValue: true },
          orderBy: { name: 'asc' },
          take: 50,
        },
      },
    });
  }

  async connectDevice(factoryId: string | null, deviceId: string) {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { status: 'CONNECTED', lastSeenAt: new Date() },
    });
    return { status: 'CONNECTED', timestamp: new Date() };
  }

  async getTags(factoryId: string | null, filters: { deviceId?: string; machineId?: string }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    return this.prisma.tagDefinition.findMany({
      where: {
        ...factoryFilter,
        ...(filters.deviceId && { deviceId: filters.deviceId }),
        ...(filters.machineId && { machineId: filters.machineId }),
        isActive: true,
      },
      include: { currentValue: true },
      orderBy: { name: 'asc' },
    });
  }

  async getMachineStates(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const machines = await this.prisma.machine.findMany({
      where: { ...factoryFilter, isActive: true },
      include: {
        currentStatus: true,
        workOrders: {
          where: { status: 'IN_PROGRESS' },
          select: { orderNumber: true, skuId: true },
          take: 1,
        },
      },
      orderBy: { code: 'asc' },
    });
    return machines.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      state: m.currentStatus?.state ?? 'OFFLINE',
      actualSpeed: m.currentStatus?.actualSpeed ?? 0,
      goodCount: m.currentStatus?.goodCount ?? 0,
      rejectCount: m.currentStatus?.rejectCount ?? 0,
      oee: m.currentStatus?.oee ?? 0,
      lastEventAt: m.currentStatus?.lastEventAt?.toISOString(),
      activeWorkOrder: m.workOrders[0]?.orderNumber ?? null,
    }));
  }

  async recordTagValue(tagId: string, value: string, quality: string): Promise<void> {
    const tag = await this.prisma.tagDefinition.findUnique({
      where: { id: tagId },
      select: { factoryId: true },
    });
    if (!tag) return;
    await this.prisma.tagCurrentValue.upsert({
      where: { tagId },
      create: {
        tagId,
        factoryId: tag.factoryId,
        value,
        quality: quality as 'GOOD' | 'BAD' | 'UNCERTAIN' | 'NOT_CONNECTED',
        timestamp: new Date(),
      },
      update: {
        value,
        quality: quality as 'GOOD' | 'BAD' | 'UNCERTAIN' | 'NOT_CONNECTED',
        timestamp: new Date(),
      },
    });
  }

  // ────────────────────────────────────────────────────────────
  // DEVICE CRUD
  // ────────────────────────────────────────────────────────────

  async getDeviceKPIs(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const [total, connected, disconnected, errored] = await Promise.all([
      this.prisma.device.count({ where: { ...factoryFilter, isActive: true } }),
      this.prisma.device.count({ where: { ...factoryFilter, status: 'CONNECTED', isActive: true } }),
      this.prisma.device.count({ where: { ...factoryFilter, status: 'DISCONNECTED', isActive: true } }),
      this.prisma.device.count({ where: { ...factoryFilter, status: 'ERROR', isActive: true } }),
    ]);
    return { total, connected, disconnected, errored };
  }

  async createDevice(factoryId: string | null, dto: {
    name: string; deviceCode: string; type: string; protocol: string;
    ipAddress?: string; port?: number; machineId?: string; firmware?: string;
  }) {
    const resolvedFactoryId = factoryId ?? await this.getDefaultFactoryId();
    return this.prisma.device.create({
      data: {
        factoryId: resolvedFactoryId,
        name: dto.name,
        deviceCode: dto.deviceCode,
        type: dto.type,
        protocol: dto.protocol,
        ipAddress: dto.ipAddress,
        port: dto.port,
        machineId: dto.machineId || null,
        firmware: dto.firmware,
        status: 'DISCONNECTED',
        isActive: true,
      },
    });
  }

  async updateDevice(factoryId: string | null, id: string, dto: {
    name?: string; type?: string; protocol?: string; ipAddress?: string;
    port?: number; firmware?: string; isActive?: boolean;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const device = await this.prisma.device.findFirst({ where: { id, ...factoryFilter } });
    if (!device) throw new NotFoundException('Device not found');
    return this.prisma.device.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.protocol && { protocol: dto.protocol }),
        ...(dto.ipAddress !== undefined && { ipAddress: dto.ipAddress }),
        ...(dto.port !== undefined && { port: dto.port }),
        ...(dto.firmware !== undefined && { firmware: dto.firmware }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteDevice(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const device = await this.prisma.device.findFirst({ where: { id, ...factoryFilter } });
    if (!device) throw new NotFoundException('Device not found');
    await this.prisma.device.update({ where: { id }, data: { isActive: false } });
  }

  // ────────────────────────────────────────────────────────────
  // TAG CRUD
  // ────────────────────────────────────────────────────────────

  async createTag(factoryId: string | null, dto: {
    code: string; name: string; dataType: string; tagType?: string; unit?: string;
    deviceId?: string; machineId?: string; description?: string;
    minValue?: number; maxValue?: number;
  }) {
    const resolvedFactoryId = factoryId ?? await this.getDefaultFactoryId();
    return this.prisma.tagDefinition.create({
      data: {
        factoryId: resolvedFactoryId,
        code: dto.code,
        name: dto.name,
        dataType: dto.dataType as any,
        tagType: (dto.tagType as any) ?? 'MEASUREMENT',
        unit: dto.unit,
        deviceId: dto.deviceId || null,
        machineId: dto.machineId || null,
        description: dto.description,
        minValue: dto.minValue,
        maxValue: dto.maxValue,
        isActive: true,
      },
    });
  }

  async updateTag(factoryId: string | null, id: string, dto: {
    name?: string; unit?: string; description?: string;
    minValue?: number; maxValue?: number; isActive?: boolean;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const tag = await this.prisma.tagDefinition.findFirst({ where: { id, ...factoryFilter } });
    if (!tag) throw new NotFoundException('Tag not found');
    return this.prisma.tagDefinition.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.minValue !== undefined && { minValue: dto.minValue }),
        ...(dto.maxValue !== undefined && { maxValue: dto.maxValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteTag(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const tag = await this.prisma.tagDefinition.findFirst({ where: { id, ...factoryFilter } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.tagDefinition.update({ where: { id }, data: { isActive: false } });
  }

  private async getDefaultFactoryId(): Promise<string> {
    const factory = await this.prisma.factory.findFirst({ where: { isActive: true } });
    if (!factory) throw new NotFoundException('No active factory found');
    return factory.id;
  }
}
