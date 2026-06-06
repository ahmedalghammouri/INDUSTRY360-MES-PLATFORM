import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma, DowntimeCategory } from '@prisma/client';
import type {
  CreateDowntimeEventDto, UpdateDowntimeEventDto, EndDowntimeEventDto,
} from './dto/downtime.dto';

// NCC requirement: 1 minute (60 seconds) before classifying as downtime
const DOWNTIME_THRESHOLD_SECONDS = 60;

@Injectable()
export class DowntimeService {
  private readonly logger = new Logger(DowntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ────────────────────────────────────────────────────────────
  // DOWNTIME EVENTS
  // ────────────────────────────────────────────────────────────

  async createDowntimeEvent(factoryId: string | null, userId: string, dto: CreateDowntimeEventDto) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const machine = await this.prisma.machine.findFirst({
      where: { id: dto.machineId, ...factoryFilter },
    });
    if (!machine) throw new NotFoundException('Machine not found');

    // Check for existing open downtime on this machine
    const existing = await this.prisma.downtimeEvent.findFirst({
      where: { machineId: dto.machineId, endTime: null },
    });
    if (existing) {
      throw new BadRequestException(
        `Machine already has an open downtime event (started ${existing.startTime.toISOString()}). End it before creating a new one.`,
      );
    }

    const resolvedFactoryId = factoryId ?? machine.factoryId;
    const startTime = new Date(dto.startTime);
    const endTime = dto.endTime ? new Date(dto.endTime) : undefined;
    const durationMinutes = endTime
      ? (endTime.getTime() - startTime.getTime()) / 60_000
      : undefined;

    const event = await this.prisma.downtimeEvent.create({
      data: {
        factoryId: resolvedFactoryId,
        machineId: dto.machineId,
        workOrderId: dto.workOrderId,
        causeId: dto.causeId,
        reason: dto.reason,
        category: dto.category as DowntimeCategory,
        startTime,
        endTime,
        durationMinutes,
        isPlanned: dto.isPlanned ?? false,
        reportedById: userId,
        notes: dto.notes,
      },
      include: {
        machine: { select: { name: true, code: true } },
        cause: { select: { code: true, name: true, category: true } },
      },
    });

    // Update machine state to BREAKDOWN or PLANNED_STOP
    await this.updateMachineStateForDowntime(dto.machineId, dto.isPlanned ?? false);

    this.eventEmitter.emit('downtime.event.created', {
      event,
      factoryId: resolvedFactoryId,
      machineName: machine.name,
    });

    this.logger.log(`Downtime event created for machine ${machine.code}: ${dto.category}`);
    return event;
  }

  async endDowntimeEvent(factoryId: string | null, eventId: string, userId: string, dto: EndDowntimeEventDto) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const event = await this.prisma.downtimeEvent.findFirst({
      where: { id: eventId, ...factoryFilter },
      include: { machine: { select: { name: true, code: true, lineId: true } } },
    });
    if (!event) throw new NotFoundException('Downtime event not found');
    if (event.endTime) throw new BadRequestException('Downtime event already ended');

