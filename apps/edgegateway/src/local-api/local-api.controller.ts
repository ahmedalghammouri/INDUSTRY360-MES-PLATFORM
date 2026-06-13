import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../services/mqtt.service';
import { InfluxService } from '../services/influx.service';
import { GatewayContextService } from '../context/gateway-context.service';
import { ModbusPollerService } from '../acquisition/modbus-poller.service';
import { BufferService } from '../acquisition/buffer.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * REST API consumed by the gateway's embedded dashboard. `/api/auth/login` is
 * public; everything else requires a shared-JWT Bearer token.
 */
@Controller('api')
export class LocalApiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttService,
    private readonly influx: InfluxService,
    private readonly ctx: GatewayContextService,
    private readonly poller: ModbusPollerService,
    private readonly buffer: BufferService,
    private readonly auth: AuthService,
  ) {}

  @Post('auth/login')
  login(@Body() body: { email?: string; password?: string }) {
    if (!body?.email || !body?.password) throw new BadRequestException('email and password required');
    return this.auth.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status() {
    let dbOk = true;
    try { await this.prisma.$queryRaw`SELECT 1`; } catch { dbOk = false; }
    return {
      gatewayId: this.ctx.getGatewayId(),
      factoryId: this.ctx.getFactoryId(),
      ready: this.ctx.isReady(),
      sinks: { db: dbOk, mqtt: this.mqtt.isConnected(), influx: this.influx.isEnabled() },
      devices: this.poller.status(),
      buffers: {
        pgTagValue: this.buffer.size('pg-tagvalue'),
        influx: this.buffer.size('influx'),
        mqtt: this.buffer.size('mqtt'),
      },
    };
  }

  // ── Devices ──────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('devices')
  async devices() {
    const gatewayId = this.ctx.getGatewayId();
    return this.prisma.device.findMany({
      where: { ...(gatewayId ? { gatewayId } : {}), isActive: true },
      include: { machine: { select: { id: true, code: true, name: true } }, tagDefinitions: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('devices')
  async createDevice(@Body() b: any) {
    if (!b?.name || !b?.deviceCode) throw new BadRequestException('name and deviceCode required');
    const factoryId = this.ctx.getFactoryId();
    if (!factoryId) throw new BadRequestException('Gateway not bound to a factory yet');
    return this.prisma.device.create({
      data: {
        factoryId,
        gatewayId: this.ctx.getGatewayId(),
        name: b.name,
        deviceCode: b.deviceCode,
        type: b.type ?? 'PLC',
        protocol: 'MODBUS',
        ipAddress: b.ipAddress ?? null,
        port: b.port ?? 502,
        unitId: b.unitId ?? 1,
        pollIntervalMs: b.pollIntervalMs ?? null,
        machineId: b.machineId ?? null,
        status: 'DISCONNECTED',
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('devices/:id')
  updateDevice(@Param('id') id: string, @Body() b: any) {
    return this.prisma.device.update({
      where: { id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.ipAddress !== undefined && { ipAddress: b.ipAddress }),
        ...(b.port !== undefined && { port: b.port }),
        ...(b.unitId !== undefined && { unitId: b.unitId }),
        ...(b.pollIntervalMs !== undefined && { pollIntervalMs: b.pollIntervalMs }),
        ...(b.machineId !== undefined && { machineId: b.machineId }),
        ...(b.isActive !== undefined && { isActive: b.isActive }),
      },
    });
  }

  // ── Tags ─────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('tags')
  tags(@Query('deviceId') deviceId?: string) {
    const factoryId = this.ctx.getFactoryId();
    return this.prisma.tagDefinition.findMany({
      where: { ...(factoryId ? { factoryId } : {}), ...(deviceId ? { deviceId } : {}), isActive: true },
      include: { currentValue: true, machine: { select: { code: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('tags')
  async createTag(@Body() b: any) {
    if (!b?.code || !b?.name) throw new BadRequestException('code and name required');
    const factoryId = this.ctx.getFactoryId();
    if (!factoryId) throw new BadRequestException('Gateway not bound to a factory yet');
    return this.prisma.tagDefinition.create({
      data: {
        factoryId,
        code: b.code,
        name: b.name,
        dataType: b.dataType ?? 'INT',
        tagType: b.tagType ?? 'MEASUREMENT',
        unit: b.unit ?? null,
        deviceId: b.deviceId ?? null,
        machineId: b.machineId ?? null,
        address: b.address ?? null,
        registerType: b.registerType ?? 'HOLDING',
        wordCount: b.wordCount ?? 1,
        wordOrder: b.wordOrder ?? 'BIG',
        scaleFactor: b.scaleFactor ?? null,
        offset: b.offset ?? null,
        counterRole: b.counterRole ?? null,
        edgeType: b.edgeType ?? 'RISING',
        pollIntervalMs: b.pollIntervalMs ?? null,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('tags/:id')
  updateTag(@Param('id') id: string, @Body() b: any) {
    const allowed = [
      'name', 'unit', 'dataType', 'tagType', 'machineId', 'deviceId', 'address', 'registerType',
      'wordCount', 'wordOrder', 'scaleFactor', 'offset', 'counterRole', 'edgeType', 'pollIntervalMs', 'isActive',
    ];
    const data: Record<string, unknown> = {};
    for (const k of allowed) if (b[k] !== undefined) data[k] = b[k];
    return this.prisma.tagDefinition.update({ where: { id }, data });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('tags/:id')
  async deleteTag(@Param('id') id: string) {
    await this.prisma.tagDefinition.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  // ── Live values & job orders (for monitoring + counter mapping) ──
  @UseGuards(JwtAuthGuard)
  @Get('live')
  async live() {
    const factoryId = this.ctx.getFactoryId();
    return this.prisma.tagCurrentValue.findMany({
      where: factoryId ? { factoryId } : {},
      include: { tag: { select: { code: true, name: true, unit: true, tagType: true, counterRole: true } } },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('job-orders')
  async jobOrders() {
    const factoryId = this.ctx.getFactoryId();
    return this.prisma.jobOrder.findMany({
      where: { ...(factoryId ? { factoryId } : {}), status: 'EXECUTING' },
      select: {
        id: true, operationName: true, machineId: true,
        actualQtyGood: true, actualQtyRejected: true,
        machine: { select: { code: true, name: true } },
        workOrder: { select: { orderNumber: true } },
      },
      orderBy: { actualStart: 'desc' },
      take: 100,
    });
  }
}
