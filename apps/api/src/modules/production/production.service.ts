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

    const [sku, machine] = await Promise.all([
      this.prisma.sKU.findFirst({ where: { id: dto.skuId, ...factoryFilter } }),
      this.prisma.machine.findFirst({ where: { id: dto.machineId, ...factoryFilter } }),
    ]);

    if (!sku) throw new NotFoundException('SKU not found or not in your factory');
    if (!machine) throw new NotFoundException('Machine not found or not in your factory');

    if (dto.productionOrderId) {
      const po = await this.prisma.productionOrder.findFirst({
        where: { id: dto.productionOrderId, ...factoryFilter },
      });
      if (!po) throw new NotFoundException('Production order not found');
    }

    // Warn if another IN_PROGRESS WO exists for this machine
    const activeWO = await this.prisma.workOrder.findFirst({
      where: { machineId: dto.machineId, status: 'IN_PROGRESS', deletedAt: null },
    });
    if (activeWO) {
      this.logger.warn(`Machine ${machine.code} already has an active WO: ${activeWO.orderNumber}`);
    }

    const resolvedFactoryId = factoryId ?? machine.factoryId;
    const orderNumber = await this.generateOrderNumber(resolvedFactoryId);

    // Look up ideal cycle time for performance calculation
    const cycleTime = await this.prisma.machineCycleTime.findFirst({
      where: { machineId: dto.machineId, skuId: dto.skuId, isActive: true },
    });

    const workOrder = await this.prisma.workOrder.create({
      data: {
        factoryId: resolvedFactoryId,
        orderNumber,
        skuId: dto.skuId,
        machineId: dto.machineId,
        lineId: dto.lineId ?? machine.lineId,
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
    this.logger.log(`Work order ${orderNumber} created for machine ${machine.code}`);

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
        },
        orderBy: [{ priority: 'desc' }, { plannedStart: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((wo) => this.mapWorkOrder(wo)),
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
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    return wo;
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

  async previewAutoGenerateWOs(factoryId: string | null, poId: string): Promise<any> {
    const factoryFilter = factoryId ? { factoryId } : {};
    const po = await this.prisma.productionOrder.findFirst({
      where: { id: poId, ...factoryFilter, deletedAt: null },
      include: { sku: true },
    });
    if (!po) throw new NotFoundException('Production order not found');
    if (!po.skuId) throw new BadRequestException('Production order has no SKU assigned');
    if (!['RELEASED', 'IN_PROGRESS'].includes(po.status)) {
      throw new BadRequestException(`Release the PO first before auto-generating work orders (current: ${po.status})`);
    }

    // Find approved recipe for this SKU
    const recipe: any = await this.prisma.recipe.findFirst({
      where: { skuId: po.skuId, status: 'APPROVED' as any, ...(factoryId ? { factoryId } : {}) },
      orderBy: { approvedAt: 'desc' },
      include: {
        process: {
          include: {
            routingSteps: {
              where: { isOptional: false },
              orderBy: { stepNumber: 'asc' },
              include: { machine: { select: { id: true, name: true, code: true, machineType: true } } },
            },
          },
        },
      },
    });

    // Fallback: any active manufacturing process for the SKU
    const process: any = recipe?.process ?? await this.prisma.manufacturingProcess.findFirst({
      where: { skuId: po.skuId, isActive: true, ...(factoryId ? { factoryId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        routingSteps: {
          where: { isOptional: false },
          orderBy: { stepNumber: 'asc' },
          include: { machine: { select: { id: true, name: true, code: true, machineType: true } } },
        },
      },
    });

    const steps: any[] = process?.routingSteps ?? [];
    const stepsWithMachine: any[] = steps.filter((s: any) => s.machineId && s.machine);

    // Existing WO count for this PO
    const existingWOCount = await this.prisma.workOrder.count({ where: { productionOrderId: poId, deletedAt: null } });

    if (stepsWithMachine.length === 0) {
      // No routing — fallback to single WO on first available packing machine
      const fallbackMachine = await this.prisma.machine.findFirst({
        where: { factoryId: factoryId ?? undefined, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      return {
        recipe: recipe ? { id: recipe.id, code: recipe.code, version: recipe.version, name: recipe.name } : null,
        process: null,
        steps: [],
        workOrdersToCreate: fallbackMachine ? [{
          stepNumber: 1, operationName: 'Production Run',
          machine: fallbackMachine ? { id: fallbackMachine.id, name: fallbackMachine.name } : null,
          plannedQty: po.targetQty, estimatedDurationMins: null,
        }] : [],
        existingWOCount,
        canGenerate: !!fallbackMachine,
        warning: 'No routing steps found. Will create a single work order on the primary machine.',
      };
    }

    // Calculate time distribution across steps
    const totalMins: number = process?.totalCycleTimeMins ?? stepsWithMachine.reduce((s: number, r: any) => s + (r.cycleTimeMins ?? 0), 0) ?? 0;
    const workOrdersToCreate = stepsWithMachine.map((step: any) => ({
      stepNumber: step.stepNumber,
      operationName: step.operationName,
      machine: step.machine ? { id: step.machine.id, name: step.machine.name, code: step.machine.code } : null,
      plannedQty: po.targetQty,
      estimatedDurationMins: step.cycleTimeMins ?? (totalMins / stepsWithMachine.length),
      setupTimeMins: step.setupTimeMins ?? 0,
    }));

    return {
      recipe: recipe ? { id: recipe.id, code: recipe.code, version: recipe.version, name: recipe.name } : null,
      process: process ? { id: process.id, name: process.name, totalCycleTimeMins: process.totalCycleTimeMins } : null,
      steps: workOrdersToCreate,
      workOrdersToCreate,
      existingWOCount,
      canGenerate: true,
      warning: existingWOCount > 0 ? `This PO already has ${existingWOCount} work order(s). New WOs will be added.` : null,
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
    const totalMs = end.getTime() - start.getTime();
    const steps: any[] = preview.workOrdersToCreate;
    const perStepMs = Math.floor(totalMs / (steps.length || 1));

    const year = new Date().getFullYear();
    const existing = await this.prisma.workOrder.count({ where: { factoryId } });

    const createdWOs: any[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.machine?.id) continue;

      const woStart = new Date(start.getTime() + i * perStepMs);
      const woEnd   = new Date(start.getTime() + (i + 1) * perStepMs);
      const orderNumber = `WO-${year}-${String(existing + i + 1).padStart(4, '0')}`;

      const machine = await this.prisma.machine.findFirst({ where: { id: step.machine.id } });

      const wo = await this.prisma.workOrder.create({
        data: {
          factoryId,
          productionOrderId: poId,
          skuId: po.skuId!,
          machineId: step.machine.id,
          lineId: machine?.lineId ?? null,
          orderNumber,
          status: 'PLANNED',
          priority: po.priority as any,
          plannedQty: step.plannedQty ?? po.targetQty,
          plannedStart: woStart,
          plannedEnd: woEnd,
          notes: `Auto-generated from PO ${po.orderNumber} — Step ${step.stepNumber}: ${step.operationName}`,
          createdById: userId,
        },
        include: {
          sku: { select: { name: true, code: true } },
          machine: { select: { name: true, code: true } },
        },
      });
      createdWOs.push(wo);
    }

    // Update PO status
    if (po.status === 'RELEASED') {
      await this.prisma.productionOrder.update({
        where: { id: poId },
        data: { status: 'IN_PROGRESS', actualStart: new Date() },
      });
    }

    this.logger.log(`Auto-generated ${createdWOs.length} WOs for PO ${po.orderNumber}`);
    return { created: createdWOs.length, workOrders: createdWOs };
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
    if (!wo.machineId || !wo.actualStart) return null;

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
          machineId: wo.machineId,
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
}