    const endTime = new Date(dto.endTime);
    if (endTime <= event.startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const durationMinutes = (endTime.getTime() - event.startTime.getTime()) / 60_000;

    const updated = await this.prisma.downtimeEvent.update({
      where: { id: eventId },
      data: {
        endTime,
        durationMinutes,
        ...(dto.causeId && { causeId: dto.causeId }),
        ...(dto.resolution && { notes: dto.resolution }),
      },
      include: {
        machine: { select: { name: true, code: true } },
        cause: { select: { code: true, name: true } },
      },
    });

    // Restore machine state based on active WO
    const activeWO = await this.prisma.workOrder.findFirst({
      where: { machineId: event.machineId, status: 'IN_PROGRESS' },
    });

    await this.prisma.machineCurrentStatus.upsert({
      where: { machineId: event.machineId },
      create: {
        machineId: event.machineId,
        state: activeWO ? 'RUNNING' : 'IDLE',
        currentWOId: activeWO?.id ?? null,
      },
      update: {
        state: activeWO ? 'RUNNING' : 'IDLE',
        lastEventAt: new Date(),
      },
    });

    // Update work order's downtime total
    if (event.workOrderId) {
      await this.prisma.workOrder.update({
        where: { id: event.workOrderId },
        data: { downtimeMinutes: { increment: durationMinutes } },
      });
    }

    this.eventEmitter.emit('downtime.event.ended', {
      eventId,
      machineId: event.machineId,
      factoryId: event.factoryId,
      durationMinutes,
    });

    this.logger.log(`Downtime ended for machine ${event.machine.code}: ${durationMinutes.toFixed(1)} min`);
    return updated;
  }

  async acknowledgeDowntimeEvent(factoryId: string | null, eventId: string, userId: string, notes?: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const event = await this.prisma.downtimeEvent.findFirst({
      where: { id: eventId, ...factoryFilter },
    });
    if (!event) throw new NotFoundException('Downtime event not found');

    return this.prisma.downtimeEvent.update({
      where: { id: eventId },
      data: {
        acknowledged: true,
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
        ...(notes && { notes }),
      },
    });
  }

