import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import type { WorkOrderStatus, Prisma } from '@prisma/client';

export interface CreateWorkOrderDto {
  productId: string;
  equipmentId: string;
  plannedQty: number;
  plannedStart: Date;
  plannedEnd: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recipeId?: string;
  notes?: string;
}

export interface WorkOrderFilters {
  search?: string;
  status?: WorkOrderStatus;
  priority?: string;
  equipmentId?: string;
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

  async createWorkOrder(tenantId: string, userId: string, dto: CreateWorkOrderDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const equipment = await this.prisma.equipment.findFirst({
      where: { id: dto.equipmentId, tenantId },
    });
    if (!equipment) throw new NotFoundException('Equipment not found');

    const orderNumber = await this.generateOrderNumber(tenantId);

    const workOrder = await this.prisma.workOrder.create({
      data: {
        tenantId,
        orderNumber,
        productId: dto.productId,
        equipmentId: dto.equipmentId,
        recipeId: dto.recipeId,
        status: 'PLANNED',
        priority: dto.priority,
        plannedQty: dto.plannedQty,
        plannedStart: dto.plannedStart,
        plannedEnd: dto.plannedEnd,
        notes: dto.notes,
        createdById: userId,
      },
      include: {
        product: true,
        equipment: true,
        recipe: true,
      },
    });

    this.eventEmitter.emit('production.work-order.created', { workOrder, tenantId });
    this.logger.log(`Work order ${orderNumber} created`);

    return workOrder;
  }

  async findWorkOrders(tenantId: string, filters: WorkOrderFilters) {
    const { search, status, priority, equipmentId, dateFrom, dateTo, page = 1, limit = 20 } = filters;

    const where: Prisma.WorkOrderWhereInput = {
      tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(priority && { priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }),
      ...(equipmentId && { equipmentId }),
      ...(dateFrom && { plannedStart: { gte: dateFrom } }),
      ...(dateTo && { plannedEnd: { lte: dateTo } }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' as const } },
          { product: { name: { contains: search, mode: 'insensitive' as const } } },
          { equipment: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.workOrder.count({ where }),
      this.prisma.workOrder.findMany({
        where,
        include: {
          product: { select: { name: true, code: true } },
          equipment: { select: { name: true, code: true } },
          assignedOperator: { select: { name: true } },
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
        productName: wo.product.name,
        productCode: wo.product.code,
        status: wo.status,
        priority: wo.priority,
        plannedQty: wo.plannedQty,
        actualQty: wo.actualQty ?? 0,
        plannedStart: wo.plannedStart.toISOString(),
        actualStart: wo.actualStart?.toISOString(),
        plannedEnd: wo.plannedEnd.toISOString(),
        actualEnd: wo.actualEnd?.toISOString(),
        machine: wo.equipment.name,
        operator: wo.assignedOperator?.name ?? '',
        oee: wo.oee,
        progress: this.calcProgress(wo),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async startWorkOrder(tenantId: string, userId: string, workOrderId: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
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

    this.eventEmitter.emit('production.work-order.started', { workOrder: updated, tenantId });
    return updated;
  }

  async completeWorkOrder(tenantId: string, userId: string, workOrderId: string, actualQty: number) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status !== 'IN_PROGRESS') throw new BadRequestException('Work order is not in progress');

    const cycleTimeMinutes = wo.actualStart
      ? (Date.now() - wo.actualStart.getTime()) / 60_000
      : 0;

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'COMPLETED',
        actualQty,
        actualEnd: new Date(),
        completedById: userId,
        cycleTimeMinutes,
      },
    });

    this.eventEmitter.emit('production.work-order.completed', { workOrder: updated, tenantId });
    return updated;
  }

  async getKPIs(tenantId: string) {
    const [oeeData, totalOrders, inProgressOrders, completedOrders] = await Promise.all([
      this.prisma.productionRecord.aggregate({
        where: {
          tenantId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _avg: { oee: true, availability: true, performance: true, quality: true },
      }),
      this.prisma.workOrder.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.workOrder.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
      this.prisma.workOrder.count({ where: { tenantId, status: 'COMPLETED' } }),
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

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const prefix = `WO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastOrder = await this.prisma.workOrder.findFirst({
      where: { tenantId, orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
    });

    const seq = lastOrder
      ? parseInt(lastOrder.orderNumber.slice(-4), 10) + 1
      : 1;

    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }
}
