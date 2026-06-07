import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StockMovementsService } from './stock-movements.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { type Prisma } from '@prisma/client';

export interface CreateRawMaterialDto {
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  category?: string;
  unit?: string;
  unitCost?: number;
  minStock?: number;
  maxStock?: number;
  reorderPoint?: number;
  storageLocation?: string;
  storageLocationId?: string;
  supplierName?: string;
  leadTimeDays?: number;
}

@Injectable()
export class RawMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovements: StockMovementsService,
    private readonly traceability: TraceabilityService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // LIST
  // ────────────────────────────────────────────────────────────

  async findAll(
    factoryId: string | null,
    filters: {
      search?: string;
      category?: string;
      lowStock?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const { search, category, lowStock, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.RawMaterialWhereInput = {
      ...factoryFilter,
      isActive: true,
      ...(category && { category }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { nameAr: { contains: search, mode: 'insensitive' as const } },
          { supplierName: { contains: search, mode: 'insensitive' as const } },
          { storageLocation: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.rawMaterial.count({ where }),
      this.prisma.rawMaterial.findMany({
        where,
        include: { storageLocationRef: { select: { id: true, code: true, name: true, zone: true } } },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    let result = data.map((m) => this.enrichMaterial(m));

    // Post-filter: low stock (currentStock <= reorderPoint or minStock)
    if (lowStock) {
      result = result.filter((m) => m.isLowStock);
    }

    return {
      data: result,
      total: lowStock ? result.length : total,
      page,
      limit,
      totalPages: Math.ceil((lowStock ? result.length : total) / limit),
    };
  }

  // ────────────────────────────────────────────────────────────
  // FIND BY ID
  // ────────────────────────────────────────────────────────────

  async findById(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const material = await this.prisma.rawMaterial.findFirst({
      where: { id, ...factoryFilter, isActive: true },
      include: { storageLocationRef: { select: { id: true, code: true, name: true, zone: true } } },
    });
    if (!material) throw new NotFoundException('Raw material not found');
    return this.enrichMaterial(material);
  }

  // ────────────────────────────────────────────────────────────
  // CREATE
  // ────────────────────────────────────────────────────────────

  async create(factoryId: string | null, dto: CreateRawMaterialDto, userId?: string) {
    const resolvedFactoryId = factoryId ?? (await this.getDefaultFactoryId());

    // Guard: duplicate code within factory
    const existing = await this.prisma.rawMaterial.findFirst({
      where: { factoryId: resolvedFactoryId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Raw material with code '${dto.code}' already exists`);
    }

    const material = await this.prisma.rawMaterial.create({
      data: {
        factoryId: resolvedFactoryId,
        code: dto.code,
        name: dto.name,
        nameAr: dto.nameAr,
        description: dto.description,
        category: dto.category,
        unit: dto.unit ?? 'KG',
        unitCost: dto.unitCost,
        minStock: dto.minStock ?? 0,
        maxStock: dto.maxStock,
        reorderPoint: dto.reorderPoint,
        storageLocation: dto.storageLocation,
        storageLocationId: dto.storageLocationId ?? null,
        supplierName: dto.supplierName,
        leadTimeDays: dto.leadTimeDays,
        currentStock: 0,
        isActive: true,
      },
      include: { storageLocationRef: { select: { id: true, code: true, name: true, zone: true } } },
    });

    await this.traceability.logEvent({
      factoryId: resolvedFactoryId,
      entityType: 'RAW_MATERIAL',
      entityId: material.id,
      entityCode: material.code,
      eventType: 'CREATED',
      toValue: dto.name,
      performedById: userId ?? null,
      notes: `Raw material '${material.code}' created`,
    });

    return this.enrichMaterial(material);
  }

  // ────────────────────────────────────────────────────────────
  // UPDATE
  // ────────────────────────────────────────────────────────────

  async update(
    factoryId: string | null,
    id: string,
    dto: Partial<Omit<CreateRawMaterialDto, 'code'>>,
    userId?: string,
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const material = await this.prisma.rawMaterial.findFirst({
      where: { id, ...factoryFilter, isActive: true },
    });
    if (!material) throw new NotFoundException('Raw material not found');

    const updated = await this.prisma.rawMaterial.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.unitCost !== undefined && { unitCost: dto.unitCost }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.maxStock !== undefined && { maxStock: dto.maxStock }),
        ...(dto.reorderPoint !== undefined && { reorderPoint: dto.reorderPoint }),
        ...(dto.storageLocation !== undefined && { storageLocation: dto.storageLocation }),
        ...(dto.storageLocationId !== undefined && { storageLocationId: dto.storageLocationId }),
        ...(dto.supplierName !== undefined && { supplierName: dto.supplierName }),
        ...(dto.leadTimeDays !== undefined && { leadTimeDays: dto.leadTimeDays }),
      },
      include: { storageLocationRef: { select: { id: true, code: true, name: true, zone: true } } },
    });

    await this.traceability.logEvent({
      factoryId: updated.factoryId,
      entityType: 'RAW_MATERIAL',
      entityId: updated.id,
      entityCode: updated.code,
      eventType: 'UPDATED',
      performedById: userId ?? null,
      notes: `Raw material '${updated.code}' updated`,
    });

    return this.enrichMaterial(updated);
  }

  // ────────────────────────────────────────────────────────────
  // DELETE (soft)
  // ────────────────────────────────────────────────────────────

  async delete(factoryId: string | null, id: string, userId?: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const material = await this.prisma.rawMaterial.findFirst({
      where: { id, ...factoryFilter, isActive: true },
    });
    if (!material) throw new NotFoundException('Raw material not found');

    await this.prisma.rawMaterial.update({ where: { id }, data: { isActive: false } });

    await this.traceability.logEvent({
      factoryId: material.factoryId,
      entityType: 'RAW_MATERIAL',
      entityId: material.id,
      entityCode: material.code,
      eventType: 'DELETED',
      performedById: userId ?? null,
      notes: `Raw material '${material.code}' deactivated`,
    });
  }

  // ────────────────────────────────────────────────────────────
  // ADJUST STOCK
  // ────────────────────────────────────────────────────────────

  async adjustStock(
    factoryId: string | null,
    id: string,
    quantity: number,
    reason: string,
    userId?: string,
  ) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const material = await this.prisma.rawMaterial.findFirst({
      where: { id, ...factoryFilter, isActive: true },
    });
    if (!material) throw new NotFoundException('Raw material not found');

    const stockBefore = material.currentStock;
    const stockAfter = parseFloat((stockBefore + quantity).toFixed(4));
    if (stockAfter < 0) {
      throw new BadRequestException(
        `Insufficient stock: ${stockBefore} ${material.unit} available, adjustment of ${quantity} would result in negative stock`,
      );
    }

    const updated = await this.prisma.rawMaterial.update({
      where: { id },
      data: { currentStock: stockAfter },
    });

    const movementType = quantity >= 0 ? 'ADJUSTMENT' : 'ADJUSTMENT';

    await this.stockMovements.record({
      factoryId: material.factoryId,
      entityType: 'RAW_MATERIAL',
      entityId: material.id,
      entityCode: material.code,
      entityName: material.name,
      movementType,
      quantity,
      unitCost: material.unitCost ?? undefined,
      stockBefore,
      stockAfter,
      referenceType: 'MANUAL_ADJUSTMENT',
      performedById: userId ?? null,
      notes: reason,
    });

    await this.traceability.logEvent({
      factoryId: material.factoryId,
      entityType: 'RAW_MATERIAL',
      entityId: material.id,
      entityCode: material.code,
      eventType: quantity >= 0 ? 'STOCK_IN' : 'STOCK_OUT',
      fromValue: String(stockBefore),
      toValue: String(stockAfter),
      quantity: Math.abs(quantity),
      performedById: userId ?? null,
      notes: reason,
    });

    return this.enrichMaterial(updated);
  }

  // ────────────────────────────────────────────────────────────
  // GET WITH MOVEMENTS
  // ────────────────────────────────────────────────────────────

  async getWithMovements(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const material = await this.prisma.rawMaterial.findFirst({
      where: { id, ...factoryFilter, isActive: true },
    });
    if (!material) throw new NotFoundException('Raw material not found');

    const movements = await this.prisma.stockMovement.findMany({
      where: { entityType: 'RAW_MATERIAL', entityId: id },
      include: {
        performedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      current: this.enrichMaterial(material),
      movements,
    };
  }

  // ────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ────────────────────────────────────────────────────────────

  private enrichMaterial(m: any) {
    const threshold = m.reorderPoint ?? m.minStock ?? 0;
    const stockValue = parseFloat((m.currentStock * (m.unitCost ?? 0)).toFixed(2));
    return {
      id: m.id,
      factoryId: m.factoryId,
      code: m.code,
      name: m.name,
      nameAr: m.nameAr,
      description: m.description,
      category: m.category,
      unit: m.unit,
      unitCost: m.unitCost,
      currentStock: m.currentStock,
      reservedStock: m.reservedStock,
      availableStock: parseFloat(Math.max(0, m.currentStock - m.reservedStock).toFixed(4)),
      minStock: m.minStock,
      maxStock: m.maxStock,
      reorderPoint: m.reorderPoint,
      storageLocation: m.storageLocationRef?.name ?? m.storageLocation,
      storageLocationId: m.storageLocationId,
      storageLocationRef: m.storageLocationRef ?? null,
      supplierName: m.supplierName,
      leadTimeDays: m.leadTimeDays,
      isActive: m.isActive,
      isLowStock: m.currentStock <= threshold,
      stockValue,
      createdAt: m.createdAt?.toISOString?.() ?? null,
      updatedAt: m.updatedAt?.toISOString?.() ?? null,
    };
  }

  private async getDefaultFactoryId(): Promise<string> {
    const factory = await this.prisma.factory.findFirst({ where: { isActive: true } });
    if (!factory) throw new NotFoundException('No active factory found');
    return factory.id;
  }
}