  async updateDowntimeEvent(factoryId: string | null, eventId: string, dto: UpdateDowntimeEventDto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const event = await this.prisma.downtimeEvent.findFirst({
      where: { id: eventId, ...factoryFilter },
    });
    if (!event) throw new NotFoundException('Downtime event not found');

    const endTime = dto.endTime ? new Date(dto.endTime) : undefined;
    const durationMinutes = endTime
      ? (endTime.getTime() - event.startTime.getTime()) / 60_000
      : undefined;

    return this.prisma.downtimeEvent.update({
      where: { id: eventId },
      data: {
        ...(dto.causeId !== undefined && { causeId: dto.causeId }),
        ...(dto.reason !== undefined && { reason: dto.reason }),
        ...(dto.category && { category: dto.category as DowntimeCategory }),
        ...(endTime && { endTime, durationMinutes }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        machine: { select: { name: true, code: true } },
        cause: { select: { code: true, name: true } },
      },
    });
  }

  async findDowntimeEvents(factoryId: string | null, filters: {
    machineId?: string;
    workOrderId?: string;
    isPlanned?: boolean;
    isOpen?: boolean;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { machineId, workOrderId, isPlanned, isOpen, dateFrom, dateTo, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.DowntimeEventWhereInput = {
      ...factoryFilter,
      ...(machineId && { machineId }),
      ...(workOrderId && { workOrderId }),
      ...(isPlanned !== undefined && { isPlanned }),
      ...(isOpen === true && { endTime: null }),
      ...(isOpen === false && { endTime: { not: null } }),
      ...(dateFrom && { startTime: { gte: new Date(dateFrom) } }),
      ...(dateTo && { startTime: { lte: new Date(dateTo) } }),
    };

    const [total, data] = await Promise.all([
      this.prisma.downtimeEvent.count({ where }),
      this.prisma.downtimeEvent.findMany({
        where,
        include: {
          machine: { select: { name: true, code: true } },
          cause: { select: { code: true, name: true, category: true } },
        },
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((e) => ({
        id: e.id,
        machine: e.machine.name,
        machineCode: e.machine.code,
        cause: e.cause?.name ?? null,
        causeCode: e.cause?.code ?? null,
        category: e.category,
        reason: e.reason,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime?.toISOString() ?? null,
        durationMinutes: e.durationMinutes,
        isPlanned: e.isPlanned,
        isOpen: !e.endTime,
        acknowledged: e.acknowledged,
        notes: e.notes,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ────────────────────────────────────────────────────────────
  // DOWNTIME CAUSES (reference data)
  // ────────────────────────────────────────────────────────────

  async findDowntimeCauses(factoryId: string | null, machineId?: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    return this.prisma.downtimeCause.findMany({
      where: {
        ...factoryFilter,
        isActive: true,
        OR: [{ machineId: machineId ?? null }, { machineId: null }],
      },
      orderBy: [{ isPlanned: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // ────────────────────────────────────────────────────────────
  // AUTOMATIC DOWNTIME DETECTION (called by machine state monitor)
  // Checks machines that have been IDLE > DOWNTIME_THRESHOLD_SECONDS
  // ────────────────────────────────────────────────────────────

  async detectAndCreateAutoDowntime(factoryId: string) {
    const thresholdMs = DOWNTIME_THRESHOLD_SECONDS * 1000;
    const cutoff = new Date(Date.now() - thresholdMs);

    // Find machines in IDLE state that transitioned before cutoff
    const idleMachines = await this.prisma.machineCurrentStatus.findMany({
      where: {
        machine: { factoryId, isActive: true },
        state: 'IDLE',
        lastEventAt: { lt: cutoff },
        currentWOId: { not: null }, // only when WO is active
      },
      include: { machine: { select: { id: true, code: true, name: true, factoryId: true } } },
    });

    for (const status of idleMachines) {
      // Check if downtime event already exists for this machine
      const existing = await this.prisma.downtimeEvent.findFirst({
        where: { machineId: status.machineId, endTime: null },
      });
      if (existing) continue;

      try {
        await this.prisma.downtimeEvent.create({
          data: {
            factoryId: status.machine.factoryId,
            machineId: status.machineId,
            workOrderId: status.currentWOId,
            category: 'OTHER',
            reason: `Auto-detected: machine idle > ${DOWNTIME_THRESHOLD_SECONDS}s`,
            startTime: status.lastEventAt ?? new Date(),
            isPlanned: false,
          },
        });

        this.logger.warn(
          `Auto-downtime created for machine ${status.machine.code} (idle > ${DOWNTIME_THRESHOLD_SECONDS}s)`,
        );

        this.eventEmitter.emit('downtime.auto.created', {
          machineId: status.machineId,
          machineName: status.machine.name,
          factoryId: status.machine.factoryId,
        });
      } catch (err) {
        this.logger.error(`Failed to auto-create downtime for machine ${status.machine.code}`, err);
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // DOWNTIME SUMMARY (for reports)
  // ────────────────────────────────────────────────────────────

  async getDowntimeSummary(factoryId: string | null, dateFrom: Date, dateTo: Date) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const events = await this.prisma.downtimeEvent.findMany({
      where: {
        ...factoryFilter,
        startTime: { gte: dateFrom },
        endTime: { lte: dateTo },
        isPlanned: false,
      },
      include: {
        machine: { select: { name: true, code: true } },
        cause: { select: { code: true, name: true, category: true } },
      },
    });

    const byCategory: Record<string, number> = {};
    const byMachine: Record<string, number> = {};
    let totalMinutes = 0;

    for (const e of events) {
      const min = e.durationMinutes ?? 0;
      totalMinutes += min;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + min;
      byMachine[e.machine.name] = (byMachine[e.machine.name] ?? 0) + min;
    }

    return {
      totalEvents: events.length,
      totalMinutes,
      byCategory,
      byMachine,
      topCauses: Object.entries(byCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
    };
  }

  // ────────────────────────────────────────────────────────────
  // PRIVATE
  // ────────────────────────────────────────────────────────────

  private async updateMachineStateForDowntime(machineId: string, isPlanned: boolean) {
    try {
      const newState = isPlanned ? 'PLANNED_STOP' : 'BREAKDOWN';
      await this.prisma.machineCurrentStatus.upsert({
        where: { machineId },
        create: { machineId, state: newState },
        update: { state: newState, lastEventAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`Failed to update machine state for downtime`, err);
    }
  }
}
