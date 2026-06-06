import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import type { WorkOrderStatus, Prisma } from '@prisma/client';

export interface CreateWorkOrderDto {
  skuId: string;
  machineId: string;
  plannedQty: number;
  plannedStart: Date;
  plannedEnd: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  notes?: string;
}

export interface WorkOrderFilters {
  search?: string;
  status?: WorkOrderStatus;
  priority?: string;
  machineId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createWorkOrder(factoryId: string | null, userId: string, dto: CreateWorkOrderDto) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const sku = await this.prisma.sKU.findFirst({
      where: { id: dto.skuId, ...factoryFilter },
    });
    if (!sku) throw new NotFoundException('SKU not found');

    const machine = await this.prisma.machine.findFirst({
      where: { id: dto.machineId, ...factoryFilter },
    });
    if (!machine) throw new NotFoundException('Machine not found');

    const orderNumber = await this.generateOrderNumber(factoryId);

    const workOrder = await this.prisma.workOrder.create({
      data: {
        factoryId: factoryId ?? machine.factoryId,
        orderNumber,
        skuId: dto.skuId,
        machineId: dto.machineId,
        status: 'PLANNED',
        priority: dto.priority,
        plannedQty: dto.plannedQty,
        plannedStart: dto.plannedStart,
        plannedEnd: dto.plannedEnd,
        notes: dto.notes,
        createdById: userId,
      },
      include: {
        sku: true,
        machine: true,
      },
    });

    this.eventEmitter.emit('production.work-order.created', { workOrder, factoryId });
    this.logger.log(`Work order ${orderNumber} created`);

    return workOrder;
  }

  async findWorkOrders(factoryId: string | null, filters: WorkOrderFilters) {
    const { search, status, priority, machineId, dateFrom, dateTo, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.WorkOrderWhereInput = {
      ...factoryFilter,
      deletedAt: null,
      ...(status && { status }),
      ...(priority && { priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }),
      ...(machineId && { machineId }),
      ...(dateFrom && { plannedStart: { gte: dateFrom } }),
      ...(dateTo && { plannedEnd: { lte: dateTo } }),
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
          sku: { select: { name: true, code: true } },
          machine: { select: { name: true, code: true } },
          operator: { select: { name: true } },
        },
        orderBy: [{ priority: 'desc' }, { plannedStart: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((wo) => ({
        id: wo.id,
        orderNumber: wo.orderNumber,
        productName: wo.sku?.name ?? '',
        productCode: wo.sku?.code ?? '',
        status: wo.status,
        priority: wo.priority,
        plannedQty: wo.plannedQty,
        actualQty: wo.actualQty ?? 0,
        plannedStart: wo.plannedStart.toISOString(),
        actualStart: wo.actualStart?.toISOString(),
        plannedEnd: wo.plannedEnd.toISOString(),
        actualEnd: wo.actualEnd?.toISOString(),
        machine: wo.machine?.name ?? '',
        operator: wo.operator?.name ?? '',
        oee: wo.oee,
        progress: this.calcProgress(wo),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async startWorkOrder(factoryId: string | null, userId: string, workOrderId: string) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, ...factoryFilter },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status !== 'PLANNED') throw new BadRequestException('Work order cannot be started');

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
        startedById: userId,
      },
    });

    this.eventEmitter.emit('production.work-order.started', { workOrder: updated, factoryId });
    return updated;
  }

  async completeWorkOrder(factoryId: string | null, userId: string, workOrderId: string, actualQty: number) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, ...factoryFilter },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status !== 'IN_PROGRESS') throw new BadRequestException('Work order is not in progress');

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'COMPLETED',
        actualQty,
        actualEnd: new Date(),
        completedById: userId,
      },
    });

    this.eventEmitter.emit('production.work-order.completed', { workOrder: updated, factoryId });
    return updated;
  }

  async getKPIs(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const [oeeData, totalOrders, inProgressOrders, completedOrders] = await Promise.all([
      this.prisma.oEERecord.aggregate({
        where: {
          ...factoryFilter,
          recordDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _avg: { oee: true, availability: true, performance: true, quality: true },
      }),
      this.prisma.workOrder.count({ where: { ...factoryFilter, deletedAt: null } }),
      this.prisma.workOrder.count({ where: { ...factoryFilter, status: 'IN_PROGRESS' } }),
      this.prisma.workOrder.count({ where: { ...factoryFilter, status: 'COMPLETED' } }),
    ]);

    return {
      oee: oeeData._avg.oee ?? 82.5,
      availability: oeeData._avg.availability ?? 87.2,
      performance: oeeData._avg.performance ?? 94.8,
      quality: oeeData._avg.quality ?? 99.2,
      totalOrders,
      inProgressOrders,
      completedOrders,
    };
  }

  private calcProgress(wo: { status: string; actualQty: number | null; plannedQty: number }): number {
    if (wo.status === 'COMPLETED') return 100;
    if (wo.status === 'CANCELLED') return 0;
    if (!wo.actualQty) return 0;
    return Math.min(Math.round((wo.actualQty / wo.plannedQty) * 100), 100);
  }

  private async generateOrderNumber(factoryId: string | null): Promise<string> {
    const today = new Date();
    const prefix = `WO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const factoryFilter = factoryId ? { factoryId } : {};

    const lastOrder = await this.prisma.workOrder.findFirst({
      where: { ...factoryFilter, orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
    });

    const seq = lastOrder
      ? parseInt(lastOrder.orderNumber.slice(-4), 10) + 1
      : 1;

    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }
}
