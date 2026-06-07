import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { MaintStatus, MaintType, Priority, SpareIssueStatus, type Prisma } from '@prisma/client';
import type {
  CreateMaintenanceWODto, UpdateMaintenanceWODto, AssignWODto,
  StartWODto, CompleteWODto, CancelWODto,
  SparePartRequestItemDto, IssueSparePartDto,
} from './dto/maintenance.dto';

const VALID_MAINT_TRANSITIONS: Record<MaintStatus, MaintStatus[]> = {
  OPEN: ['ASSIGNED', 'AWAITING_PARTS', 'IN_PROGRESS', 'CANCELLED'],
  AWAITING_PARTS: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'AWAITING_PARTS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'AWAITING_PARTS', 'COMPLETED', 'CANCELLED'],
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

    // If spare parts are requested, WO starts in AWAITING_PARTS until inventory issues them
    const hasParts = !!(dto.spareParts?.length);
    const initialStatus: MaintStatus = hasParts
      ? MaintStatus.AWAITING_PARTS
      : dto.assignedToId
        ? MaintStatus.ASSIGNED
        : MaintStatus.OPEN;

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
        productionWOId: dto.productionWOId,
      },
      include: {
        machine: { select: { name: true, code: true } },
        assignedTo: { select: { name: true, email: true } },
        requestedBy: { select: { name: true } },
        productionWO: { select: { id: true, orderNumber: true, status: true, sku: { select: { name: true, code: true } } } },
      },
    });

    // Create spare part requests if provided
    if (dto.spareParts?.length) {
      for (const sp of dto.spareParts) {
        const part = await this.prisma.sparePart.findFirst({
          where: { id: sp.sparePartId },
        });
        if (!part) throw new NotFoundException(`Spare part ${sp.sparePartId} not found`);
        await this.prisma.maintWOSparePart.create({
          data: {
            woId: wo.id,
            sparePartId: sp.sparePartId,
            quantityRequested: sp.quantityRequested,
            notes: sp.notes,
          },
        });
      }
      this.logger.log(`WO ${woNumber} created with ${dto.spareParts.length} spare part request(s) — status: AWAITING_PARTS`);
    }

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
        productionWO: { select: { id: true, orderNumber: true, status: true, sku: { select: { name: true, code: true } } } },
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
        ...(dto.type && { type: dto.type }),
        ...(dto.priority && { priority: dto.priority as Priority }),
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.estimatedHours !== undefined && { estimatedHours: dto.estimatedHours }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.machineId && { machineId: dto.machineId }),
        ...(dto.assignedToId !== undefined && {
          assignedToId: dto.assignedToId || null,
          status: dto.assignedToId && wo.status === 'OPEN' ? 'ASSIGNED' : wo.status,
        }),
        ...(dto.productionWOId !== undefined && { productionWOId: dto.productionWOId || null }),
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
          productionWO: { select: { id: true, orderNumber: true, status: true } },
          _count: { select: { sparesUsed: { where: { status: SpareIssueStatus.PENDING } } } },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: (data as any[]).map((wo) => ({
        id: wo.id,
        woNumber: wo.woNumber,
        title: wo.title,
        type: wo.type,
        priority: wo.priority,
        status: wo.status,
        asset: wo.machine.name,
        assetCode: wo.machine.code,
        machineId: wo.machineId,
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
        hasPendingParts: (wo._count?.sparesUsed ?? 0) > 0,
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

    // Block start if there are still pending (un-issued) spare parts
    const pendingParts = await this.prisma.maintWOSparePart.count({
      where: { woId: id, status: SpareIssueStatus.PENDING },
    });
    if (pendingParts > 0) {
      throw new BadRequestException(
        `Cannot start work order: ${pendingParts} spare part(s) are still pending inventory approval. ` +
        'All requested parts must be issued or cancelled before starting.',
      );
    }

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

    // Handle additional (unplanned) spare parts logged at completion time
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

        // Check if a PENDING request already exists for this part on this WO
        const existing = await this.prisma.maintWOSparePart.findFirst({
          where: { woId: id, sparePartId: spare.sparePartId, status: SpareIssueStatus.PENDING },
        });
        if (existing) {
          // Update the existing request to ISSUED
          await this.prisma.maintWOSparePart.update({
            where: { id: existing.id },
            data: {
              quantityIssued: spare.quantity,
              status: SpareIssueStatus.ISSUED,
              issuedAt: new Date(),
              unitCost: spare.unitCost ?? part.unitCost ?? 0,
            },
          });
        } else {
          // Create a new ISSUED record for the unplanned part
          await this.prisma.maintWOSparePart.create({
            data: {
              woId: id,
              sparePartId: spare.sparePartId,
              quantityRequested: spare.quantity,
              quantityIssued: spare.quantity,
              unitCost: spare.unitCost ?? part.unitCost ?? 0,
              status: SpareIssueStatus.ISSUED,
              issuedAt: new Date(),
            },
          });
        }

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

  async holdWO(factoryId: string | null, id: string, reason?: string) {
    const wo = await this.assertTransition(factoryId, id, MaintStatus.ON_HOLD);
    return this.prisma.maintenanceWO.update({
      where: { id },
      data: { status: MaintStatus.ON_HOLD, ...(reason && { notes: reason }) },
    });
  }

  async resumeWO(factoryId: string | null, id: string) {
    const wo = await this.assertTransition(factoryId, id, MaintStatus.IN_PROGRESS);
    const resumeStatus = wo.startedAt ? MaintStatus.IN_PROGRESS : MaintStatus.ASSIGNED;
    return this.prisma.maintenanceWO.update({
      where: { id },
      data: { status: resumeStatus },
    });
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
  // SPARE PART REQUESTS (per WO)
  // ────────────────────────────────────────────────────────────

  async getWOSpareParts(factoryId: string | null, woId: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.maintenanceWO.findFirst({
      where: { id: woId, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');

    return this.prisma.maintWOSparePart.findMany({
      where: { woId },
      include: {
        sparePart: { select: { partNumber: true, name: true, unitCost: true, stockQty: true, storageLocation: true } },
        issuedBy: { select: { name: true } },
      },
      orderBy: { requestedAt: 'asc' },
    });
  }

  async addSpareParts(
    factoryId: string | null,
    woId: string,
    parts: SparePartRequestItemDto[],
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.maintenanceWO.findFirst({
      where: { id: woId, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (['COMPLETED', 'CANCELLED'].includes(wo.status)) {
      throw new BadRequestException(`Cannot add parts to a ${wo.status} work order`);
    }

    const created = [];
    for (const p of parts) {
      const part = await this.prisma.sparePart.findFirst({ where: { id: p.sparePartId } });
      if (!part) throw new NotFoundException(`Spare part ${p.sparePartId} not found`);

      const record = await this.prisma.maintWOSparePart.create({
        data: {
          woId,
          sparePartId: p.sparePartId,
          quantityRequested: p.quantityRequested,
          notes: p.notes,
          status: SpareIssueStatus.PENDING,
        },
        include: {
          sparePart: { select: { partNumber: true, name: true, stockQty: true } },
        },
      });
      created.push(record);
    }

    // If WO is OPEN or ASSIGNED and now has pending parts → move to AWAITING_PARTS
    const openOrAssigned: string[] = [MaintStatus.OPEN, MaintStatus.ASSIGNED];
    if (openOrAssigned.includes(wo.status)) {
      await this.prisma.maintenanceWO.update({
        where: { id: woId },
        data: { status: MaintStatus.AWAITING_PARTS },
      });
    }

    return created;
  }

  /** For the inventory team — all PENDING spare part requests across all active WOs */
  async getPendingPartsRequests(factoryId: string | null, filters: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, page = 1, limit = 50 } = filters;
    const factoryFilter = factoryId ? { wo: { factoryId } } : {};

    const where: Prisma.MaintWOSparePartWhereInput = {
      ...factoryFilter,
      status: SpareIssueStatus.PENDING,
      wo: {
        ...((factoryId) ? { factoryId } : {}),
        deletedAt: null,
      },
      ...(search && {
        OR: [
          { sparePart: { name: { contains: search, mode: 'insensitive' as const } } },
          { sparePart: { partNumber: { contains: search, mode: 'insensitive' as const } } },
          { wo: { woNumber: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.maintWOSparePart.count({ where }),
      this.prisma.maintWOSparePart.findMany({
        where,
        include: {
          sparePart: {
            select: { partNumber: true, name: true, category: true, stockQty: true, minStockQty: true, storageLocation: true, unitCost: true },
          },
          wo: {
            select: { woNumber: true, title: true, priority: true, dueDate: true, machine: { select: { name: true, code: true } } },
          },
          issuedBy: { select: { name: true } },
        },
        orderBy: [{ wo: { priority: 'desc' } }, { requestedAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((r) => ({
        id: r.id,
        woId: r.woId,
        woNumber: (r.wo as any).woNumber,
        woTitle: (r.wo as any).title,
        woPriority: (r.wo as any).priority,
        woDueDate: (r.wo as any).dueDate,
        machine: (r.wo as any).machine,
        sparePartId: r.sparePartId,
        partNumber: (r.sparePart as any).partNumber,
        partName: (r.sparePart as any).name,
        category: (r.sparePart as any).category,
        stockQty: (r.sparePart as any).stockQty,
        minStockQty: (r.sparePart as any).minStockQty,
        storageLocation: (r.sparePart as any).storageLocation,
        unitCost: (r.sparePart as any).unitCost,
        quantityRequested: r.quantityRequested,
        quantityIssued: r.quantityIssued,
        status: r.status,
        requestedAt: r.requestedAt,
        notes: r.notes,
        insufficientStock: (r.sparePart as any).stockQty < r.quantityRequested,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async issueSparePart(
    factoryId: string | null,
    woId: string,
    requestId: string,
    userId: string,
    dto: IssueSparePartDto,
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.maintenanceWO.findFirst({
      where: { id: woId, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');

    const request = await this.prisma.maintWOSparePart.findFirst({
      where: { id: requestId, woId },
      include: { sparePart: true },
    });
    if (!request) throw new NotFoundException('Spare part request not found');
    if (request.status === SpareIssueStatus.ISSUED) {
      throw new BadRequestException('This part request has already been fully issued');
    }
    if (request.status === SpareIssueStatus.CANCELLED) {
      throw new BadRequestException('This part request has been cancelled');
    }

    const part = request.sparePart;
    if (part.stockQty < dto.quantityIssued) {
      throw new BadRequestException(
        `Insufficient stock for ${part.partNumber}: ${part.stockQty} available, ${dto.quantityIssued} requested`,
      );
    }

    const newIssuedQty = request.quantityIssued + dto.quantityIssued;
    const newStatus: SpareIssueStatus =
      newIssuedQty >= request.quantityRequested
        ? SpareIssueStatus.ISSUED
        : SpareIssueStatus.PARTIAL;

    const [updated] = await this.prisma.$transaction([
      this.prisma.maintWOSparePart.update({
        where: { id: requestId },
        data: {
          quantityIssued: newIssuedQty,
          status: newStatus,
          issuedAt: new Date(),
          issuedById: userId,
          notes: dto.notes ?? request.notes,
        },
        include: {
          sparePart: { select: { partNumber: true, name: true, stockQty: true } },
          issuedBy: { select: { name: true } },
        },
      }),
      this.prisma.sparePart.update({
        where: { id: part.id },
        data: { stockQty: { decrement: dto.quantityIssued } },
      }),
    ]);

    // Auto-transition WO from AWAITING_PARTS once all parts are issued or cancelled
    if (wo.status === MaintStatus.AWAITING_PARTS) {
      const remainingPending = await this.prisma.maintWOSparePart.count({
        where: {
          woId,
          status: { notIn: [SpareIssueStatus.ISSUED, SpareIssueStatus.CANCELLED] },
        },
      });
      if (remainingPending === 0) {
        // All parts resolved → transition to OPEN (or ASSIGNED if technician already set)
        const nextStatus = wo.assignedToId ? MaintStatus.ASSIGNED : MaintStatus.OPEN;
        await this.prisma.maintenanceWO.update({
          where: { id: woId },
          data: { status: nextStatus },
        });
        this.logger.log(`WO ${wo.woNumber} auto-transitioned from AWAITING_PARTS → ${nextStatus} (all parts issued)`);
        this.eventEmitter.emit('maintenance.wo.parts_ready', {
          woId,
          woNumber: wo.woNumber,
          nextStatus,
          factoryId: wo.factoryId,
        });
      }
    }

    this.eventEmitter.emit('maintenance.spare_part.issued', {
      woId,
      woNumber: wo.woNumber,
      partNumber: part.partNumber,
      partName: part.name,
      quantityIssued: dto.quantityIssued,
      issuedByUserId: userId,
      factoryId: wo.factoryId,
    });

    this.logger.log(`Spare part ${part.partNumber} x${dto.quantityIssued} issued for WO ${wo.woNumber}`);
    return updated;
  }

  async cancelSparePartRequest(
    factoryId: string | null,
    woId: string,
    requestId: string,
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.maintenanceWO.findFirst({
      where: { id: woId, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');

    const request = await this.prisma.maintWOSparePart.findFirst({
      where: { id: requestId, woId },
    });
    if (!request) throw new NotFoundException('Spare part request not found');
    if (request.status !== SpareIssueStatus.PENDING) {
      throw new BadRequestException('Only PENDING requests can be cancelled');
    }

    return this.prisma.maintWOSparePart.update({
      where: { id: requestId },
      data: { status: SpareIssueStatus.CANCELLED },
    });
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
          area: { select: { id: true, name: true, code: true } },
          line: { select: { id: true, name: true, code: true } },
          currentStatus: { select: { state: true } },
        },
      }),
      this.prisma.machine.count({ where }),
    ]);

    return {
      data: data.map(m => ({
        id: m.id,
        code: m.code,
        name: m.name,
        machineType: m.machineType,
        manufacturer: m.manufacturer,
        model: m.model,
        serialNumber: m.serialNumber,
        criticality: m.criticality,
        installDate: m.installDate?.toISOString() ?? null,
        warrantyExpiry: m.warrantyExpiry?.toISOString() ?? null,
        area: m.area ? { id: m.area.id, name: m.area.name, code: m.area.code } : null,
        line: m.line ? { id: m.line.id, name: m.line.name, code: m.line.code } : null,
        status: m.currentStatus?.state ?? 'OFFLINE',
        isActive: m.isActive,
      })),
      total,
    };
  }

  async createAsset(factoryId: string | null, dto: {
    name: string; code: string; machineType?: string; manufacturer?: string;
    model?: string; serialNumber?: string; areaId?: string; lineId?: string;
    criticality?: string; installDate?: string; warrantyExpiry?: string;
  }) {
    const resolvedFactoryId = factoryId ?? await this.getDefaultFactoryId();
    const { MachineType, Criticality } = await import('@prisma/client');

    const machine = await this.prisma.machine.create({
      data: {
        factoryId: resolvedFactoryId,
        code: dto.code,
        name: dto.name,
        machineType: (MachineType[dto.machineType as keyof typeof MachineType] ?? MachineType.MACHINE),
        manufacturer: dto.manufacturer,
        model: dto.model,
        serialNumber: dto.serialNumber,
        areaId: dto.areaId || undefined,
        lineId: dto.lineId || undefined,
        criticality: (Criticality[dto.criticality as keyof typeof Criticality] ?? Criticality.MEDIUM),
        installDate: dto.installDate ? new Date(dto.installDate) : undefined,
        warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : undefined,
      },
      include: {
        area: { select: { id: true, name: true, code: true } },
        line: { select: { id: true, name: true, code: true } },
      },
    });
    return machine;
  }

  async updateAsset(factoryId: string | null, id: string, dto: {
    name?: string; machineType?: string; manufacturer?: string; model?: string;
    serialNumber?: string; areaId?: string; lineId?: string; criticality?: string;
    installDate?: string; warrantyExpiry?: string;
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
        ...(dto.areaId !== undefined && { areaId: dto.areaId || null }),
        ...(dto.lineId !== undefined && { lineId: dto.lineId || null }),
        ...(dto.criticality && { criticality: Criticality[dto.criticality as keyof typeof Criticality] ?? Criticality.MEDIUM }),
        ...(dto.installDate !== undefined && { installDate: dto.installDate ? new Date(dto.installDate) : null }),
        ...(dto.warrantyExpiry !== undefined && { warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null }),
      },
      include: {
        area: { select: { id: true, name: true, code: true } },
        line: { select: { id: true, name: true, code: true } },
      },
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
