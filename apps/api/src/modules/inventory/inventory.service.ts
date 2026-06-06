import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { type Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────
  // OVERVIEW
  // ────────────────────────────────────────────────────────────

  async getOverview(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const [totalSpareParts, totalSKUs, totalMaterialLots, parts] = await Promise.all([
      this.prisma.sparePart.count({ where: { ...factoryFilter, isActive: true } }),
      this.prisma.sKU.count({ where: { ...factoryFilter, isActive: true } }),
      this.prisma.materialLot.count({ where: { ...factoryFilter, status: 'ACTIVE' } }),
      this.prisma.sparePart.findMany({
        where: { ...factoryFilter, isActive: true },
        select: { stockQty: true, minStockQty: true, unitCost: true },
      }),
    ]);

    const lowStockCount = parts.filter(p => p.stockQty <= p.minStockQty).length;
    const totalStockValue = parts.reduce((s, p) => s + p.stockQty * (p.unitCost ?? 0), 0);

    return {
      totalSpareParts,
      lowStockCount,
      totalSKUs,
      totalMaterialLots,
      totalStockValue: parseFloat(totalStockValue.toFixed(2)),
    };
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

    const where: Prisma.SparePartWhereInput = {
      ...factoryFilter,
      isActive: true,
      ...(category && { category }),
      ...(search && {
        OR: [
          { partNumber: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.sparePart.count({ where }),
      this.prisma.sparePart.findMany({
        where,
        include: {
          woConsumptions: {
            orderBy: { wo: { createdAt: 'desc' } },
            take: 1,
            include: { wo: { select: { woNumber: true, completedAt: true } } },
          },
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    let result = data.map(p => ({
      id: p.id,
      partNumber: p.partNumber,
      name: p.name,
      description: p.description,
      category: p.category,
      manufacturer: p.manufacturer,
      model: p.model,
      supplier: p.supplier,
      unitCost: p.unitCost,
      stockQty: p.stockQty,
      minStockQty: p.minStockQty,
      maxStockQty: p.maxStockQty,
      storageLocation: p.storageLocation,
      binNumber: p.binNumber,
      isLowStock: p.stockQty <= p.minStockQty,
      stockValue: parseFloat((p.stockQty * (p.unitCost ?? 0)).toFixed(2)),
      lastUsed: p.woConsumptions[0]?.wo?.completedAt?.toISOString() ?? null,
    }));

    if (lowStock) result = result.filter(p => p.isLowStock);

    return {
      data: result,
      total: lowStock ? result.length : total,
      page,
      limit,
      totalPages: Math.ceil((lowStock ? result.length : total) / limit),
    };
  }

  async createSparePart(factoryId: string, dto: {
    partNumber: string;
    name: string;
    description?: string;
    category?: string;
    manufacturer?: string;
    model?: string;
    supplier?: string;
    unitCost?: number;
    stockQty?: number;
    minStockQty?: number;
    maxStockQty?: number;
    storageLocation?: string;
    binNumber?: string;
  }) {
    return this.prisma.sparePart.create({ data: { factoryId, ...dto } });
  }

  async updateSparePart(factoryId: string | null, id: string, dto: Record<string, unknown>) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const part = await this.prisma.sparePart.findFirst({ where: { id, ...factoryFilter } });
    if (!part) throw new NotFoundException('Spare part not found');

    const { partNumber: _pn, factoryId: _fid, ...safe } = dto as any;
    return this.prisma.sparePart.update({ where: { id }, data: safe });
  }

  async adjustStock(factoryId: string | null, id: string, dto: {
    quantity: number;
    type: 'ADD' | 'REMOVE' | 'SET';
    reason?: string;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const part = await this.prisma.sparePart.findFirst({ where: { id, ...factoryFilter } });
    if (!part) throw new NotFoundException('Spare part not found');

    let newQty: number;
    if (dto.type === 'ADD') newQty = part.stockQty + dto.quantity;
    else if (dto.type === 'REMOVE') {
      if (part.stockQty < dto.quantity) {
        throw new BadRequestException(`Insufficient stock: ${part.stockQty} available`);
      }
      newQty = part.stockQty - dto.quantity;
    } else {
      newQty = dto.quantity;
    }

    return this.prisma.sparePart.update({ where: { id }, data: { stockQty: newQty } });
  }

  // ────────────────────────────────────────────────────────────
  // PRODUCTS (SKUs)
  // ────────────────────────────────────────────────────────────

  async findProducts(factoryId: string | null, filters: {
    search?: string;
    category?: string;
    brand?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, category, brand, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.SKUWhereInput = {
      ...factoryFilter,
      isActive: true,
      ...(category && { category }),
      ...(brand && { brand }),
      ...(search && {
        OR: [
          { itemNumber: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.sKU.count({ where }),
      this.prisma.sKU.findMany({
        where,
        include: {
          family: { select: { name: true, brand: true, category: true } },
          bomComponents: {
            where: { isActive: true },
            select: { componentCode: true, componentName: true, quantity: true, unit: true, type: true },
          },
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ────────────────────────────────────────────────────────────
  // MATERIAL LOTS
  // ────────────────────────────────────────────────────────────

  async findMaterials(factoryId: string | null, filters: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, status, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.MaterialLotWhereInput = {
      ...factoryFilter,
      ...(status && { status: status as any }),
      ...(search && {
        OR: [
          { materialCode: { contains: search, mode: 'insensitive' as const } },
          { materialName: { contains: search, mode: 'insensitive' as const } },
          { lotNumber: { contains: search, mode: 'insensitive' as const } },
          { supplierName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.materialLot.count({ where }),
      this.prisma.materialLot.findMany({
        where,
        orderBy: [{ receivedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const now = new Date();
    return {
      data: data.map(lot => ({
        ...lot,
        utilizationPct: lot.quantity > 0
          ? parseFloat(((1 - lot.remainingQty / lot.quantity) * 100).toFixed(1))
          : 0,
        isExpired: lot.expiryDate ? lot.expiryDate < now : false,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createMaterialLot(factoryId: string, dto: {
    materialCode: string;
    materialName: string;
    lotNumber: string;
    supplierLot?: string;
    supplierName?: string;
    quantity: number;
    unit: string;
    expiryDate?: string;
    storageLocation?: string;
    notes?: string;
  }) {
    return this.prisma.materialLot.create({
      data: {
        factoryId,
        materialCode: dto.materialCode,
        materialName: dto.materialName,
        lotNumber: dto.lotNumber,
        supplierLot: dto.supplierLot,
        supplierName: dto.supplierName,
        quantity: dto.quantity,
        remainingQty: dto.quantity,
        unit: dto.unit,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        storageLocation: dto.storageLocation,
        notes: dto.notes,
      },
    });
  }

  async deleteMaterialLot(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const lot = await this.prisma.materialLot.findFirst({ where: { id, ...factoryFilter } });
    if (!lot) throw new NotFoundException('Material lot not found');
    await this.prisma.materialLot.delete({ where: { id } });
  }

  async deleteSparePart(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const part = await this.prisma.sparePart.findFirst({ where: { id, ...factoryFilter } });
    if (!part) throw new NotFoundException('Spare part not found');
    await this.prisma.sparePart.delete({ where: { id } });
  }

  async createProduct(factoryId: string | null, dto: {
    code: string; name: string; itemNumber?: string; category?: string; brand?: string;
    unit?: string; weight?: number;
  }) {
    const resolvedFactoryId = factoryId ?? await this.getDefaultFactoryId();
    return this.prisma.sKU.create({
      data: {
        factoryId: resolvedFactoryId,
        code: dto.code,
        name: dto.name,
        itemNumber: dto.itemNumber ?? dto.code,
        category: dto.category,
        brand: dto.brand,
        baseUnit: dto.unit ?? 'PCS',
        weight: dto.weight,
        isActive: true,
      },
    });
  }

  async updateProduct(factoryId: string | null, id: string, dto: {
    name?: string; category?: string; brand?: string; unit?: string; weight?: number;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const sku = await this.prisma.sKU.findFirst({ where: { id, ...factoryFilter } });
    if (!sku) throw new NotFoundException('Product not found');
    return this.prisma.sKU.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
        ...(dto.unit && { baseUnit: dto.unit }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
      },
    });
  }

  async deleteProduct(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const sku = await this.prisma.sKU.findFirst({ where: { id, ...factoryFilter } });
    if (!sku) throw new NotFoundException('Product not found');
    await this.prisma.sKU.update({ where: { id }, data: { isActive: false } });
  }

  private async getDefaultFactoryId(): Promise<string> {
    const factory = await this.prisma.factory.findFirst({ where: { isActive: true } });
    if (!factory) throw new NotFoundException('No active factory found');
    return factory.id;
  }
}
