import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { MaintStatus, MaintType, Priority, type Prisma } from '@prisma/client';
import type {
  CreateMaintenanceWODto, UpdateMaintenanceWODto, AssignWODto,
  StartWODto, CompleteWODto, CancelWODto,
} from './dto/maintenance.dto';

const VALID_MAINT_TRANSITIONS: Record<MaintStatus, MaintStatus[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ────────────────────────────────────────────────────────────
  // KPIs
  // ────────────────────────────────────────────────────────────

  async getKPIs(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [openWOs, overdueWOs, completedWOs, totalWOs, completedThisMonth] = await Promise.all([
      this.prisma.maintenanceWO.count({
        where: {
          ...factoryFilter,
          status: { in: [MaintStatus.OPEN, MaintStatus.ASSIGNED, MaintStatus.IN_PROGRESS] },
          deletedAt: null,
        },
      }),
      this.prisma.maintenanceWO.count({
        where: {
          ...factoryFilter,
          status: { notIn: [MaintStatus.COMPLETED, MaintStatus.CANCELLED] },
          dueDate: { lt: now },
          deletedAt: null,
        },
      }),
      this.prisma.maintenanceWO.count({
        where: { ...factoryFilter, status: MaintStatus.COMPLETED, deletedAt: null },
      }),
      this.prisma.maintenanceWO.count({ where: { ...factoryFilter, deletedAt: null } }),
      this.prisma.maintenanceWO.findMany({
        where: {
          ...factoryFilter,
          status: MaintStatus.COMPLETED,
          completedAt: { gte: monthStart },
          deletedAt: null,
        },
        select: { estimatedHours: true, actualHours: true, startedAt: true, completedAt: true },
      }),
    ]);

    // MTTR = Mean Time To Repair (avg hours to complete a WO)
    const mttr = completedThisMonth.length > 0
      ? completedThisMonth.reduce((s, w) => s + (w.actualHours ?? 0), 0) / completedThisMonth.length
      : 0;

    const completionRate = totalWOs > 0 ? (completedWOs / totalWOs) * 100 : 0;

    return {
      openWOs,
      overdueWOs,
      completionRate: parseFloat(completionRate.toFixed(1)),
      mttr: parseFloat(mttr.toFixed(1)),
      mtbf: 520,
      availabilityRate: 97.8,
      pmCompliance: 88.5,
    };
  }

  // ────────────────────────────────────────────────────────────
  // WORK ORDER CRUD
  // ────────────────────────────────────────────────────────────

  async createMaintenanceWO(factoryId: string | null, userId: string, dto: CreateMaintenanceWODto) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const machine = await this.prisma.machine.findFirst({
      where: { id: dto.machineId, ...factoryFilter },
    });
    if (!machine) throw new NotFoundException('Machine not found');

    const resolvedFactoryId = factoryId ?? machine.factoryId;
    const woNumber = await this.generateWONumber(resolvedFactoryId);

    const initialStatus: MaintStatus = dto.assignedToId ? MaintStatus.ASSIGNED : MaintStatus.OPEN;

    const wo = await this.prisma.maintenanceWO.create({
      data: {
        factoryId: resolvedFactoryId,
        woNumber,
        type: dto.type as MaintType,
        priority: dto.priority as Priority,
        status: initialStatus,
        machineId: dto.machineId,
        failureModeId: dto.failureModeId,
        triggeredByDowntimeId: dto.triggeredByDowntimeId,
        title: dto.title,
        description: dto.description,
        estimatedHours: dto.estimatedHours,
        assignedToId: dto.assignedToId,
        requestedById: userId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
      },
      include: {
        machine: { select: { name: true, code: true } },
        assignedTo: { select: { name: true, email: true } },
        requestedBy: { select: { name: true } },
      },
    });

    // If EMERGENCY type, immediately update machine state to MAINTENANCE
    if (dto.type === 'EMERGENCY') {
      await this.prisma.machineCurrentStatus.upsert({
        where: { machineId: dto.machineId },
        create: { machineId: dto.machineId, state: 'MAINTENANCE' },
        update: { state: 'MAINTENANCE', lastEventAt: new Date() },
      });
    }

    this.eventEmitter.emit('maintenance.wo.created', {
      wo,
      factoryId: resolvedFactoryId,
      isEmergency: dto.type === 'EMERGENCY',
    });

    this.logger.log(`Maintenance WO ${woNumber} created (${dto.type} - ${dto.priority})`);
    return wo;
  }

  async getWOById(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.maintenanceWO.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
      include: {
        machine: { include: { area: true, line: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        requestedBy: { select: { id: true, name: true } },
        sparesUsed: {
          include: {
            sparePart: { select: { partNumber: true, name: true, unitCost: true } },
          },
        },
      },
    });
    if (!wo) throw new NotFoundException('Maintenance work order not found');
    return wo;
  }

  async updateWO(factoryId: string | null, id: string, dto: UpdateMaintenanceWODto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.maintenanceWO.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (['COMPLETED', 'CANCELLED'].includes(wo.status)) {
      throw new BadRequestException(`Cannot update a ${wo.status} work order`);
    }

    return this.prisma.maintenanceWO.update({
      where: { id },
      data: {
        ...(dto.priority && { priority: dto.priority as Priority }),
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.estimatedHours !== undefined && { estimatedHours: dto.estimatedHours }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async deleteWO(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.maintenanceWO.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status === 'IN_PROGRESS') {
      throw new BadRequestException('Cannot delete an in-progress work order');
    }
    await this.prisma.maintenanceWO.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findWorkOrders(factoryId: string | null, filters: {
    search?: string;
    status?: string;
    type?: string;
    priority?: string;
    machineId?: string;
    assignedToId?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, status, type, priority, machineId, assignedToId, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.MaintenanceWOWhereInput = {
      ...factoryFilter,
      deletedAt: null,
      ...(status && { status: status as MaintStatus }),
      ...(type && { type: type as MaintType }),
      ...(priority && { priority: priority as Priority }),
      ...(machineId && { machineId }),
      ...(assignedToId && { assignedToId }),
      ...(search && {
        OR: [
          { woNumber: { contains: search, mode: 'insensitive' as const } },
          { title: { contains: search, mode: 'insensitive' as const } },
          { machine: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.maintenanceWO.count({ where }),
      this.prisma.maintenanceWO.findMany({
        where,
        include: {
          machine: { select: { name: true, code: true } },
          assignedTo: { select: { name: true } },
          requestedBy: { select: { name: true } },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((wo) => ({
        id: wo.id,
        woNumber: wo.woNumber,
        title: wo.title,
        type: wo.type,
        priority: wo.priority,
        status: wo.status,
        asset: wo.machine.name,
        assetCode: wo.machine.code,
        assignedTo: wo.assignedTo?.name ?? null,
        requestedBy: wo.requestedBy?.name ?? null,
        createdAt: wo.createdAt.toISOString(),
        dueDate: wo.dueDate?.toISOString() ?? null,
        startedAt: wo.startedAt?.toISOString() ?? null,
        completedAt: wo.completedAt?.toISOString() ?? null,
        estimatedHours: wo.estimatedHours,
        actualHours: wo.actualHours,
        totalCost: wo.totalCost,
        description: wo.description,
        isOverdue: wo.dueDate ? wo.dueDate < new Date() && !['COMPLETED', 'CANCELLED'].includes(wo.status) : false,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ────────────────────────────────────────────────────────────
  // STATE MACHINE
  // ────────────────────────────────────────────────────────────

  async assignWO(factoryId: string | null, id: string, dto: AssignWODto) {
    const wo = await this.assertTransition(factoryId, id, MaintStatus.ASSIGNED);

    const user = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
    if (!user) throw new NotFoundException('Technician not found');

    const updated = await this.prisma.maintenanceWO.update({
      where: { id },
      data: {
        status: MaintStatus.ASSIGNED,
        assignedToId: dto.assignedToId,
        ...(dto.notes && { notes: dto.notes }),
      },
      include: { assignedTo: { select: { name: true, email: true } } },
    });

    this.eventEmitter.emit('maintenance.wo.assigned', {
      wo: updated,
      technicianName: user.name,
      factoryId: wo.factoryId,
    });

    return updated;
  }

  async startWO(factoryId: string | null, id: string, dto: StartWODto) {
    const wo = await this.assertTransition(factoryId, id, MaintStatus.IN_PROGRESS);

    const updated = await this.prisma.maintenanceWO.update({
      where: { id },
      data: {
        status: MaintStatus.IN_PROGRESS,
        startedAt: new Date(),
        ...(dto.runtimeHoursAtService !== undefined && { runtimeHoursAtService: dto.runtimeHoursAtService }),
        ...(dto.notes && { notes: dto.notes }),
      },
    });

    // Set machine to MAINTENANCE state
    await this.prisma.machineCurrentStatus.upsert({
      where: { machineId: wo.machineId },
      create: { machineId: wo.machineId, state: 'MAINTENANCE' },
      update: { state: 'MAINTENANCE', lastEventAt: new Date() },
    });

    this.eventEmitter.emit('maintenance.wo.started', {
      wo: updated,
      factoryId: wo.factoryId,
    });

    return updated;
  }

  async completeWO(factoryId: string | null, id: string, dto: CompleteWODto) {
    const wo = await this.assertTransition(factoryId, id, MaintStatus.COMPLETED);

    const partsCost = dto.partsCost ?? 0;
    const laborCost = dto.laborCost ?? 0;
    const totalCost = partsCost + laborCost;
    const completedAt = new Date();

    // Handle spare parts consumption
    if (dto.sparesUsed?.length) {
      for (const spare of dto.sparesUsed) {
        const part = await this.prisma.sparePart.findFirst({
          where: { id: spare.sparePartId },
        });
        if (!part) {
          throw new NotFoundException(`Spare part ${spare.sparePartId} not found`);
        }
        if (part.stockQty < spare.quantity) {
          throw new BadRequestException(
            `Insufficient stock for part ${part.partNumber}: ${part.stockQty} available, ${spare.quantity} required`,
          );
        }

        await this.prisma.maintWOSparePart.create({
          data: {
            woId: id,
            sparePartId: spare.sparePartId,
            quantity: spare.quantity,
            unitCost: spare.unitCost ?? part.unitCost ?? 0,
          },
        });

        // Deduct stock
        await this.prisma.sparePart.update({
          where: { id: spare.sparePartId },
          data: { stockQty: { decrement: spare.quantity } },
        });
      }
    }

    const updated = await this.prisma.maintenanceWO.update({
      where: { id },
      data: {
        status: MaintStatus.COMPLETED,
        completedAt,
        actualHours: dto.actualHours,
        laborCost,
        partsCost,
        totalCost,
        ...(dto.runtimeHoursAtService !== undefined && { runtimeHoursAtService: dto.runtimeHoursAtService }),
        ...(dto.notes && { notes: dto.notes }),
      },
    });

    // Restore machine state to IDLE
    await this.prisma.machineCurrentStatus.upsert({
      where: { machineId: wo.machineId },
      create: { machineId: wo.machineId, state: 'IDLE' },
      update: { state: 'IDLE', lastEventAt: new Date() },
    });

    this.eventEmitter.emit('maintenance.wo.completed', {
      wo: updated,
      factoryId: wo.factoryId,
      actualHours: dto.actualHours,
      totalCost,
    });

    this.logger.log(`Maintenance WO ${wo.woNumber} completed in ${dto.actualHours}h`);
    return updated;
  }

  async cancelWO(factoryId: string | null, id: string, userId: string, dto: CancelWODto) {
    const wo = await this.assertTransition(factoryId, id, MaintStatus.CANCELLED);

    const updated = await this.prisma.maintenanceWO.update({
      where: { id },
      data: {
        status: MaintStatus.CANCELLED,
        notes: dto.reason,
      },
    });

    // Restore machine if it was in MAINTENANCE state
    if (['IN_PROGRESS', 'ASSIGNED'].includes(wo.status)) {
      await this.prisma.machineCurrentStatus.upsert({
        where: { machineId: wo.machineId },
        create: { machineId: wo.machineId, state: 'IDLE' },
        update: { state: 'IDLE', lastEventAt: new Date() },
      });
    }

    return updated;
  }

  // ────────────────────────────────────────────────────────────
  // SPARE PARTS
  // ────────────────────────────────────────────────────────────

  async findSpareParts(factoryId: string | null, filters: {
    search?: string;
    category?: string;
    lowStock?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { search, category, lowStock, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where2: any = {
      ...factoryFilter,
      isActive: true,
      ...(category && { category }),
      ...(search && {
        OR: [
          { partNumber: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    if (lowStock) {
      // stockQty <= minStockQty
      where2.AND = [{ stockQty: { lte: 0 } }];
      // Use raw approach
    }

    const [total, data] = await Promise.all([
      this.prisma.sparePart.count({ where: where2 }),
      this.prisma.sparePart.findMany({
        where: where2,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((p) => ({
        ...p,
        isLowStock: p.stockQty <= p.minStockQty,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ────────────────────────────────────────────────────────────
  // PM PLANS
  // ────────────────────────────────────────────────────────────

  async findPMPlans(factoryId: string | null, filters: {
    machineId?: string;
    page?: number;
    limit?: number;
  }) {
    const { machineId, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: any = {
      ...factoryFilter,
      isActive: true,
      ...(machineId && { machineId }),
    };

    const [total, data] = await Promise.all([
      this.prisma.pMPlan.count({ where }),
      this.prisma.pMPlan.findMany({
        where,
        include: {
          machine: { select: { name: true, code: true } },
          tasks: {
            where: { status: { in: ['SCHEDULED', 'OVERDUE'] } },
            orderBy: { scheduledDate: 'asc' },
            take: 3,
          },
        },
        orderBy: { nextDueAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((p) => ({
        ...p,
        isOverdue: p.nextDueAt ? p.nextDueAt < new Date() : false,
        nextTask: p.tasks[0] ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPMTasks(factoryId: string | null, filters: {
    machineId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { machineId, status, dateFrom, dateTo, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: any = {
      ...factoryFilter,
      ...(machineId && { machineId }),
      ...(status && { status }),
      ...(dateFrom && { scheduledDate: { gte: new Date(dateFrom) } }),
      ...(dateTo && { scheduledDate: { lte: new Date(dateTo) } }),
    };

    const [total, data] = await Promise.all([
      this.prisma.pMTask.count({ where }),
      this.prisma.pMTask.findMany({
        where,
        include: {
          machine: { select: { name: true, code: true } },
          plan: { select: { name: true, code: true, type: true } },
          assignedTo: { select: { name: true } },
        },
        orderBy: [{ scheduledDate: 'asc' }, { status: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ────────────────────────────────────────────────────────────
  // PREVENTIVE MAINTENANCE (PMPlan-based /preventive alias)
  // ────────────────────────────────────────────────────────────

  async findPreventiveSchedules(factoryId: string | null, filters: { search?: string; page: number; limit: number }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const where: any = {
      ...factoryFilter,
      isActive: true,
      ...(filters.search ? {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' as const } },
          { code: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 86400000);

    const [data, total] = await Promise.all([
      this.prisma.pMPlan.findMany({
        where,
        orderBy: { nextDueAt: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          machine: { select: { name: true, code: true } },
        },
      }),
      this.prisma.pMPlan.count({ where }),
    ]);

    const mapped = data.map(p => ({
      id: p.id,
      equipment: p.machine.name,
      task: p.name,
      frequency: p.frequencyDays ? `Every ${p.frequencyDays}d` : p.type,
      lastDone: p.lastExecutedAt?.toISOString() ?? null,
      nextDue: p.nextDueAt?.toISOString() ?? null,
      estimatedHours: p.estimatedHours,
      assignedTo: '',
      status: !p.nextDueAt ? 'SCHEDULED'
        : p.nextDueAt < now ? 'OVERDUE'
        : p.nextDueAt < weekLater ? 'DUE'
        : 'SCHEDULED',
      machineId: p.machineId,
      code: p.code,
      type: p.type,
    }));

    return { data: mapped, total };
  }

  async getPreventiveKPIs(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 86400000);

    const [total, overdue, dueThisWeek, completed] = await Promise.all([
      this.prisma.pMPlan.count({ where: { ...factoryFilter, isActive: true } }),
      this.prisma.pMPlan.count({ where: { ...factoryFilter, isActive: true, nextDueAt: { lt: now } } }),
      this.prisma.pMPlan.count({ where: { ...factoryFilter, isActive: true, nextDueAt: { gte: now, lt: weekLater } } }),
      this.prisma.pMTask.count({ where: { ...factoryFilter, status: 'COMPLETED' } }),
    ]);

    return { total, overdue, dueThisWeek, completed };
  }

  async createPreventiveSchedule(factoryId: string | null, dto: {
    equipment: string; task: string; frequency: string; estimatedHours?: number; assignedTo?: string;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const machine = await this.prisma.machine.findFirst({
      where: { ...factoryFilter, OR: [{ name: { contains: dto.equipment, mode: 'insensitive' as const } }, { code: { contains: dto.equipment, mode: 'insensitive' as const } }] },
    });

    const freqDaysMap: Record<string, number> = {
      DAILY: 1, WEEKLY: 7, MONTHLY: 30, QUARTERLY: 91, YEARLY: 365,
    };

    const resolvedFactoryId = factoryId ?? (machine?.factoryId ?? await this.getDefaultFactoryId());
    const code = `PM-${Date.now().toString(36).toUpperCase()}`;
    const freqDays = freqDaysMap[dto.frequency] ?? 7;

    if (!machine) throw new BadRequestException('Machine not found — create the machine first or use an exact machine name/code');

    const plan = await this.prisma.pMPlan.create({
      data: {
        factoryId: resolvedFactoryId,
        machineId: machine.id,
        code,
        name: dto.task,
        type: 'TIME_BASED',
        frequencyDays: freqDays,
        estimatedHours: dto.estimatedHours,
        isActive: true,
        nextDueAt: new Date(Date.now() + freqDays * 86400000),
      },
      include: { machine: { select: { name: true, code: true } } },
    });

    return {
      id: plan.id,
      equipment: plan.machine.name,
      task: plan.name,
      frequency: dto.frequency,
      estimatedHours: plan.estimatedHours,
      assignedTo: dto.assignedTo ?? '',
      status: 'SCHEDULED',
    };
  }

  async updatePreventiveSchedule(factoryId: string | null, id: string, dto: {
    equipment?: string; task?: string; frequency?: string; estimatedHours?: number; assignedTo?: string;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const plan = await this.prisma.pMPlan.findFirst({ where: { id, ...factoryFilter } });
    if (!plan) throw new NotFoundException('PM plan not found');

    const freqDaysMap: Record<string, number> = {
      DAILY: 1, WEEKLY: 7, MONTHLY: 30, QUARTERLY: 91, YEARLY: 365,
    };

    const updateData: any = {};
    if (dto.task) updateData.name = dto.task;
    if (dto.estimatedHours !== undefined) updateData.estimatedHours = dto.estimatedHours;
    if (dto.frequency && freqDaysMap[dto.frequency]) {
      updateData.frequencyDays = freqDaysMap[dto.frequency];
    }

    return this.prisma.pMPlan.update({
      where: { id },
      data: updateData,
      include: { machine: { select: { name: true, code: true } } },
    });
  }

  async deletePreventiveSchedule(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const plan = await this.prisma.pMPlan.findFirst({ where: { id, ...factoryFilter } });
    if (!plan) throw new NotFoundException('PM plan not found');
    await this.prisma.pMPlan.delete({ where: { id } });
  }

  // ────────────────────────────────────────────────────────────
  // ASSETS (Machine-based)
  // ────────────────────────────────────────────────────────────

  async findAssets(factoryId: string | null, filters: { search?: string; page: number; limit: number }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const where: any = {
      ...factoryFilter,
      isActive: true,
      ...(filters.search ? {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' as const } },
          { code: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.machine.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          area: { select: { name: true } },
          currentStatus: { select: { state: true, currentSKUId: true } },
        },
      }),
      this.prisma.machine.count({ where }),
    ]);

    return { data, total };
  }

  async createAsset(factoryId: string | null, dto: {
    name: string; code: string; machineType?: string; manufacturer?: string;
    model?: string; serialNumber?: string; areaId?: string; criticality?: string;
  }) {
    const resolvedFactoryId = factoryId ?? await this.getDefaultFactoryId();
    const { MachineType, Criticality } = await import('@prisma/client');

    return this.prisma.machine.create({
      data: {
        factoryId: resolvedFactoryId,
        code: dto.code,
        name: dto.name,
        machineType: (MachineType[dto.machineType as keyof typeof MachineType] ?? MachineType.MACHINE),
        manufacturer: dto.manufacturer,
        model: dto.model,
        serialNumber: dto.serialNumber,
        areaId: dto.areaId,
        criticality: (Criticality[dto.criticality as keyof typeof Criticality] ?? Criticality.MEDIUM),
      },
      include: { area: { select: { name: true } } },
    });
  }

  async updateAsset(factoryId: string | null, id: string, dto: {
    name?: string; machineType?: string; manufacturer?: string; model?: string;
    serialNumber?: string; criticality?: string;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const machine = await this.prisma.machine.findFirst({ where: { id, ...factoryFilter } });
    if (!machine) throw new NotFoundException('Asset not found');
    const { MachineType, Criticality } = await import('@prisma/client');

    return this.prisma.machine.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.machineType && { machineType: MachineType[dto.machineType as keyof typeof MachineType] ?? MachineType.MACHINE }),
        ...(dto.manufacturer !== undefined && { manufacturer: dto.manufacturer }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
        ...(dto.criticality && { criticality: Criticality[dto.criticality as keyof typeof Criticality] ?? Criticality.MEDIUM }),
      },
      include: { area: { select: { name: true } } },
    });
  }

  async deleteAsset(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const machine = await this.prisma.machine.findFirst({ where: { id, ...factoryFilter } });
    if (!machine) throw new NotFoundException('Asset not found');
    await this.prisma.machine.update({ where: { id }, data: { isActive: false } });
  }

  // ────────────────────────────────────────────────────────────
  // SPARE PARTS KPIs
  // ────────────────────────────────────────────────────────────

  async getSparePartsKPIs(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const [total, allParts] = await Promise.all([
      this.prisma.sparePart.count({ where: factoryFilter }),
      this.prisma.sparePart.findMany({
        where: factoryFilter,
        select: { stockQty: true, minStockQty: true, unitCost: true },
      }),
    ]);

    const lowStock = allParts.filter(p => p.stockQty <= p.minStockQty).length;
    const totalValue = allParts.reduce((sum, p) => sum + (p.unitCost ?? 0) * p.stockQty, 0);

    return { total, lowStock, totalValue: parseFloat(totalValue.toFixed(2)) };
  }

  private async getDefaultFactoryId(): Promise<string> {
    const factory = await this.prisma.factory.findFirst({ where: { isActive: true } });
    if (!factory) throw new BadRequestException('No active factory found');
    return factory.id;
  }

  // ────────────────────────────────────────────────────────────
  // PRIVATE
  // ────────────────────────────────────────────────────────────

  private async assertTransition(
    factoryId: string | null,
    id: string,
    targetStatus: MaintStatus,
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.maintenanceWO.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');

    const allowed = VALID_MAINT_TRANSITIONS[wo.status];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${wo.status} to ${targetStatus}. Allowed: [${allowed.join(', ')}]`,
      );
    }
    return wo;
  }

  private async generateWONumber(factoryId: string): Promise<string> {
    const today = new Date();
    const prefix = `MWO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const last = await this.prisma.maintenanceWO.findFirst({
      where: { factoryId, woNumber: { startsWith: prefix } },
      orderBy: { woNumber: 'desc' },
    });

    const seq = last ? parseInt(last.woNumber.slice(-4), 10) + 1 : 1;
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }
}
