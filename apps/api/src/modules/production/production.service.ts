import {
  Injectable, NotFoundException, BadRequestException, Logger,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { OEEService } from './oee.service';
import type { WorkOrderStatus, Prisma } from '@prisma/client';
import type {
  CreateWorkOrderDto, UpdateWorkOrderDto, CompleteWorkOrderDto,
  HoldWorkOrderDto, RecordCountDto,
  CreateProductionOrderDto, UpdateProductionOrderDto,
  CreateWOFromPODto, ProductionOrderFiltersDto,
} from './dto/work-order.dto';

const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  PLANNED: ['RELEASED', 'IN_PROGRESS', 'CANCELLED'],
  RELEASED: ['IN_PROGRESS', 'CANCELLED', 'ON_HOLD'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oeeService: OEEService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ────────────────────────────────────────────────────────────
  // WORK ORDER CRUD
  // ────────────────────────────────────────────────────────────

  async createWorkOrder(factoryId: string | null, userId: string, dto: CreateWorkOrderDto) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const sku = await this.prisma.sKU.findFirst({ where: { id: dto.skuId, ...factoryFilter } });
    if (!sku) throw new NotFoundException('SKU not found or not in your factory');

    // Machine is now optional at WO level (assigned per job order in ISA-95 dispatch)
    let machine: { factoryId: string; lineId: string | null; code: string } | null = null;
    if (dto.machineId) {
      machine = await this.prisma.machine.findFirst({ where: { id: dto.machineId, ...factoryFilter } });
      if (!machine) throw new NotFoundException('Machine not found or not in your factory');
    }

    if (dto.productionOrderId) {
      const po = await this.prisma.productionOrder.findFirst({
        where: { id: dto.productionOrderId, ...factoryFilter },
      });
      if (!po) throw new NotFoundException('Production order not found');
    }

    if (dto.machineId && machine) {
      const activeWO = await this.prisma.workOrder.findFirst({
        where: { machineId: dto.machineId, status: 'IN_PROGRESS', deletedAt: null },
      });
      if (activeWO) {
        this.logger.warn(`Machine ${machine.code} already has an active WO: ${activeWO.orderNumber}`);
      }
    }

    const resolvedFactoryId = factoryId ?? machine?.factoryId ?? sku.factoryId;
    const orderNumber = await this.generateOrderNumber(resolvedFactoryId);

    const cycleTime = dto.machineId
      ? await this.prisma.machineCycleTime.findFirst({
          where: { machineId: dto.machineId, skuId: dto.skuId, isActive: true },
        })
      : null;

    const workOrder = await this.prisma.workOrder.create({
      data: {
        factoryId: resolvedFactoryId,
        orderNumber,
        skuId: dto.skuId,
        machineId: dto.machineId ?? null,
        lineId: dto.lineId ?? machine?.lineId ?? null,
        productionOrderId: dto.productionOrderId,
        status: 'PLANNED',
        priority: dto.priority,
        plannedQty: dto.plannedQty,
        plannedStart: new Date(dto.plannedStart),
        plannedEnd: new Date(dto.plannedEnd),
        plannedCycleTime: cycleTime?.cycleTimeSeconds ?? null,
        operatorId: dto.operatorId,
        supervisorId: dto.supervisorId,
        notes: dto.notes,
        createdById: userId,
      },
      include: {
        sku: { select: { name: true, code: true, itemNumber: true } },
        machine: { select: { name: true, code: true } },
        line: { select: { name: true, code: true } },
        operator: { select: { name: true } },
      },
    });

    this.eventEmitter.emit('production.work-order.created', { workOrder, factoryId: resolvedFactoryId });
    this.logger.log(`Work order ${orderNumber} created`);

    return workOrder;
  }

  async findWorkOrders(factoryId: string | null, filters: {
    search?: string;
    status?: string;
    priority?: string;
    machineId?: string;
    lineId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, status, priority, machineId, lineId, dateFrom, dateTo, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const statusFilter = status
      ? status.includes(',')
        ? { status: { in: status.split(',').map(s => s.trim()) as WorkOrderStatus[] } }
        : { status: status as WorkOrderStatus }
      : {};

    const where: Prisma.WorkOrderWhereInput = {
      ...factoryFilter,
      deletedAt: null,
      ...statusFilter,
      ...(priority && { priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }),
      ...(machineId && { machineId }),
      ...(lineId && { lineId }),
      ...(dateFrom && { plannedStart: { gte: new Date(dateFrom) } }),
      ...(dateTo && { plannedEnd: { lte: new Date(dateTo) } }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' as const } },
          { sku: { name: { contains: search, mode: 'insensitive' as const } } },
          { machine: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.workOrder.count({ where }),
      this.prisma.workOrder.findMany({
        where,
        include: {
          sku: { select: { name: true, code: true, itemNumber: true } },
          machine: { select: { name: true, code: true } },
          line: { select: { name: true, code: true } },
          operator: { select: { name: true } },
          supervisor: { select: { name: true } },
          _count: { select: { jobOrders: true } },
          jobOrders: {
            orderBy: { sequenceOrder: 'asc' },
            select: {
              id: true,
              operationName: true,
              sequenceOrder: true,
              status: true,
              actualQtyGood: true,
              actualQtyRejected: true,
              actualStart: true,
              actualEnd: true,
              idealCycleTimeSec: true,
              machine: { select: { name: true, code: true } },
              operator: { select: { name: true } },
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { plannedStart: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((wo) => {
        const mapped = this.mapWorkOrder(wo);
        const totalSteps = wo.jobOrders.length;
        const completedSteps = wo.jobOrders.filter(j => j.status === 'COMPLETE').length;
        const lastJO = wo.jobOrders[totalSteps - 1];
        return {
          ...mapped,
          completedSteps,
          totalSteps,
          // Step-based progress — unit-safe
          progress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : mapped.progress,
          // Final output qty from last JO
          goodQty:  lastJO?.actualQtyGood     ?? mapped.goodQty,
          scrapQty: wo.jobOrders.reduce((s, j) => s + j.actualQtyRejected, 0),
          jobOrders: wo.jobOrders.map((jo) => ({
            id: jo.id,
            operationName: jo.operationName,
            sequenceOrder: jo.sequenceOrder,
            status: jo.status,
            machine: jo.machine,
            operator: jo.operator,
            joOEE: this.calcJobOrderOEE(jo).joOEE,
          })),
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getWorkOrderById(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
      include: {
        sku: true,
        machine: { include: { area: true, line: true } },
        line: true,
        operator: { select: { id: true, name: true, email: true } },
        supervisor: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        startedBy: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
        productionOrder: { select: { orderNumber: true, sapOrderNumber: true } },
        batchRecords: { select: { id: true, batchNumber: true, status: true } },
        downtimeEvents: {
          where: { endTime: null },
          select: { id: true, startTime: true, category: true, reason: true },
        },
        jobOrders: {
          orderBy: { sequenceOrder: 'asc' },
          include: {
            machine:  { select: { id: true, name: true, code: true } },
            operator: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');

    // ISA-95: each JO can have a different outputUnit (PIECE → CARTON → PALLET).
    // Summing across all JOs is meaningless. Correct approach:
    //   • liveGoodQty / liveActualQty  = last JO output (the WO's final product unit)
    //   • liveScrapQty                 = total scrap events across ALL steps (quality KPI)
    //   • liveProgress (qty-based)     = last JO good qty vs WO plannedQty
    //   • liveStepProgress             = % of JO steps completed (always meaningful)
    const lastJO  = wo.jobOrders[wo.jobOrders.length - 1] ?? null;
    const liveGood  = lastJO?.actualQtyGood     ?? 0;
    const liveScrap = wo.jobOrders.reduce((s, j) => s + j.actualQtyRejected, 0);
    const liveActual = liveGood + (lastJO?.actualQtyRejected ?? 0);
    const completedSteps = wo.jobOrders.filter(j => j.status === 'COMPLETE').length;
    const totalSteps     = wo.jobOrders.length;

    return {
      ...wo,
      liveGoodQty:    liveGood,
      liveScrapQty:   liveScrap,
      liveActualQty:  liveActual,
      // Step-based progress: how many routing steps are done (always unit-safe)
      liveProgress:   totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      completedSteps,
      totalSteps,
      jobOrders: wo.jobOrders.map((jo) => ({
        ...jo,
        ...this.calcJobOrderOEE(jo),
      })),
    };
  }

  async updateWorkOrder(factoryId: string | null, id: string, dto: UpdateWorkOrderDto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (['COMPLETED', 'CANCELLED'].includes(wo.status)) {
      throw new BadRequestException(`Cannot update a ${wo.status} work order`);
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        ...(dto.plannedQty !== undefined && { plannedQty: dto.plannedQty }),
        ...(dto.plannedStart && { plannedStart: new Date(dto.plannedStart) }),
        ...(dto.plannedEnd && { plannedEnd: new Date(dto.plannedEnd) }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.operatorId !== undefined && { operatorId: dto.operatorId }),
        ...(dto.supervisorId !== undefined && { supervisorId: dto.supervisorId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async deleteWorkOrder(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status === 'IN_PROGRESS') {
      throw new ConflictException('Cannot delete an in-progress work order. Hold or cancel it first.');
    }

    await this.prisma.workOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ────────────────────────────────────────────────────────────
  // PRODUCTION ORDERS (ISA-95 Level 4 — ERP/Scheduling)
  // ────────────────────────────────────────────────────────────

  async createProductionOrder(factoryId: string | null, userId: string, dto: CreateProductionOrderDto) {
    if (!factoryId) throw new BadRequestException('Factory context required');

    const sku = await this.prisma.sKU.findFirst({ where: { id: dto.skuId, factoryId } });
    if (!sku) throw new NotFoundException('SKU not found');

    const existing = await this.prisma.productionOrder.findFirst({ where: { orderNumber: dto.orderNumber } });
    if (existing) throw new ConflictException(`Order number ${dto.orderNumber} already exists`);

    return this.prisma.productionOrder.create({
      data: {
        factoryId,
        orderNumber: dto.orderNumber,
        sapOrderNumber: dto.sapOrderNumber,
        skuId: dto.skuId,
        targetQty: dto.targetQty,
        unit: dto.unit ?? 'CARTON',
        priority: dto.priority as any,
        plannedStart: new Date(dto.plannedStart),
        plannedEnd: new Date(dto.plannedEnd),
        customer: dto.customer,
        notes: dto.notes,
        createdById: userId,
        status: 'PLANNED',
      },
      include: { sku: { select: { name: true, code: true, itemNumber: true } } },
    });
  }

  async findProductionOrders(factoryId: string | null, filters: ProductionOrderFiltersDto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where: Prisma.ProductionOrderWhereInput = {
      ...factoryFilter,
      deletedAt: null,
      ...(filters.status && { status: filters.status as any }),
      ...(filters.search && {
        OR: [
          { orderNumber: { contains: filters.search, mode: 'insensitive' } },
          { sapOrderNumber: { contains: filters.search, mode: 'insensitive' } },
          { customer: { contains: filters.search, mode: 'insensitive' } },
          { sku: { name: { contains: filters.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        orderBy: { plannedStart: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sku: { select: { name: true, code: true, itemNumber: true, brand: true, weight: true, weightUnit: true } },
          workOrders: {
            where: { deletedAt: null },
            select: { id: true, orderNumber: true, status: true, plannedQty: true, actualQty: true, goodQty: true, machine: { select: { name: true, code: true } } },
          },
        },
      }),
      this.prisma.productionOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOneProductionOrder(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const po = await this.prisma.productionOrder.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
      include: {
        sku: { select: { name: true, code: true, itemNumber: true, brand: true, weight: true, weightUnit: true, packagingType: true } },
        workOrders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            machine: { select: { id: true, name: true, code: true } },
            operator: { select: { id: true, name: true } },
            inspectionResults: {
              select: { id: true, inspectionNumber: true, type: true, result: true, totalQty: true, passQty: true, failQty: true, inspectedAt: true },
              orderBy: { inspectedAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });
    if (!po) throw new NotFoundException('Production order not found');
    return po;
  }

  async updateProductionOrder(factoryId: string | null, id: string, dto: UpdateProductionOrderDto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const po = await this.prisma.productionOrder.findFirst({ where: { id, ...factoryFilter, deletedAt: null } });
    if (!po) throw new NotFoundException('Production order not found');
    if (['COMPLETED', 'CANCELLED'].includes(po.status)) {
      throw new BadRequestException(`Cannot modify a ${po.status} production order`);
    }

    return this.prisma.productionOrder.update({
      where: { id },
      data: {
        ...(dto.targetQty && { targetQty: dto.targetQty }),
        ...(dto.priority && { priority: dto.priority as any }),
        ...(dto.plannedStart && { plannedStart: new Date(dto.plannedStart) }),
        ...(dto.plannedEnd && { plannedEnd: new Date(dto.plannedEnd) }),
        ...(dto.customer !== undefined && { customer: dto.customer }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { sku: { select: { name: true, code: true } } },
    });
  }

  async releaseProductionOrder(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const po = await this.prisma.productionOrder.findFirst({ where: { id, ...factoryFilter, deletedAt: null } });
    if (!po) throw new NotFoundException('Production order not found');
    if (po.status !== 'PLANNED') throw new BadRequestException(`Only PLANNED orders can be released (current: ${po.status})`);

    return this.prisma.productionOrder.update({ where: { id }, data: { status: 'RELEASED' } });
  }

  async createWorkOrderFromPO(factoryId: string | null, userId: string, poId: string, dto: CreateWOFromPODto) {
    if (!factoryId) throw new BadRequestException('Factory context required');
    const factoryFilter = { factoryId };

    const [po, machine] = await Promise.all([
      this.prisma.productionOrder.findFirst({ where: { id: poId, ...factoryFilter, deletedAt: null }, include: { sku: true } }),
      this.prisma.machine.findFirst({ where: { id: dto.machineId, ...factoryFilter } }),
    ]);

    if (!po) throw new NotFoundException('Production order not found');
    if (!machine) throw new NotFoundException('Machine not found');
    if (po.status === 'CANCELLED') throw new BadRequestException('Cannot create WO for a cancelled production order');
    if (!po.skuId) throw new BadRequestException('Production order has no SKU assigned');

    // Generate WO number: WO-{YYYY}-{seq}
    const year = new Date().getFullYear();
    const count = await this.prisma.workOrder.count({ where: { factoryId } });
    const orderNumber = `WO-${year}-${String(count + 1).padStart(4, '0')}`;

    const wo = await this.prisma.workOrder.create({
      data: {
        factoryId,
        productionOrderId: poId,
        skuId: po.skuId,
        machineId: dto.machineId,
        lineId: machine.lineId,
        orderNumber,
        status: 'PLANNED',
        priority: (dto.priority ?? po.priority) as any,
        plannedQty: dto.plannedQty,
        plannedStart: new Date(dto.plannedStart),
        plannedEnd: new Date(dto.plannedEnd),
        operatorId: dto.operatorId,
        notes: dto.notes,
        createdById: userId,
      },
      include: {
        sku: { select: { name: true, code: true } },
        machine: { select: { name: true, code: true } },
        productionOrder: { select: { orderNumber: true } },
      },
    });

    // Update PO status to IN_PROGRESS if RELEASED
    if (po.status === 'RELEASED') {
      await this.prisma.productionOrder.update({ where: { id: poId }, data: { status: 'IN_PROGRESS', actualStart: new Date() } });
    }

    this.logger.log(`WO ${orderNumber} created from PO ${po.orderNumber}`);
    return wo;
  }

  async cancelProductionOrder(factoryId: string | null, id: string, reason: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const po = await this.prisma.productionOrder.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
      include: { workOrders: { where: { status: 'IN_PROGRESS', deletedAt: null } } },
    });
    if (!po) throw new NotFoundException('Production order not found');
    if (po.status === 'COMPLETED') throw new BadRequestException('Cannot cancel a completed production order');
    if (po.workOrders.length > 0) throw new BadRequestException('Cannot cancel PO with in-progress work orders');

    return this.prisma.productionOrder.update({
      where: { id },
      data: { status: 'CANCELLED', notes: po.notes ? `${po.notes}\n[Cancelled: ${reason}]` : `[Cancelled: ${reason}]` },
    });
  }

  async holdProductionOrder(factoryId: string | null, id: string, reason: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const po = await this.prisma.productionOrder.findFirst({ where: { id, ...factoryFilter, deletedAt: null } });
    if (!po) throw new NotFoundException('Production order not found');
    if (!['RELEASED', 'IN_PROGRESS'].includes(po.status)) {
      throw new BadRequestException(`Cannot hold a ${po.status} production order`);
    }
    return this.prisma.productionOrder.update({
      where: { id },
      data: { status: 'ON_HOLD', notes: po.notes ? `${po.notes}\n[Hold: ${reason}]` : `[Hold: ${reason}]` },
    });
  }

  async resumeProductionOrder(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const po = await this.prisma.productionOrder.findFirst({ where: { id, ...factoryFilter, deletedAt: null } });
    if (!po) throw new NotFoundException('Production order not found');
    if (po.status !== 'ON_HOLD') throw new BadRequestException('Only ON_HOLD orders can be resumed');
    // Resume: if actual start exists → IN_PROGRESS, otherwise → RELEASED
    const resumeStatus = po.actualStart ? 'IN_PROGRESS' : 'RELEASED';
    return this.prisma.productionOrder.update({ where: { id }, data: { status: resumeStatus } });
  }

  async completeProductionOrder(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const po = await this.prisma.productionOrder.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
      include: { workOrders: { where: { deletedAt: null } } },
    });
    if (!po) throw new NotFoundException('Production order not found');
    if (po.status !== 'IN_PROGRESS') throw new BadRequestException(`Only IN_PROGRESS orders can be completed (current: ${po.status})`);

    const completedQty = po.workOrders.reduce((s, w) => s + (w.goodQty || 0), 0);
    return this.prisma.productionOrder.update({
      where: { id },
      data: { status: 'COMPLETED', actualEnd: new Date(), completedQty },
    });
  }

  async deleteProductionOrder(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const po = await this.prisma.productionOrder.findFirst({
      where: { id, ...factoryFilter, deletedAt: null },
      include: { workOrders: { where: { deletedAt: null, status: { notIn: ['CANCELLED'] } } } },
    });
    if (!po) throw new NotFoundException('Production order not found');
    if (!['PLANNED', 'CANCELLED'].includes(po.status)) {
      throw new BadRequestException(`Only PLANNED or CANCELLED orders can be deleted (current: ${po.status})`);
    }
    if (po.workOrders.length > 0) {
      throw new BadRequestException('Cannot delete PO with active work orders. Cancel them first.');
    }
    await this.prisma.productionOrder.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ─────────────────────────────────────────────────────────────
  // AUTO-GENERATE WORK ORDERS (ISA-95 — Recipe + Routing driven)
  // ─────────────────────────────────────────────────────────────

  /** Look up the StepDependency type between two routing steps.
   *  Returns 'FINISH_TO_START' (default) when no explicit record exists. */
  private async lookupDepType(
    fromStepId: string | null | undefined,
    toStepId: string | null | undefined,
  ): Promise<string> {
    if (!fromStepId || !toStepId) return 'FINISH_TO_START';
    const dep = await this.prisma.stepDependency.findFirst({
      where: { fromStepId, toStepId },
      select: { type: true },
    });
    return dep?.type ?? 'FINISH_TO_START';
  }

  /** Resolve the best machine for a routing step when machineId is null.
   *  Three attempts: name-prefix match → machine-name-in-WC-name → code-suffix match */
  private async resolveStepMachine(
    step: { machineId?: string | null; machine?: any; workCenterId?: string | null; workCenterRef?: any },
    factoryId: string | null,
  ): Promise<{ id: string; name: string; code: string; machineType: string } | null> {
    if (step.machine) return step.machine;

    const wc = step.workCenterRef;
    if (!wc) return null;

    const baseWhere = factoryId ? { factoryId, isActive: true } : { isActive: true };
    const sel = { id: true, name: true, code: true, machineType: true } as const;

    // Attempt 1: stripped WorkCenter name contained in machine name
    const stripped = wc.name
      .replace(/\s+cell$/i, '')
      .replace(/\s+work\s*center$/i, '')
      .trim();

    const m1 = await this.prisma.machine.findFirst({
      where: { ...baseWhere, name: { contains: stripped, mode: 'insensitive' } },
      select: sel,
    });
    if (m1) return m1;

    // Attempt 2: machine name contained within WorkCenter name
    const all = await this.prisma.machine.findMany({ where: baseWhere, select: sel });
    const m2 = all.find((m) => wc.name.toLowerCase().includes(m.name.toLowerCase())) ?? null;
    if (m2) return m2;

    // Attempt 3: WorkCenter code suffix (after "WC-") matches machine code
    const wcSuffix = (wc.code as string).replace(/^WC-/i, '');
    if (wcSuffix) {
      const m3 = all.find(
        (m) =>
          m.code.toLowerCase().includes(wcSuffix.toLowerCase()) ||
          wcSuffix.toLowerCase().includes(m.code.replace(/^SDPF-M\d+-/i, '').toLowerCase()),
      ) ?? null;
      if (m3) return m3;
    }

    return null;
  }

  /** Map an operation name to its output unit (PIECE → CARTON → PALLET). */
  private resolveStepOutputUnit(operationName: string, prevUnit: string): string {
    const op = operationName.toLowerCase();
    if (/carton(?:ing)?|cartomac|boxing|carto\b/.test(op)) return 'CARTON';
    if (/palletiz(?:ing|er)?|palletis(?:ing|er)?|robot|stacking/.test(op)) return 'PALLET';
    // wrapping keeps the same unit (pallet stays pallet after shrink-wrap)
    return prevUnit;
  }

  /**
   * Convert a quantity between packaging-hierarchy units using the SKU spec:
   * PCS/PIECE → INNER (÷unitsPerInner) → CARTON (÷innersPerCarton) → PALLET (÷cartonsPerPallet).
   * This powers per-step qty flow AND duration = qtyOut × cycleTimeSec in scheduling.
   */
  private convertUnits(
    qty: number,
    fromUnit: string,
    toUnit: string,
    pkg: { unitsPerInner: number; innersPerCarton: number; cartonsPerPallet: number },
  ): number {
    const norm = (u: string) => {
      const x = (u || 'PIECE').toUpperCase();
      if (x === 'PCS' || x === 'EA' || x === 'UNIT') return 'PIECE';
      return x;
    };
    const LADDER = ['PIECE', 'INNER', 'CARTON', 'PALLET'];
    const factor = [
      Math.max(1, pkg.unitsPerInner),    // pieces per inner
      Math.max(1, pkg.innersPerCarton),  // inners per carton
      Math.max(1, pkg.cartonsPerPallet), // cartons per pallet
    ];
    const fi = LADDER.indexOf(norm(fromUnit));
    const ti = LADDER.indexOf(norm(toUnit));
    if (fi < 0 || ti < 0 || fi === ti) return qty;
    let q = qty;
    if (ti > fi) { for (let i = fi; i < ti; i++) q = q / factor[i]; return Math.ceil(q); }
    for (let i = fi - 1; i >= ti; i--) q = q * factor[i];
    return Math.round(q);
  }

  /** Calculate the expected output quantity when the unit changes between steps. */
  private calcOutputQty(
    outputUnit: string,
    prevUnit: string,
    prevQty: number,
    pkg: { unitsPerInner: number; innersPerCarton: number; cartonsPerPallet: number },
  ): number {
    return this.convertUnits(prevQty, prevUnit, outputUnit, pkg);
  }

  async previewAutoGenerateWOs(factoryId: string | null, poId: string): Promise<any> {
    const factoryFilter = factoryId ? { factoryId } : {};
    const po = await this.prisma.productionOrder.findFirst({
      where: { id: poId, ...factoryFilter, deletedAt: null },
      include: { sku: true },
    });
    if (!po) throw new NotFoundException('Production order not found');
    if (!po.skuId) throw new BadRequestException('Production order has no SKU assigned');
    if (!['RELEASED', 'IN_PROGRESS'].includes(po.status)) {
      throw new BadRequestException(
        `Release the PO first before auto-generating (current: ${po.status})`,
      );
    }

    const stepIncludes = {
      where: { isOptional: false },
      orderBy: { stepNumber: 'asc' } as const,
      include: {
        machine: { select: { id: true, name: true, code: true, machineType: true } },
        workCenterRef: { select: { id: true, name: true, code: true, level: true } },
      },
    };

    // APPROVED recipe first, then REVIEW as fallback
    const recipe: any = await this.prisma.recipe.findFirst({
      where: { skuId: po.skuId, status: { in: ['APPROVED', 'REVIEW'] as any }, ...factoryFilter },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { process: { include: { routingSteps: stepIncludes } } },
    });

    const process: any = recipe?.process ?? await this.prisma.manufacturingProcess.findFirst({
      where: { skuId: po.skuId, isActive: true, ...factoryFilter },
      orderBy: { createdAt: 'desc' },
      include: { routingSteps: stepIncludes },
    });

    const rawSteps: any[] = (process?.routingSteps ?? []).filter((s: any) => !s.isOptional);

    // Packaging specs for unit-flow calculation
    const skuPkg = {
      unitsPerInner: (po.sku as any)?.unitsPerInner ?? 1,
      innersPerCarton: (po.sku as any)?.innersPerCarton ?? 1,
      cartonsPerPallet: (po.sku as any)?.cartonsPerPallet ?? 1,
    };
    const ppc = Math.max(1, skuPkg.unitsPerInner * skuPkg.innersPerCarton);
    // Normalise PO qty to PIECE base for step-by-step calculations
    let prevQty = (po as any).unit === 'CARTON' ? po.targetQty * ppc
      : (po as any).unit === 'PALLET' ? po.targetQty * ppc * skuPkg.cartonsPerPallet
      : po.targetQty;
    let prevUnit = 'PIECE';

    // Sequential loop — prevQty/prevUnit must flow step-to-step
    const jobOrdersToCreate: any[] = [];
    for (const step of rawSteps) {
      const resolvedMachine = await this.resolveStepMachine(step as any, factoryId);
      const outputUnit = this.resolveStepOutputUnit((step as any).operationName, prevUnit);
      const outputQty  = this.calcOutputQty(outputUnit, prevUnit, prevQty, skuPkg);
      prevUnit = outputUnit;
      prevQty  = outputQty;

      jobOrdersToCreate.push({
        stepNumber: (step as any).stepNumber,
        operationName: (step as any).operationName,
        machine: resolvedMachine
          ? { id: resolvedMachine.id, name: resolvedMachine.name, code: resolvedMachine.code }
          : null,
        workCenter: (step as any).workCenterRef
          ? { name: (step as any).workCenterRef.name, code: (step as any).workCenterRef.code }
          : null,
        plannedQtyOut: outputQty,
        outputUnit,
        estimatedDurationMins:
          (step as any).cycleTimeMins ??
          (process?.totalCycleTimeMins && rawSteps.length
            ? process.totalCycleTimeMins / rawSteps.length
            : null),
        setupTimeMins: (step as any).setupTimeMins ?? 0,
      });
    }

    const existingWOCount = await this.prisma.workOrder.count({
      where: { productionOrderId: poId, deletedAt: null },
    });

    if (jobOrdersToCreate.length === 0) {
      const fallback = await this.prisma.machine.findFirst({
        where: { ...(factoryId ? { factoryId } : {}), isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      return {
        recipe: recipe ? { id: recipe.id, code: recipe.code, version: recipe.version, name: recipe.name, status: recipe.status } : null,
        process: null,
        jobOrdersToCreate: fallback
          ? [{ stepNumber: 1, operationName: 'Production Run', machine: { id: fallback.id, name: fallback.name }, plannedQty: po.targetQty, estimatedDurationMins: null }]
          : [],
        workOrdersToCreate: fallback
          ? [{ stepNumber: 1, operationName: 'Production Run', machine: { id: fallback.id, name: fallback.name }, plannedQty: po.targetQty, estimatedDurationMins: null }]
          : [],
        existingWOCount,
        canGenerate: !!fallback,
        warning: 'No routing steps found — will create a single work order on the primary machine.',
        mode: 'fallback',
      };
    }

    const warnings: string[] = [];
    if (recipe?.status && recipe.status !== 'APPROVED') {
      warnings.push(`Recipe ${recipe.code} is in "${recipe.status}" status — not yet approved for production.`);
    }
    if (!recipe) {
      warnings.push('No recipe found — using manufacturing process routing only.');
    }
    if (existingWOCount > 0) {
      warnings.push(`This PO already has ${existingWOCount} work order(s).`);
    }
    const noMachine = jobOrdersToCreate.filter((s) => !s.machine);
    if (noMachine.length > 0) {
      warnings.push(
        `${noMachine.length} step(s) have no machine resolved (${noMachine.map((s) => s.operationName).join(', ')}). Assign machines after generation.`,
      );
    }

    return {
      recipe: recipe ? { id: recipe.id, code: recipe.code, version: recipe.version, name: recipe.name, status: recipe.status } : null,
      process: process ? { id: process.id, name: process.name, totalCycleTimeMins: process.totalCycleTimeMins } : null,
      // ISA-95: 1 Work Order + N Job Orders (dispatch list)
      jobOrdersToCreate,
      workOrdersToCreate: jobOrdersToCreate, // kept for backward compat
      existingWOCount,
      canGenerate: true,
      warning: warnings.length > 0 ? warnings.join(' | ') : null,
      mode: 'dispatch', // signals the UI that we create 1 WO + N JOs
    };
  }

  async autoGenerateWorkOrders(
    factoryId: string | null, userId: string, poId: string,
    dto: { plannedStart: string; plannedEnd: string },
  ): Promise<any> {
    if (!factoryId) throw new BadRequestException('Factory context required');

    const preview = await this.previewAutoGenerateWOs(factoryId, poId);
    if (!preview.canGenerate) throw new BadRequestException('Cannot auto-generate: no machines available');

    const po = await this.prisma.productionOrder.findFirst({
      where: { id: poId, factoryId, deletedAt: null },
    });
    if (!po) throw new NotFoundException('Production order not found');

    const start = new Date(dto.plannedStart);
    const end   = new Date(dto.plannedEnd);
    const year  = new Date().getFullYear();
    const existing = await this.prisma.workOrder.count({ where: { factoryId } });

    // ISA-95: 1 Work Order per Production Order (the production run)
    // N Job Orders are the dispatch list (one per routing step)
    const firstStep: any = preview.jobOrdersToCreate?.[0];
    const primaryMachineId: string | null = firstStep?.machine?.id ?? null;

    let lineId: string | null = null;
    if (primaryMachineId) {
      const m = await this.prisma.machine.findFirst({ where: { id: primaryMachineId }, select: { lineId: true } });
      lineId = m?.lineId ?? null;
    }

    const orderNumber = `WO-${year}-${String(existing + 1).padStart(4, '0')}`;

    const wo = await this.prisma.workOrder.create({
      data: {
        factoryId,
        productionOrderId: poId,
        skuId: po.skuId!,
        machineId: primaryMachineId,
        lineId,
        orderNumber,
        status: 'PLANNED',
        priority: po.priority as any,
        plannedQty: po.targetQty,
        plannedStart: start,
        plannedEnd: end,
        notes: `Auto-generated from PO ${po.orderNumber}${preview.process ? ` — Process: ${preview.process.name}` : ''}`,
        createdById: userId,
      },
      include: {
        sku: { select: { name: true, code: true } },
        machine: { select: { name: true, code: true } },
      },
    });

    // Generate dispatch list (Job Orders) for each routing step
    const joResult = await this.generateJobOrders(factoryId, wo.id, {
      plannedStart: dto.plannedStart,
      plannedEnd: dto.plannedEnd,
      clearExisting: false,
    });

    // Advance PO to IN_PROGRESS
    if (po.status === 'RELEASED') {
      await this.prisma.productionOrder.update({
        where: { id: poId },
        data: { status: 'IN_PROGRESS', actualStart: new Date() },
      });
    }

    this.logger.log(
      `Auto-generated WO ${wo.orderNumber} + ${joResult.created} job orders for PO ${po.orderNumber}`,
    );
    return {
      workOrder: wo,
      jobOrdersCreated: joResult.created,
      jobOrders: joResult.jobOrders,
      process: preview.process,
      warning: preview.warning,
    };
  }

  // ────────────────────────────────────────────────────────────
  // STATE MACHINE
  // ────────────────────────────────────────────────────────────

  async startWorkOrder(factoryId: string | null, userId: string, workOrderId: string, operatorId?: string) {
    const wo = await this.assertTransition(factoryId, workOrderId, 'IN_PROGRESS');

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
        startedById: userId,
        ...(operatorId && { operatorId }),
      },
      include: {
        sku: { select: { name: true, code: true } },
        machine: { select: { name: true, code: true } },
      },
    });

    // Update machine current status
    await this.updateMachineStatus(updated.machineId!, 'RUNNING', workOrderId, updated.skuId);

    // Record production event
    await this.recordProductionEvent(updated.factoryId, workOrderId, updated.machineId, 'WO_STARTED');

    this.eventEmitter.emit('production.work-order.started', {
      workOrder: updated,
      factoryId: updated.factoryId,
    });

    this.logger.log(`WO ${wo.orderNumber} started`);
    return updated;
  }

  async holdWorkOrder(factoryId: string | null, userId: string, workOrderId: string, dto: HoldWorkOrderDto) {
    const wo = await this.assertTransition(factoryId, workOrderId, 'ON_HOLD');

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status: 'ON_HOLD' },
    });

    // Update machine status to idle
    await this.updateMachineStatus(wo.machineId!, 'IDLE', workOrderId, wo.skuId);

    await this.recordProductionEvent(
      wo.factoryId, workOrderId, wo.machineId, 'WO_PAUSED', undefined, { reason: dto.reason, heldById: userId },
    );

    this.eventEmitter.emit('production.work-order.held', {
      workOrder: { id: workOrderId, orderNumber: wo.orderNumber, reason: dto.reason },
      factoryId: wo.factoryId,
    });

    this.logger.log(`WO ${wo.orderNumber} put on hold: ${dto.reason}`);
    return updated;
  }

  async releaseWorkOrder(factoryId: string | null, userId: string, workOrderId: string) {
    const wo = await this.assertTransition(factoryId, workOrderId, 'IN_PROGRESS');

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status: 'IN_PROGRESS' },
    });

    await this.updateMachineStatus(wo.machineId!, 'RUNNING', workOrderId, wo.skuId);
    await this.recordProductionEvent(wo.factoryId, workOrderId, wo.machineId, 'WO_STARTED', undefined, { releasedById: userId });

    this.eventEmitter.emit('production.work-order.released', {
      workOrder: { id: workOrderId, orderNumber: wo.orderNumber },
      factoryId: wo.factoryId,
    });

    return updated;
  }

  async cancelWorkOrder(factoryId: string | null, userId: string, workOrderId: string, reason: string) {
    const wo = await this.assertTransition(factoryId, workOrderId, 'CANCELLED');

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status: 'CANCELLED', notes: reason },
    });

    if (wo.machineId) {
      await this.updateMachineStatus(wo.machineId, 'IDLE', null, null);
    }

    await this.recordProductionEvent(wo.factoryId, workOrderId, wo.machineId, 'WO_PAUSED', undefined, { reason, cancelledById: userId });

    this.eventEmitter.emit('production.work-order.cancelled', {
      workOrder: { id: workOrderId, orderNumber: wo.orderNumber, reason },
      factoryId: wo.factoryId,
    });

    return updated;
  }

  async completeWorkOrder(
    factoryId: string | null,
    userId: string,
    workOrderId: string,
    dto: CompleteWorkOrderDto,
  ) {
    const wo = await this.assertTransition(factoryId, workOrderId, 'COMPLETED');

    const goodQty = dto.goodQty ?? dto.actualQty;
    const scrapQty = dto.scrapQty ?? Math.max(0, dto.actualQty - goodQty);

    const actualEnd = new Date();
    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'COMPLETED',
        actualQty: dto.actualQty,
        goodQty,
        scrapQty,
        actualEnd,
        completedById: userId,
        ...(dto.notes && { notes: dto.notes }),
      },
    });

    // Auto-calculate OEE
    const oeeResult = await this.calculateAndStoreOEE(wo, dto.actualQty, goodQty, actualEnd);

    // Traceability & genealogy: output batch + per-step trace events +
    // per-step material consumptions (linked to lots when available)
    await this.recordTraceability(wo, userId, dto.actualQty, goodQty, scrapQty, actualEnd);

    // Update machine to IDLE
    await this.updateMachineStatus(wo.machineId!, 'IDLE', null, null);

    await this.recordProductionEvent(wo.factoryId, workOrderId, wo.machineId, 'WO_COMPLETED', dto.actualQty);

    this.eventEmitter.emit('production.work-order.completed', {
      workOrder: { ...updated, oee: oeeResult?.oee },
      factoryId: wo.factoryId,
    });

    this.logger.log(`WO ${wo.orderNumber} completed — OEE: ${oeeResult?.oee?.toFixed(1) ?? 'N/A'}%`);
    return { ...updated, oeeResult };
  }

  // ────────────────────────────────────────────────────────────
  // PRODUCTION COUNT UPDATES
  // ────────────────────────────────────────────────────────────

  async recordCount(factoryId: string | null, workOrderId: string, dto: RecordCountDto) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, ...factoryFilter, status: 'IN_PROGRESS', deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Active work order not found');

    const totalGood = wo.goodQty + dto.goodCount;
    const totalReject = wo.reworkQty + (dto.rejectCount ?? 0);
    const totalActual = totalGood + totalReject;

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        actualQty: totalActual,
        goodQty: totalGood,
        reworkQty: totalReject,
      },
    });

    // Update machine current status counters
    if (wo.machineId) {
      await this.prisma.machineCurrentStatus.upsert({
        where: { machineId: wo.machineId },
        create: {
          machineId: wo.machineId,
          state: 'RUNNING',
          goodCount: dto.goodCount,
          rejectCount: dto.rejectCount ?? 0,
          currentWOId: workOrderId,
          currentSKUId: wo.skuId ?? undefined,
        },
        update: {
          goodCount: { increment: dto.goodCount },
          rejectCount: { increment: dto.rejectCount ?? 0 },
          lastEventAt: new Date(),
        },
      });
    }

    await this.recordProductionEvent(
      wo.factoryId, workOrderId, wo.machineId, 'COUNT_UPDATE', totalActual,
      { goodCount: dto.goodCount, rejectCount: dto.rejectCount ?? 0 },
    );

    this.eventEmitter.emit('production.count.updated', {
      workOrderId,
      factoryId: wo.factoryId,
      actualQty: totalActual,
      goodQty: totalGood,
      progress: Math.min(Math.round((totalActual / wo.plannedQty) * 100), 100),
    });

    return updated;
  }

  // ────────────────────────────────────────────────────────────
  // KPIs
  // ────────────────────────────────────────────────────────────

  async getKPIs(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [oeeData, totalOrders, inProgressOrders, completedOrders, plannedOrders, heldOrders] =
      await Promise.all([
        this.prisma.oEERecord.aggregate({
          where: { ...factoryFilter, recordDate: { gte: dayStart } },
          _avg: { oee: true, availability: true, performance: true, quality: true },
        }),
        this.prisma.workOrder.count({ where: { ...factoryFilter, deletedAt: null } }),
        this.prisma.workOrder.count({ where: { ...factoryFilter, status: 'IN_PROGRESS' } }),
        this.prisma.workOrder.count({ where: { ...factoryFilter, status: 'COMPLETED' } }),
        this.prisma.workOrder.count({ where: { ...factoryFilter, status: { in: ['PLANNED', 'RELEASED'] } } }),
        this.prisma.workOrder.count({ where: { ...factoryFilter, status: 'ON_HOLD' } }),
      ]);

    return {
      oee: oeeData._avg.oee ?? 0,
      availability: oeeData._avg.availability ?? 0,
      performance: oeeData._avg.performance ?? 0,
      quality: oeeData._avg.quality ?? 0,
      totalOrders,
      inProgressOrders,
      completedOrders,
      plannedOrders,
      heldOrders,
    };
  }

  async getOEESummary(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    // Current day averages
    const avg = await this.prisma.oEERecord.aggregate({
      where: { ...factoryFilter, recordDate: { gte: dayStart } },
      _avg: { oee: true, availability: true, performance: true, quality: true },
    });

    // Hourly trend for today (12 x 2h buckets)
    const records = await this.prisma.oEERecord.findMany({
      where: { ...factoryFilter, recordDate: { gte: dayStart } },
      select: { oee: true, recordDate: true },
      orderBy: { recordDate: 'asc' },
    });

    const buckets: Record<string, { sum: number; count: number }> = {};
    for (const r of records) {
      const hour = new Date(r.recordDate).getHours();
      const label = `${String(hour).padStart(2, '0')}:00`;
      if (!buckets[label]) buckets[label] = { sum: 0, count: 0 };
      buckets[label].sum += r.oee ?? 0;
      buckets[label].count += 1;
    }
    const trend = Object.entries(buckets).map(([period, { sum, count }]) => ({
      period,
      oee: Math.round((sum / count) * 10) / 10,
    }));

    // Per-equipment breakdown
    const byMachine = await this.prisma.oEERecord.groupBy({
      by: ['machineId'],
      where: { ...factoryFilter, recordDate: { gte: dayStart } },
      _avg: { oee: true, availability: true, performance: true, quality: true },
    });

    const machineIds = byMachine.map((r) => r.machineId).filter(Boolean) as string[];
    const machines = machineIds.length
      ? await this.prisma.machine.findMany({
          where: { id: { in: machineIds } },
          select: { id: true, name: true },
        })
      : [];
    const machineMap = Object.fromEntries(machines.map((m) => [m.id, m.name]));

    const byEquipment = byMachine.map((r) => ({
      name: machineMap[r.machineId ?? ''] ?? 'Unknown',
      oee: Math.round((r._avg.oee ?? 0) * 10) / 10,
      availability: Math.round((r._avg.availability ?? 0) * 10) / 10,
      performance: Math.round((r._avg.performance ?? 0) * 10) / 10,
      quality: Math.round((r._avg.quality ?? 0) * 10) / 10,
    }));

    return {
      current: {
        oee: Math.round((avg._avg.oee ?? 0) * 10) / 10,
        availability: Math.round((avg._avg.availability ?? 0) * 10) / 10,
        performance: Math.round((avg._avg.performance ?? 0) * 10) / 10,
        quality: Math.round((avg._avg.quality ?? 0) * 10) / 10,
      },
      trend,
      byEquipment,
    };
  }

  async getOEERecords(factoryId: string | null, filters: {
    machineId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { machineId, dateFrom, dateTo, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.OEERecordWhereInput = {
      ...factoryFilter,
      ...(machineId && { machineId }),
      ...(dateFrom && { recordDate: { gte: new Date(dateFrom) } }),
      ...(dateTo && { recordDate: { lte: new Date(dateTo) } }),
    };

    const [total, data] = await Promise.all([
      this.prisma.oEERecord.count({ where }),
      this.prisma.oEERecord.findMany({
        where,
        include: { machine: { select: { name: true, code: true } } },
        orderBy: { recordDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ────────────────────────────────────────────────────────────
  // BATCH RECORDS CRUD
  // ────────────────────────────────────────────────────────────

  async findBatches(factoryId: string | null, filters: {
    search?: string;
    status?: string;
    workOrderId?: string;
    skuId?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, status, workOrderId, skuId, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.BatchRecordWhereInput = {
      ...factoryFilter,
      ...(status && { status: status as any }),
      ...(workOrderId && { workOrderId }),
      ...(skuId && { skuId }),
      ...(search && {
        OR: [
          { batchNumber: { contains: search, mode: 'insensitive' as const } },
          { lotNumber: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.batchRecord.count({ where }),
      this.prisma.batchRecord.findMany({
        where,
        include: {
          workOrder: { select: { orderNumber: true, machine: { select: { name: true } } } },
          sku: { select: { name: true, code: true, itemNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map(b => ({
        ...b,
        yieldPct: b.quantity > 0 ? parseFloat(((b.goodQuantity / b.quantity) * 100).toFixed(1)) : 0,
        scrapPct: b.quantity > 0 ? parseFloat(((b.scrapQuantity / b.quantity) * 100).toFixed(1)) : 0,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createBatch(factoryId: string, dto: {
    workOrderId?: string;
    skuId?: string;
    batchNumber: string;
    lotNumber?: string;
    quantity: number;
    unit?: string;
    notes?: string;
  }) {
    return this.prisma.batchRecord.create({
      data: {
        factoryId,
        batchNumber: dto.batchNumber,
        lotNumber: dto.lotNumber,
        workOrderId: dto.workOrderId,
        skuId: dto.skuId,
        quantity: dto.quantity,
        unit: dto.unit ?? 'CARTON',
        notes: dto.notes,
        status: 'ACTIVE',
      },
      include: {
        workOrder: { select: { orderNumber: true } },
        sku: { select: { name: true, code: true } },
      },
    });
  }

  async updateBatch(factoryId: string | null, id: string, dto: {
    status?: string;
    quantity?: number;
    goodQuantity?: number;
    scrapQuantity?: number;
    notes?: string;
    lotNumber?: string;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const batch = await this.prisma.batchRecord.findFirst({ where: { id, ...factoryFilter } });
    if (!batch) throw new NotFoundException('Batch record not found');

    return this.prisma.batchRecord.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status as any }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.goodQuantity !== undefined && { goodQuantity: dto.goodQuantity }),
        ...(dto.scrapQuantity !== undefined && { scrapQuantity: dto.scrapQuantity }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.lotNumber !== undefined && { lotNumber: dto.lotNumber }),
      },
    });
  }

  async deleteBatch(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const batch = await this.prisma.batchRecord.findFirst({ where: { id, ...factoryFilter } });
    if (!batch) throw new NotFoundException('Batch record not found');
    if (batch.status === 'ACTIVE') {
      throw new BadRequestException('Cannot delete an active batch. Complete or reject it first.');
    }
    await this.prisma.batchRecord.delete({ where: { id } });
  }

  /**
   * Traceability & genealogy backbone, written at WO completion:
   *  1. Output BatchRecord (idempotent per WO) with real quantities.
   *  2. Per job-order step: STEP_COMPLETED TraceEvent carrying the unit flow
   *     (qtyIn/inUnit → qtyOut/outUnit, machine, cycle time).
   *  3. Per routing-step input material: MaterialConsumption
   *     (planned = qtyPerOutputUnit × step planned output; actual scaled by
   *     the WO's actual/planned ratio), FIFO-linked to the oldest ACTIVE
   *     MaterialLot of that material code, plus a CONSUMED TraceEvent —
   *     this is what the Genealogy explorer walks.
   */
  private async recordTraceability(
    wo: { id: string; factoryId: string; orderNumber: string; skuId: string | null; plannedQty: number; actualStart: Date | null },
    userId: string,
    actualQty: number,
    goodQty: number,
    scrapQty: number,
    actualEnd: Date,
  ) {
    try {
      const sku = wo.skuId
        ? await this.prisma.sKU.findUnique({ where: { id: wo.skuId }, select: { baseUnit: true, name: true, itemNumber: true } })
        : null;

      // 1) Output batch (idempotent)
      const batchNumber = `BATCH-${wo.orderNumber}`;
      const batch = await this.prisma.batchRecord.upsert({
        where: { batchNumber },
        update: {
          quantity: Math.round(actualQty),
          goodQuantity: Math.round(goodQty),
          scrapQuantity: Math.round(scrapQty),
          endTime: actualEnd,
          status: 'COMPLETED',
        },
        create: {
          factoryId: wo.factoryId,
          workOrderId: wo.id,
          skuId: wo.skuId,
          batchNumber,
          lotNumber: `LOT-${wo.orderNumber}`,
          status: 'COMPLETED',
          quantity: Math.round(actualQty),
          goodQuantity: Math.round(goodQty),
          scrapQuantity: Math.round(scrapQty),
          unit: sku?.baseUnit ?? 'CARTON',
          startTime: wo.actualStart ?? undefined,
          endTime: actualEnd,
        },
      });

      // 2+3) Steps with their routing materials
      const jos = await this.prisma.jobOrder.findMany({
        where: { workOrderId: wo.id },
        orderBy: { sequenceOrder: 'asc' },
        include: {
          machine: { select: { name: true, code: true } },
          routingStep: { include: { materials: true } },
        },
      });

      const actualRatio = wo.plannedQty > 0 ? actualQty / wo.plannedQty : 1;

      for (const jo of jos) {
        await this.prisma.traceEvent.create({
          data: {
            factoryId: wo.factoryId,
            entityType: 'PROD_WO',
            entityId: wo.id,
            entityCode: wo.orderNumber,
            eventType: 'STEP_COMPLETED',
            quantity: jo.plannedQtyOut ?? null,
            eventData: {
              step: jo.sequenceOrder,
              operation: jo.operationName,
              machine: jo.machine?.name ?? null,
              machineCode: jo.machine?.code ?? null,
              qtyIn: jo.plannedQtyIn,
              inUnit: jo.inputUnit,
              qtyOut: jo.plannedQtyOut,
              outUnit: jo.outputUnit,
              cycleTimeSec: jo.idealCycleTimeSec,
              batchNumber,
            },
            performedById: userId,
            performedAt: actualEnd,
            relatedType: 'BATCH',
            relatedId: batch.id,
          },
        });

        for (const m of jo.routingStep?.materials ?? []) {
          const plannedQty = m.qtyPerOutputUnit * (jo.plannedQtyOut ?? 0);
          const actualUsed = plannedQty * actualRatio;
          // FIFO genealogy link: oldest active lot of this material
          const lot = m.materialCode
            ? await this.prisma.materialLot.findFirst({
                where: { factoryId: wo.factoryId, materialCode: m.materialCode, status: 'ACTIVE' },
                orderBy: { receivedAt: 'asc' },
                select: { id: true, lotNumber: true },
              })
            : null;

          await this.prisma.materialConsumption.create({
            data: {
              factoryId: wo.factoryId,
              workOrderId: wo.id,
              batchRecordId: batch.id,
              materialLotId: lot?.id ?? null,
              materialCode: m.materialCode ?? m.name,
              materialName: m.name,
              quantityPlanned: Math.round(plannedQty * 1000) / 1000,
              quantityActual: Math.round(actualUsed * 1000) / 1000,
              unit: m.unit,
              consumedAt: actualEnd,
              consumedById: userId,
            },
          });

          await this.prisma.traceEvent.create({
            data: {
              factoryId: wo.factoryId,
              entityType: 'RAW_MATERIAL',
              entityId: m.rawMaterialId ?? m.id,
              entityCode: m.materialCode ?? m.name,
              eventType: 'CONSUMED',
              quantity: Math.round(actualUsed * 1000) / 1000,
              eventData: {
                material: m.name,
                unit: m.unit,
                step: jo.sequenceOrder,
                operation: jo.operationName,
                lotNumber: lot?.lotNumber ?? null,
                batchNumber,
                workOrder: wo.orderNumber,
              },
              performedById: userId,
              performedAt: actualEnd,
              relatedType: 'PROD_WO',
              relatedId: wo.id,
            },
          });
        }
      }

      // Batch-level completion event (genealogy root)
      await this.prisma.traceEvent.create({
        data: {
          factoryId: wo.factoryId,
          entityType: 'BATCH',
          entityId: batch.id,
          entityCode: batchNumber,
          eventType: 'BATCH_COMPLETED',
          quantity: actualQty,
          eventData: {
            workOrder: wo.orderNumber,
            sku: sku ? `${sku.itemNumber} ${sku.name}` : null,
            goodQty,
            scrapQty,
            unit: sku?.baseUnit ?? 'CARTON',
            steps: jos.length,
          },
          performedById: userId,
          performedAt: actualEnd,
          relatedType: 'PROD_WO',
          relatedId: wo.id,
        },
      });
    } catch (err) {
      // Traceability must never block production completion
      this.logger.error('Failed to record traceability for WO completion', err);
    }
  }

  // ────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ────────────────────────────────────────────────────────────

  private async assertTransition(
    factoryId: string | null,
    workOrderId: string,
    targetStatus: WorkOrderStatus,
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');

    const allowed = VALID_TRANSITIONS[wo.status];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition work order from ${wo.status} to ${targetStatus}. Allowed: [${allowed.join(', ')}]`,
      );
    }
    return wo;
  }

  private async updateMachineStatus(
    machineId: string,
    state: string,
    currentWOId: string | null,
    currentSKUId: string | null | undefined,
  ) {
    try {
      await this.prisma.machineCurrentStatus.upsert({
        where: { machineId },
        create: {
          machineId,
          state: state as 'RUNNING' | 'IDLE',
          currentWOId,
          currentSKUId: currentSKUId ?? null,
          goodCount: 0,
          rejectCount: 0,
        },
        update: {
          state: state as 'RUNNING' | 'IDLE',
          currentWOId,
          currentSKUId: currentSKUId ?? null,
          lastEventAt: new Date(),
          ...(state === 'IDLE' && { goodCount: 0, rejectCount: 0, downtimeMinutes: 0, runtimeMinutes: 0 }),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to update machine status for ${machineId}`, err);
    }
  }

  private async recordProductionEvent(
    factoryId: string,
    workOrderId: string | null,
    machineId: string | null | undefined,
    eventType: 'WO_STARTED' | 'WO_COMPLETED' | 'WO_PAUSED' | 'COUNT_UPDATE' | 'SCRAP_RECORDED',
    value?: number,
    metadata?: Record<string, unknown>,
  ) {
    try {
      await this.prisma.productionEvent.create({
        data: {
          factoryId,
          workOrderId,
          machineId: machineId ?? null,
          eventType,
          value: value ?? null,
          metadata: metadata as Prisma.InputJsonValue ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record production event', err);
    }
  }

  private async calculateAndStoreOEE(
    wo: {
      factoryId: string;
      id: string;
      machineId: string | null;
      skuId: string | null;
      plannedStart: Date;
      plannedEnd: Date;
      actualStart: Date | null;
      plannedCycleTime: number | null;
    },
    totalOutput: number,
    goodOutput: number,
    actualEnd: Date,
  ) {
    if (!wo.actualStart) return null;

    // Routed WOs carry machines on their job orders, not the header —
    // fall back to the first routed machine so OEE is still recorded.
    let machineId = wo.machineId;
    if (!machineId) {
      const firstJo = await this.prisma.jobOrder.findFirst({
        where: { workOrderId: wo.id, machineId: { not: null } },
        orderBy: { sequenceOrder: 'asc' },
        select: { machineId: true },
      });
      machineId = firstJo?.machineId ?? null;
    }
    if (!machineId) return null;

    try {
      const plannedStart = wo.actualStart;
      const plannedEnd = actualEnd;
      const plannedMinutes = (plannedEnd.getTime() - plannedStart.getTime()) / 60_000;

      // Calculate downtime during this WO
      const downtimeEvents = await this.prisma.downtimeEvent.findMany({
        where: {
          workOrderId: wo.id,
          isPlanned: false,
          endTime: { not: null },
        },
      });
      const downtimeMinutes = downtimeEvents.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);

      const idealCycleTime = wo.plannedCycleTime
        ? wo.plannedCycleTime / 60   // convert seconds → minutes
        : null;

      const result = this.oeeService.calculate({
        plannedProductionTime: plannedMinutes,
        downtime: downtimeMinutes,
        idealCycleTime: idealCycleTime ?? (plannedMinutes / (totalOutput || 1)),
        totalCount: totalOutput,
        goodCount: goodOutput,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await this.prisma.oEERecord.create({
        data: {
          factoryId: wo.factoryId,
          machineId,
          recordDate: today,
          plannedProductionMin: plannedMinutes,
          actualProductionMin: plannedMinutes - downtimeMinutes,
          uptimeMin: result.actualRunTime,
          downtimeMin: downtimeMinutes,
          totalOutput,
          goodOutput,
          scrapOutput: totalOutput - goodOutput,
          idealCycleTime: idealCycleTime ?? null,
          availability: result.availability,
          performance: result.performance,
          quality: result.quality,
          oee: result.oee,
        },
      });

      // Update work order with OEE values
      await this.prisma.workOrder.update({
        where: { id: wo.id },
        data: {
          oee: result.oee,
          availability: result.availability,
          performance: result.performance,
          quality: result.quality,
          downtimeMinutes,
        },
      });

      return result;
    } catch (err) {
      this.logger.error('Failed to calculate/store OEE', err);
      return null;
    }
  }

  private mapWorkOrder(wo: any) {
    return {
      id: wo.id,
      orderNumber: wo.orderNumber,
      productName: wo.sku?.name ?? '',
      productCode: wo.sku?.code ?? '',
      itemNumber: wo.sku?.itemNumber ?? '',
      status: wo.status,
      priority: wo.priority,
      plannedQty: wo.plannedQty,
      actualQty: wo.actualQty ?? 0,
      goodQty: wo.goodQty ?? 0,
      scrapQty: wo.scrapQty ?? 0,
      reworkQty: wo.reworkQty ?? 0,
      progress: this.calcProgress(wo),
      plannedStart: wo.plannedStart.toISOString(),
      actualStart: wo.actualStart?.toISOString(),
      plannedEnd: wo.plannedEnd.toISOString(),
      actualEnd: wo.actualEnd?.toISOString(),
      machine: wo.machine?.name ?? '',
      machineCode: wo.machine?.code ?? '',
      line: wo.line?.name ?? '',
      operator: wo.operator?.name ?? '',
      supervisor: wo.supervisor?.name ?? '',
      oee: wo.oee,
      availability: wo.availability,
      performance: wo.performance,
      quality: wo.quality,
    };
  }

  private calcProgress(wo: { status: string; actualQty: number; plannedQty: number }): number {
    if (wo.status === 'COMPLETED') return 100;
    if (wo.status === 'CANCELLED') return 0;
    if (!wo.actualQty) return 0;
    return Math.min(Math.round((wo.actualQty / wo.plannedQty) * 100), 100);
  }

  private async generateOrderNumber(factoryId: string): Promise<string> {
    const today = new Date();
    const prefix = `WO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastOrder = await this.prisma.workOrder.findFirst({
      where: { factoryId, orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
    });

    const seq = lastOrder ? parseInt(lastOrder.orderNumber.slice(-4), 10) + 1 : 1;
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  // ────────────────────────────────────────────────────────────
  // JOB ORDERS (ISA-95 Dispatch List — per RoutingStep per WO)
  // ────────────────────────────────────────────────────────────

  async listAllJobOrders(
    factoryId: string | null,
    filters: { status?: string; workOrderId?: string },
  ) {
    const where: any = {
      ...(factoryId ? { factoryId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.workOrderId ? { workOrderId: filters.workOrderId } : {}),
    };

    const jos = await this.prisma.jobOrder.findMany({
      where,
      orderBy: [{ workOrderId: 'asc' }, { sequenceOrder: 'asc' }],
      include: {
        machine: { select: { name: true, code: true } },
        workCenter: { select: { name: true, code: true } },
        workOrder: {
          select: {
            id: true, orderNumber: true,
            sku: { select: { name: true, code: true } },
            productionOrder: { select: { orderNumber: true } },
          },
        },
        operator: { select: { id: true, name: true, nameAr: true } },
        predecessor: {
          select: { id: true, operationName: true, status: true, routingStepId: true, actualStart: true },
        },
      },
    });

    const withDep = await this.attachDepTypes(jos);
    return withDep.map((jo) => ({ ...jo, ...this.calcJobOrderOEE(jo) }));
  }

  /** Bulk-attach depType to a list of job orders without N+1 queries */
  private async attachDepTypes(jos: any[]): Promise<any[]> {
    const pairs = jos
      .filter((j) => j.routingStepId && j.predecessor?.routingStepId)
      .map((j) => ({ from: j.predecessor.routingStepId as string, to: j.routingStepId as string }));

    const recs = pairs.length
      ? await this.prisma.stepDependency.findMany({
          where: { OR: pairs.map((p) => ({ fromStepId: p.from, toStepId: p.to })) },
          select: { fromStepId: true, toStepId: true, type: true },
        })
      : [];

    const depMap = new Map(recs.map((r) => [`${r.fromStepId}:${r.toStepId}`, r.type as string]));

    return jos.map((jo) => ({
      ...jo,
      depType: jo.predecessor?.routingStepId && jo.routingStepId
        ? (depMap.get(`${jo.predecessor.routingStepId as string}:${jo.routingStepId as string}`) ?? 'FINISH_TO_START')
        : null,
    }));
  }

  async getJobOrders(factoryId: string | null, workOrderId: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');

    const jos = await this.prisma.jobOrder.findMany({
      where: { workOrderId },
      include: {
        machine: { select: { name: true, code: true, machineType: true } },
        workCenter: { select: { name: true, code: true } },
        routingStep: { select: { stepNumber: true, operationName: true } },
        materials: true,
        operator: { select: { id: true, name: true, nameAr: true } },
        predecessor: {
          select: { id: true, operationName: true, status: true, routingStepId: true, actualStart: true },
        },
        successors: { select: { id: true, operationName: true, status: true } },
      },
      orderBy: { sequenceOrder: 'asc' },
    });

    const withDep = await this.attachDepTypes(jos);
    return withDep.map((jo) => ({ ...jo, ...this.calcJobOrderOEE(jo) }));
  }

  async generateJobOrders(
    factoryId: string | null,
    workOrderId: string,
    dto: { plannedStart?: string; plannedEnd?: string; clearExisting?: boolean },
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, ...factoryFilter, deletedAt: null },
      include: {
        sku: true,
        productionOrder: { select: { orderNumber: true, unit: true } },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (!wo.skuId) throw new BadRequestException('Work order has no product (SKU) assigned');

    // Resolve manufacturing process for this SKU by scope priority:
    // 1) PRODUCT (direct)  2) PRODUCT_LIST (membership)
    // 3) CATEGORY (same category)  4) BASE_WEIGHT (same base weight)
    const stepsInclude = {
      routingSteps: {
        include: {
          machine: { select: { id: true, name: true, code: true } },
          workCenterRef: { select: { id: true, name: true, code: true } },
          // Typed routing relations (FS/SS/SF/FF + lag) — copied onto job orders
          predecessors: { select: { fromStepId: true, type: true, lagMins: true } },
        },
        orderBy: { stepNumber: 'asc' as const },
      },
    };
    const skuInfo = await this.prisma.sKU.findUnique({
      where: { id: wo.skuId },
      select: { categoryId: true, baseWeightId: true },
    });
    const scopeQueries: Prisma.ManufacturingProcessWhereInput[] = [
      { scopeType: 'PRODUCT', skuId: wo.skuId },
      { scopeType: 'PRODUCT_LIST', skuLinks: { some: { skuId: wo.skuId } } },
      ...(skuInfo?.categoryId ? [{ scopeType: 'CATEGORY' as const, categoryId: skuInfo.categoryId }] : []),
      ...(skuInfo?.baseWeightId ? [{ scopeType: 'BASE_WEIGHT' as const, baseWeightId: skuInfo.baseWeightId }] : []),
    ];
    let process: (Prisma.ManufacturingProcessGetPayload<{ include: typeof stepsInclude }>) | null = null;
    for (const scopeWhere of scopeQueries) {
      process = await this.prisma.manufacturingProcess.findFirst({
        where: { ...scopeWhere, isActive: true },
        include: stepsInclude,
        orderBy: { version: 'desc' },
      });
      if (process) break;
    }

    if (!process || process.routingSteps.length === 0) {
      throw new BadRequestException(
        'No active manufacturing process with routing steps found for this product. ' +
        'Configure a Manufacturing Process first.',
      );
    }

    const resolvedFactoryId = factoryId ?? wo.factoryId;

    if (dto.clearExisting) {
      await this.prisma.jobOrder.deleteMany({ where: { workOrderId } });
    } else {
      const existing = await this.prisma.jobOrder.count({ where: { workOrderId } });
      if (existing > 0) {
        throw new BadRequestException(
          `Work order already has ${existing} job orders. ` +
          'Pass clearExisting:true to regenerate.',
        );
      }
    }

    // Compute time window for distributing JOs
    const startMs = dto.plannedStart
      ? new Date(dto.plannedStart).getTime()
      : wo.plannedStart.getTime();
    const endMs = dto.plannedEnd
      ? new Date(dto.plannedEnd).getTime()
      : wo.plannedEnd.getTime();
    const steps = process.routingSteps;
    const slotMs = steps.length > 0 ? (endMs - startMs) / steps.length : 0;

    // Packaging specs for unit-flow calculation
    const skuPkg = {
      unitsPerInner: wo.sku?.unitsPerInner ?? 1,
      innersPerCarton: wo.sku?.innersPerCarton ?? 1,
      cartonsPerPallet: wo.sku?.cartonsPerPallet ?? 1,
    };
    const ppc = Math.max(1, skuPkg.unitsPerInner * skuPkg.innersPerCarton);
    const poUnit = (wo.productionOrder as any)?.unit ?? 'PIECE';
    // Normalise WO.plannedQty to PIECE base
    let prevOutputQty: number = poUnit === 'CARTON' ? wo.plannedQty * ppc
      : poUnit === 'PALLET' ? wo.plannedQty * ppc * skuPkg.cartonsPerPallet
      : wo.plannedQty;
    let prevOutputUnit = 'PIECE';

    const created: any[] = [];
    let prevId: string | null = null;
    const stepToJo = new Map<string, string>(); // routingStepId → created JO id

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Routing-defined predecessor (typed FS/SS/SF/FF + lag); falls back to
      // the sequential chain when the routing has no dependency rows.
      const routedDep = step.predecessors?.find((d) => stepToJo.has(d.fromStepId));
      const predecessorId = routedDep ? stepToJo.get(routedDep.fromStepId)! : prevId;
      const predecessorType = routedDep?.type ?? 'FINISH_TO_START';
      const predecessorLagMins = routedDep?.lagMins ?? 0;

      // Resolve machine via helper (WorkCenter fallback)
      const resolvedMachine = await this.resolveStepMachine(step, factoryId);
      const resolvedMachineId = resolvedMachine?.id ?? null;

      // Look up ideal cycle time for this machine × product
      const cycleTime = resolvedMachineId
        ? await this.prisma.machineCycleTime.findFirst({
            where: { machineId: resolvedMachineId, skuId: wo.skuId, isActive: true },
          })
        : null;

      const jPlannedStart = new Date(startMs + i * slotMs);
      const jPlannedEnd = new Date(startMs + (i + 1) * slotMs);

      // Routing step seconds are THE reference for JO cycle/duration;
      // machine×SKU cycle table is the fallback, legacy minutes last.
      const idealCycleTimeSec: number | null = step.cycleTimeSec
        ?? cycleTime?.cycleTimeSeconds
        ?? (step.cycleTimeMins != null ? step.cycleTimeMins * 60 : null);

      // Unit flow: the routing step's explicit In/Out units win;
      // the operation-name heuristic is only a fallback for legacy routings.
      const inputUnit  = step.inUnit ?? prevOutputUnit;
      const outputUnit = step.outUnit ?? this.resolveStepOutputUnit(step.operationName, inputUnit);
      const inputQty   = this.convertUnits(prevOutputQty, prevOutputUnit, inputUnit, skuPkg);
      const outputQty  = this.convertUnits(inputQty, inputUnit, outputUnit, skuPkg);

      const jo: Record<string, unknown> = await this.prisma.jobOrder.create({
        data: {
          factoryId: resolvedFactoryId,
          workOrderId,
          routingStepId: step.id,
          machineId: resolvedMachineId,
          workCenterId: step.workCenterId ?? null,
          sequenceOrder: step.stepNumber,
          operationName: step.operationName,
          status: i === 0 ? 'READY' : 'SCHEDULED',
          predecessorId,
          predecessorType: predecessorType as any,
          predecessorLagMins,
          plannedStart: jPlannedStart,
          plannedEnd: jPlannedEnd,
          plannedQtyIn: inputQty,
          plannedQtyOut: outputQty,
          inputUnit,
          outputUnit,
          idealCycleTimeSec,
        },
        include: {
          machine: { select: { name: true, code: true } },
          workCenter: { select: { name: true, code: true } },
        },
      });

      prevOutputUnit = outputUnit;
      prevOutputQty  = outputQty;
      created.push(jo);
      prevId = jo['id'] as string;
      stepToJo.set(step.id, prevId);
    }

    this.logger.log(
      `Generated ${created.length} job orders for WO ${wo.orderNumber} ` +
      `(Process: ${process.name} v${process.version})`,
    );

    return { created: created.length, jobOrders: created, process: { name: process.name, version: process.version } };
  }

  async updateJobOrderStatus(
    factoryId: string | null,
    jobOrderId: string,
    status: string,
    dto: { actualQtyGood?: number; actualQtyRejected?: number; handoverQty?: number; notes?: string },
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const jo = await this.prisma.jobOrder.findFirst({
      where: { id: jobOrderId, ...factoryFilter },
      include: {
        predecessor: {
          select: {
            id: true, operationName: true, status: true,
            routingStepId: true, actualStart: true,
          },
        },
      },
    });
    if (!jo) throw new NotFoundException('Job order not found');

    const VALID_JO_TRANSITIONS: Record<string, string[]> = {
      SCHEDULED: ['READY', 'CANCELLED'],
      READY:     ['EXECUTING', 'CANCELLED'],
      EXECUTING: ['PAUSED', 'COMPLETE', 'CANCELLED'],
      PAUSED:    ['EXECUTING', 'CANCELLED'],
      COMPLETE:  [],
      CANCELLED: [],
    };

    const allowed = VALID_JO_TRANSITIONS[jo.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition job order from ${jo.status} to ${status}. ` +
        `Allowed: [${allowed.join(', ')}]`,
      );
    }

    // ── Dependency-aware start validation (→ EXECUTING) ──────────────────
    if (status === 'EXECUTING' && (jo as any).predecessor) {
      const pred = (jo as any).predecessor;
      const dep = await this.lookupDepType(pred.routingStepId, jo.routingStepId);

      if (dep === 'FINISH_TO_START' && pred.status !== 'COMPLETE') {
        throw new BadRequestException(
          `FS dependency: "${pred.operationName}" must FINISH before "${jo.operationName}" can start.`,
        );
      }
      if (dep === 'START_TO_START' && !['EXECUTING', 'COMPLETE'].includes(pred.status)) {
        throw new BadRequestException(
          `SS dependency: "${pred.operationName}" must START before "${jo.operationName}" can start.`,
        );
      }
      // SF and FF impose NO start restriction — B can start independently
    }

    // ── Dependency-aware complete validation (→ COMPLETE) ────────────────
    if (status === 'COMPLETE' && (jo as any).predecessor) {
      const pred = (jo as any).predecessor;
      const dep = await this.lookupDepType(pred.routingStepId, jo.routingStepId);

      if (dep === 'FINISH_TO_FINISH' && pred.status !== 'COMPLETE') {
        throw new BadRequestException(
          `FF dependency: "${pred.operationName}" must FINISH before "${jo.operationName}" can complete.`,
        );
      }
      if (dep === 'START_TO_FINISH' && !pred.actualStart) {
        throw new BadRequestException(
          `SF dependency: "${pred.operationName}" must START before "${jo.operationName}" can complete.`,
        );
      }
    }

    const updated = await this.prisma.jobOrder.update({
      where: { id: jobOrderId },
      data: {
        status: status as any,
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(status === 'EXECUTING' && !jo.actualStart && { actualStart: new Date() }),
        ...(status === 'COMPLETE' && {
          actualEnd: new Date(),
          // auto-set handoverQty so successor step receives the right qty
          handoverQty: dto.handoverQty ?? dto.actualQtyGood ?? (jo as any).plannedQtyOut ?? 0,
        }),
        ...(dto.actualQtyGood !== undefined && { actualQtyGood: dto.actualQtyGood }),
        ...(dto.actualQtyRejected !== undefined && { actualQtyRejected: dto.actualQtyRejected }),
        ...(dto.handoverQty !== undefined && { handoverQty: dto.handoverQty }),
      },
    });

    // ── Auto-promote successors based on their dep type ───────────────────
    const successors = await this.prisma.jobOrder.findMany({
      where: { predecessorId: jobOrderId, status: 'SCHEDULED' },
    });

    for (const succ of successors) {
      const dep = await this.lookupDepType(jo.routingStepId, succ.routingStepId);
      let shouldPromote = false;

      // FS: promote on predecessor COMPLETE
      if (status === 'COMPLETE' && dep === 'FINISH_TO_START') shouldPromote = true;
      // SS: promote on predecessor EXECUTING (parallel start!)
      if (status === 'EXECUTING' && dep === 'START_TO_START') shouldPromote = true;
      // FF: B can start anytime → promote immediately on first transition of predecessor
      if (dep === 'FINISH_TO_FINISH' && ['EXECUTING', 'COMPLETE'].includes(status)) shouldPromote = true;
      // SF: B must start before A → promote immediately (unusual ordering)
      if (dep === 'START_TO_FINISH') shouldPromote = true;

      if (shouldPromote) {
        const transferQty = dto.handoverQty ?? updated.actualQtyGood ?? 0;
        if (transferQty >= (succ.handoverCriteria ?? 0)) {
          await this.prisma.jobOrder.update({ where: { id: succ.id }, data: { status: 'READY' } });
          this.logger.log(`[${dep}] "${succ.operationName}" promoted READY after "${jo.operationName}" → ${status}`);
        }
      }
    }

    return updated;
  }

  /** Report actual output quantities for an EXECUTING or COMPLETE job order.
   *  Does NOT change the status — pure qty update so operators can log partial progress. */
  async reportJobOrderOutput(
    factoryId: string | null,
    jobOrderId: string,
    dto: {
      actualQtyGood: number;
      actualQtyRejected?: number;
      scrapReason?: string;
      scrapCategory?: string;
    },
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const jo = await this.prisma.jobOrder.findFirst({ where: { id: jobOrderId, ...factoryFilter } });
    if (!jo) throw new NotFoundException('Job order not found');
    if (!['EXECUTING', 'PAUSED', 'COMPLETE'].includes(jo.status)) {
      throw new BadRequestException(
        `Can only report output for EXECUTING, PAUSED, or COMPLETE job orders (current: ${jo.status})`,
      );
    }

    const newRejected = dto.actualQtyRejected ?? jo.actualQtyRejected;
    const delta = Math.max(0, newRejected - jo.actualQtyRejected);

    const updated = await this.prisma.jobOrder.update({
      where: { id: jobOrderId },
      data: {
        actualQtyGood: dto.actualQtyGood,
        actualQtyRejected: newRejected,
        ...(dto.scrapReason !== undefined && { scrapReason: dto.scrapReason }),
      },
    });

    // Create audit trail entry whenever new scrap is added
    if (delta > 0) {
      const validCategories = ['QUALITY','SETUP','DAMAGE','OVERRUN','MATERIAL','MACHINE','OPERATOR','OTHER'];
      const category = (validCategories.includes(dto.scrapCategory ?? '') ? dto.scrapCategory : 'OTHER') as any;
      await this.prisma.scrapLog.create({
        data: {
          factoryId: jo.factoryId,
          workOrderId: jo.workOrderId,
          jobOrderId: jo.id,
          operatorId: jo.operatorId ?? null,
          qty: delta,
          reason: dto.scrapReason || 'Not specified',
          category,
        },
      });
    }

    return updated;
  }

  async listScrapLogs(
    factoryId: string | null,
    filters: { workOrderId?: string; jobOrderId?: string; category?: string; from?: string; to?: string; limit?: number },
  ) {
    const where: any = {
      ...(factoryId ? { factoryId } : {}),
      ...(filters.workOrderId ? { workOrderId: filters.workOrderId } : {}),
      ...(filters.jobOrderId  ? { jobOrderId: filters.jobOrderId }   : {}),
      ...(filters.category    ? { category: filters.category }        : {}),
      ...((filters.from || filters.to) ? {
        createdAt: {
          ...(filters.from ? { gte: new Date(filters.from) } : {}),
          ...(filters.to   ? { lte: new Date(filters.to)   } : {}),
        },
      } : {}),
    };

    return this.prisma.scrapLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 200, 500),
      include: {
        jobOrder:  { select: { operationName: true, sequenceOrder: true, outputUnit: true } },
        workOrder: { select: { orderNumber: true, sku: { select: { name: true, code: true } } } },
        operator:  { select: { name: true } },
      },
    });
  }

  async assignJobOrderOperator(
    factoryId: string | null,
    jobOrderId: string,
    operatorId: string | null,
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const jo = await this.prisma.jobOrder.findFirst({ where: { id: jobOrderId, ...factoryFilter } });
    if (!jo) throw new NotFoundException('Job order not found');

    if (operatorId) {
      const user = await this.prisma.user.findUnique({ where: { id: operatorId } });
      if (!user) throw new NotFoundException('Operator not found');
    }

    return this.prisma.jobOrder.update({
      where: { id: jobOrderId },
      data: { operatorId },
      include: { operator: { select: { id: true, name: true, nameAr: true } } },
    });
  }

  // ────────────────────────────────────────────────────────────
  // OEE PER JOB ORDER
  // ────────────────────────────────────────────────────────────

  private calcJobOrderOEE(jo: any): {
    joQuality: number | null;
    joPerformance: number | null;
    joAvailability: number | null;
    joOEE: number | null;
  } {
    const totalProduced = (jo.actualQtyGood ?? 0) + (jo.actualQtyRejected ?? 0);

    // Quality
    const joQuality: number | null =
      totalProduced > 0
        ? parseFloat(((jo.actualQtyGood / totalProduced) * 100).toFixed(1))
        : null;

    // Operating time in seconds
    let operatingTimeSec: number | null = null;
    if (jo.actualStart) {
      const startMs = new Date(jo.actualStart).getTime();
      const endMs   = jo.actualEnd ? new Date(jo.actualEnd).getTime() : Date.now();
      operatingTimeSec = (endMs - startMs) / 1000;
    }

    // Performance: only if idealCycleTimeSec > 0 and operatingTimeSec > 0
    let joPerformance: number | null = null;
    if (
      jo.idealCycleTimeSec != null &&
      jo.idealCycleTimeSec > 0 &&
      operatingTimeSec != null &&
      operatingTimeSec > 0
    ) {
      const raw = ((jo.idealCycleTimeSec * totalProduced) / operatingTimeSec) * 100;
      joPerformance = parseFloat(Math.min(100, raw).toFixed(1));
    }

    // Availability: only if plannedStart and plannedEnd exist
    let joAvailability: number | null = null;
    if (jo.plannedStart && jo.plannedEnd && operatingTimeSec != null) {
      const plannedDurationSec =
        (new Date(jo.plannedEnd).getTime() - new Date(jo.plannedStart).getTime()) / 1000;
      if (plannedDurationSec > 0) {
        const raw = (operatingTimeSec / plannedDurationSec) * 100;
        joAvailability = parseFloat(Math.min(100, raw).toFixed(1));
      }
    }

    // OEE
    let joOEE: number | null = null;
    if (joAvailability != null && joPerformance != null && joQuality != null) {
      joOEE = parseFloat(
        ((joAvailability / 100) * (joPerformance / 100) * (joQuality / 100) * 100).toFixed(1),
      );
    } else if (joQuality != null) {
      joOEE = joQuality;
    }

    return { joQuality, joPerformance, joAvailability, joOEE };
  }

  async deleteJobOrders(factoryId: string | null, workOrderId: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, ...factoryFilter, deletedAt: null },
    });
    if (!wo) throw new NotFoundException('Work order not found');

    const active = await this.prisma.jobOrder.count({
      where: { workOrderId, status: { in: ['EXECUTING', 'PAUSED'] } },
    });
    if (active > 0) {
      throw new ConflictException('Cannot delete job orders while any are EXECUTING or PAUSED.');
    }

    const { count } = await this.prisma.jobOrder.deleteMany({ where: { workOrderId } });
    return { deleted: count };
  }
}
