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
          storageLocationRef: { select: { id: true, code: true, name: true, zone: true } },
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
      model: (p as any).model,
      supplier: p.supplier,
      unitCost: p.unitCost,
      stockQty: p.stockQty,
      minStockQty: p.minStockQty,
      maxStockQty: p.maxStockQty,
      storageLocation: (p as any).storageLocationRef?.name ?? p.storageLocation,
      storageLocationId: p.storageLocationId,
      storageLocationRef: (p as any).storageLocationRef ?? null,
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
    storageLocationId?: string;
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
          storageLocationRef: { select: { id: true, code: true, name: true, zone: true } },
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

    const [total, rawData] = await Promise.all([
      this.prisma.materialLot.count({ where }),
      (this.prisma.materialLot.findMany as any)({
        where,
        include: { storageLocationRef: { select: { id: true, code: true, name: true, zone: true } } },
        orderBy: [{ receivedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const data: any[] = rawData;

    const now = new Date();
    return {
      data: data.map(lot => ({
        ...lot,
        storageLocation: lot.storageLocationRef?.name ?? lot.storageLocation,
        storageLocationId: lot.storageLocationId ?? null,
        storageLocationRef: lot.storageLocationRef ?? null,
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
    rawMaterialId?: string;
    materialCode?: string;
    materialName?: string;
    lotNumber: string;
    supplierLot?: string;
    supplierName?: string;
    quantity: number;
    unit?: string;
    expiryDate?: string;
    storageLocation?: string;
    storageLocationId?: string;
    notes?: string;
  }) {
    // Auto-resolve materialCode/materialName/unit from RawMaterial master if rawMaterialId provided
    let resolvedCode = dto.materialCode ?? '';
    let resolvedName = dto.materialName ?? '';
    let resolvedUnit = dto.unit ?? 'KG';

    if (dto.rawMaterialId) {
      const rawMat = await this.prisma.rawMaterial.findUnique({
        where: { id: dto.rawMaterialId },
        select: { code: true, name: true, unit: true },
      });
      if (rawMat) {
        resolvedCode = rawMat.code;
        resolvedName = rawMat.name;
        resolvedUnit = dto.unit ?? rawMat.unit;
      }
    }

    return this.prisma.materialLot.create({
      data: {
        factoryId,
        rawMaterialId: dto.rawMaterialId ?? null,
        materialCode: resolvedCode,
        materialName: resolvedName,
        lotNumber: dto.lotNumber,
        supplierLot: dto.supplierLot,
        supplierName: dto.supplierName,
        quantity: dto.quantity,
        remainingQty: dto.quantity,
        unit: resolvedUnit,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        storageLocation: dto.storageLocation,
        storageLocationId: dto.storageLocationId ?? null,
        notes: dto.notes,
      } as any,
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
    unit?: string; weight?: number; weightUnit?: string;
    length?: number; width?: number; height?: number; dimensionUnit?: string;
    packagingType?: string;
    unitsPerInner?: number; innersPerCarton?: number; cartonsPerPallet?: number;
    storageLocationId?: string;
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
        weight: dto.weight ?? null,
        weightUnit: dto.weightUnit ?? 'kg',
        length: dto.length ?? null,
        width: dto.width ?? null,
        height: dto.height ?? null,
        dimensionUnit: dto.dimensionUnit ?? 'cm',
        packagingType: dto.packagingType,
        unitsPerInner: dto.unitsPerInner ?? 1,
        innersPerCarton: dto.innersPerCarton ?? 1,
        cartonsPerPallet: dto.cartonsPerPallet ?? 1,
        storageLocationId: dto.storageLocationId ?? null,
        isActive: true,
      },
    });
  }

  async updateProduct(factoryId: string | null, id: string, dto: {
    name?: string; category?: string; brand?: string; unit?: string;
    weight?: number | null; weightUnit?: string;
    length?: number | null; width?: number | null; height?: number | null; dimensionUnit?: string;
    storageLocationId?: string | null;
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
        ...(dto.weightUnit && { weightUnit: dto.weightUnit }),
        ...(dto.length !== undefined && { length: dto.length }),
        ...(dto.width !== undefined && { width: dto.width }),
        ...(dto.height !== undefined && { height: dto.height }),
        ...(dto.dimensionUnit && { dimensionUnit: dto.dimensionUnit }),
        ...(dto.storageLocationId !== undefined && { storageLocationId: dto.storageLocationId }),
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

  // ────────────────────────────────────────────────────────────
  // STORAGE LOCATIONS
  // ────────────────────────────────────────────────────────────

  async findStorageLocations(factoryId: string | null, filters: {
    zone?: string; search?: string; page?: number; limit?: number;
  }) {
    const { zone, search, page = 1, limit = 50 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.StorageLocationWhereInput = {
      ...factoryFilter,
      isActive: true,
      ...(zone && { zone: zone as any }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.storageLocation.count({ where }),
      this.prisma.storageLocation.findMany({
        where,
        include: {
          _count: {
            select: { rawMaterials: true, materialLots: true, spareParts: true },
          },
        },
        orderBy: [{ zone: 'asc' }, { code: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map(l => ({
        id: l.id,
        code: l.code,
        name: l.name,
        zone: l.zone,
        description: l.description,
        capacity: l.capacity,
        isActive: l.isActive,
        createdAt: l.createdAt,
        rawMaterialCount: l._count.rawMaterials,
        materialLotCount: l._count.materialLots,
        sparePartCount: l._count.spareParts,
        totalItems: l._count.rawMaterials + l._count.materialLots + l._count.spareParts,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createStorageLocation(factoryId: string, dto: {
    code: string; name: string; zone: string; description?: string; capacity?: number;
  }) {
    return this.prisma.storageLocation.create({
      data: {
        factoryId,
        code: dto.code,
        name: dto.name,
        zone: dto.zone as any,
        description: dto.description,
        capacity: dto.capacity,
      },
    });
  }

  async updateStorageLocation(factoryId: string | null, id: string, dto: {
    name?: string; zone?: string; description?: string; capacity?: number; isActive?: boolean;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const loc = await this.prisma.storageLocation.findFirst({ where: { id, ...factoryFilter } });
    if (!loc) throw new NotFoundException('Storage location not found');

    return this.prisma.storageLocation.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.zone && { zone: dto.zone as any }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteStorageLocation(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const loc = await this.prisma.storageLocation.findFirst({ where: { id, ...factoryFilter } });
    if (!loc) throw new NotFoundException('Storage location not found');
    await this.prisma.storageLocation.update({ where: { id }, data: { isActive: false } });
  }

  async getLocationContents(factoryId: string | null, id: string) {
    const where = factoryId ? { id, factoryId } : { id };
    const loc = await this.prisma.storageLocation.findFirst({
      where,
      include: {
        rawMaterials: {
          where: { isActive: true },
          select: { id: true, code: true, name: true, category: true, unit: true, currentStock: true, minStock: true, unitCost: true },
          orderBy: { name: 'asc' },
        },
        materialLots: {
          select: {
            id: true, lotNumber: true, materialCode: true, materialName: true,
            quantity: true, remainingQty: true, unit: true, status: true,
            receivedAt: true, expiryDate: true, binNumber: true,
            rawMaterial: { select: { code: true, name: true, category: true } },
          },
          orderBy: { receivedAt: 'desc' },
        },
        spareParts: {
          where: { isActive: true },
          select: { id: true, partNumber: true, name: true, category: true, stockQty: true, minStockQty: true, unitCost: true, binNumber: true },
          orderBy: { name: 'asc' },
        },
        skus: {
          where: { isActive: true },
          select: { id: true, code: true, name: true, itemNumber: true, category: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!loc) throw new NotFoundException('Storage location not found');

    const rawMaterials = (loc as any).rawMaterials as { id: string; code: string; name: string; category: string | null; unit: string; currentStock: number; minStock: number; unitCost: number | null }[];
    const materialLots = (loc as any).materialLots as { id: string; lotNumber: string; materialCode: string; materialName: string; quantity: number; remainingQty: number | null; unit: string; status: string; receivedAt: Date; expiryDate: Date | null; binNumber: string | null; rawMaterial: { code: string; name: string; category: string | null } | null }[];
    const spareParts = (loc as any).spareParts as { id: string; partNumber: string; name: string; category: string | null; stockQty: number; minStockQty: number; unitCost: number | null; binNumber: string | null }[];
    const skus = (loc as any).skus as { id: string; code: string; name: string; itemNumber: string | null; category: string | null }[];

    const stockValue =
      rawMaterials.reduce((s, r) => s + r.currentStock * (r.unitCost ?? 0), 0) +
      materialLots.reduce((s, m) => s + (m.remainingQty ?? 0), 0) +
      spareParts.reduce((s, p) => s + p.stockQty * (p.unitCost ?? 0), 0);

    return {
      id: loc.id,
      code: loc.code,
      name: loc.name,
      zone: loc.zone,
      description: loc.description,
      capacity: loc.capacity,
      isActive: loc.isActive,
      stockValue: parseFloat(stockValue.toFixed(2)),
      rawMaterials: rawMaterials.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        category: r.category,
        unit: r.unit,
        stockQty: r.currentStock,
        minStockQty: r.minStock,
        unitCost: r.unitCost,
        isLowStock: r.currentStock <= r.minStock,
        stockValue: parseFloat((r.currentStock * (r.unitCost ?? 0)).toFixed(2)),
      })),
      materialLots,
      spareParts: spareParts.map(p => ({
        ...p,
        isLowStock: p.stockQty <= p.minStockQty,
        stockValue: parseFloat((p.stockQty * (p.unitCost ?? 0)).toFixed(2)),
      })),
      skus,
    };
  }

  // ────────────────────────────────────────────────────────────
  // BOM MANAGEMENT
  // ────────────────────────────────────────────────────────────

  async findBOMs(factoryId: string | null, filters: {
    skuId?: string; isActive?: boolean; page?: number; limit?: number;
  }) {
    const { skuId, isActive, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.BOMHeaderWhereInput = {
      ...factoryFilter,
      ...(skuId && { skuId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, data] = await Promise.all([
      this.prisma.bOMHeader.count({ where }),
      this.prisma.bOMHeader.findMany({
        where,
        include: {
          sku: { select: { id: true, code: true, name: true, itemNumber: true, category: true } },
          items: {
            include: {
              rawMaterial: { select: { id: true, code: true, name: true, unit: true } },
            },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: [{ sku: { name: 'asc' } }, { version: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getBOMById(id: string) {
    const bom = await this.prisma.bOMHeader.findUnique({
      where: { id },
      include: {
        sku: { select: { id: true, code: true, name: true, itemNumber: true, category: true } },
        items: {
          include: {
            rawMaterial: { select: { id: true, code: true, name: true, unit: true, unitCost: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!bom) throw new NotFoundException('BOM not found');
    return bom;
  }

  async createBOM(factoryId: string | null, dto: {
    skuId: string;
    version?: string;
    notes?: string;
    items: Array<{
      rawMaterialId: string;
      quantityPer: number;
      unit: string;
      scrapFactor?: number;
      isOptional?: boolean;
      notes?: string;
    }>;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const sku = await this.prisma.sKU.findFirst({ where: { id: dto.skuId, ...factoryFilter } });
    if (!sku) throw new NotFoundException('SKU not found');

    const resolvedFactoryId = factoryId ?? await this.getDefaultFactoryId();
    return this.prisma.bOMHeader.create({
      data: {
        factoryId: resolvedFactoryId,
        skuId: dto.skuId,
        version: dto.version ?? '1.0',
        notes: dto.notes,
        isActive: true,
        items: {
          create: dto.items.map(item => ({
            rawMaterialId: item.rawMaterialId,
            quantityPer: item.quantityPer,
            unit: item.unit,
            scrapFactor: item.scrapFactor ?? 0,
            isOptional: item.isOptional ?? false,
            notes: item.notes,
          })),
        },
      },
      include: {
        sku: { select: { id: true, code: true, name: true } },
        items: { include: { rawMaterial: { select: { code: true, name: true, unit: true } } } },
      },
    });
  }

  async updateBOM(id: string, dto: {
    version?: string;
    notes?: string;
    isActive?: boolean;
  }) {
    const bom = await this.prisma.bOMHeader.findUnique({ where: { id } });
    if (!bom) throw new NotFoundException('BOM not found');

    return this.prisma.bOMHeader.update({
      where: { id },
      data: {
        ...(dto.version && { version: dto.version }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async approveBOM(id: string, userId: string) {
    const bom = await this.prisma.bOMHeader.findUnique({ where: { id } });
    if (!bom) throw new NotFoundException('BOM not found');
    if (bom.approvedAt) throw new BadRequestException('BOM is already approved');

    // Deactivate all other BOMs for the same SKU
    await this.prisma.bOMHeader.updateMany({
      where: { skuId: bom.skuId, id: { not: id } },
      data: { isActive: false },
    });

    return this.prisma.bOMHeader.update({
      where: { id },
      data: { approvedAt: new Date(), approvedById: userId, isActive: true },
    });
  }

  async deleteBOM(id: string, factoryId: string | null) {
    const where = factoryId ? { id, factoryId } : { id };
    const bom = await this.prisma.bOMHeader.findFirst({ where });
    if (!bom) throw new NotFoundException('BOM not found');
    if (bom.approvedAt) throw new BadRequestException('Approved BOMs cannot be deleted. Revert to draft first or create a new version.');
    await this.prisma.bOMItem.deleteMany({ where: { bomId: id } });
    await this.prisma.bOMHeader.delete({ where: { id } });
  }

  async deleteBOMItem(bomId: string, itemId: string) {
    const item = await this.prisma.bOMItem.findFirst({ where: { id: itemId, bomId } });
    if (!item) throw new NotFoundException('BOM item not found');
    await this.prisma.bOMItem.delete({ where: { id: itemId } });
  }

  async upsertBOMItem(bomId: string, dto: {
    rawMaterialId: string;
    quantityPer: number;
    unit: string;
    scrapFactor?: number;
    isOptional?: boolean;
    notes?: string;
  }) {
    const bom = await this.prisma.bOMHeader.findUnique({ where: { id: bomId } });
    if (!bom) throw new NotFoundException('BOM not found');

    const existing = await this.prisma.bOMItem.findFirst({
      where: { bomId, rawMaterialId: dto.rawMaterialId },
    });

    if (existing) {
      return this.prisma.bOMItem.update({
        where: { id: existing.id },
        data: {
          quantityPer: dto.quantityPer,
          unit: dto.unit,
          scrapFactor: dto.scrapFactor ?? existing.scrapFactor,
          isOptional: dto.isOptional ?? existing.isOptional,
          notes: dto.notes,
        },
      });
    }

    return this.prisma.bOMItem.create({
      data: { bomId, ...dto, scrapFactor: dto.scrapFactor ?? 0, isOptional: dto.isOptional ?? false },
    });
  }

  // ────────────────────────────────────────────────────────────
  // MANUFACTURING PROCESSES
  // ────────────────────────────────────────────────────────────

  async findProcesses(factoryId: string | null, filters: {
    skuId?: string; isActive?: boolean; page?: number; limit?: number;
  }) {
    const { skuId, isActive, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: Prisma.ManufacturingProcessWhereInput = {
      ...factoryFilter,
      ...(skuId && { skuId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, data] = await Promise.all([
      this.prisma.manufacturingProcess.count({ where }),
      this.prisma.manufacturingProcess.findMany({
        where,
        include: {
          sku: { select: { id: true, code: true, name: true, itemNumber: true } },
          routingSteps: {
            include: {
              machine: { select: { code: true, name: true } },
              workCenterRef: { select: { id: true, code: true, name: true, level: true } },
              predecessors: {
                include: { fromStep: { select: { id: true, stepNumber: true, operationName: true } } },
              },
            },
            orderBy: { stepNumber: 'asc' },
          },
        },
        orderBy: [{ sku: { name: 'asc' } }, { version: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createProcess(factoryId: string, dto: {
    skuId: string;
    version?: string;
    name: string;
    description?: string;
    totalCycleTimeMins?: number;
    steps: Array<{
      stepNumber: number;
      operationName: string;
      workCenter?: string;
      workCenterId?: string;
      machineId?: string;
      cycleTimeMins?: number;
      setupTimeMins?: number;
      description?: string;
      parameters?: Record<string, unknown>;
      isOptional?: boolean;
      dependencies?: Array<{ fromStepNumber: number; type: string; lagMins?: number }>;
    }>;
  }) {
    const version = dto.version ?? '1.0';

    const existing = await this.prisma.manufacturingProcess.findUnique({
      where: { skuId_version: { skuId: dto.skuId, version } },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `A manufacturing process version ${version} already exists for this product. Use a different version or clone the existing one.`,
      );
    }

    const process = await this.prisma.manufacturingProcess.create({
      data: {
        factoryId,
        skuId: dto.skuId,
        version,
        name: dto.name,
        description: dto.description,
        totalCycleTimeMins: dto.totalCycleTimeMins,
        isActive: true,
        routingSteps: {
          create: dto.steps.map(s => ({
            stepNumber: s.stepNumber,
            operationName: s.operationName,
            workCenter: s.workCenter,
            workCenterId: s.workCenterId ?? null,
            machineId: s.machineId ?? null,
            cycleTimeMins: s.cycleTimeMins,
            setupTimeMins: s.setupTimeMins,
            description: s.description,
            parameters: (s.parameters as any) ?? undefined,
            isOptional: s.isOptional ?? false,
          })),
        },
      },
      include: {
        sku: { select: { code: true, name: true } },
        routingSteps: { orderBy: { stepNumber: 'asc' } },
      },
    });

    // Create step dependencies now that we have real step IDs
    const stepMap = new Map(process.routingSteps.map(s => [s.stepNumber, s.id]));
    const depData: Array<{ fromStepId: string; toStepId: string; type: string; lagMins: number }> = [];

    for (const s of dto.steps) {
      if (!s.dependencies?.length) continue;
      const toStepId = stepMap.get(s.stepNumber);
      if (!toStepId) continue;
      for (const dep of s.dependencies) {
        const fromStepId = stepMap.get(dep.fromStepNumber);
        if (!fromStepId || fromStepId === toStepId) continue;
        depData.push({ fromStepId, toStepId, type: dep.type, lagMins: dep.lagMins ?? 0 });
      }
    }

    if (depData.length > 0) {
      await (this.prisma as any).stepDependency.createMany({ data: depData, skipDuplicates: true });
    }

    return process;
  }

  async updateProcess(id: string, dto: {
    name?: string;
    description?: string;
    totalCycleTimeMins?: number;
    isActive?: boolean;
    steps?: Array<{
      stepNumber: number;
      operationName: string;
      workCenter?: string;
      workCenterId?: string;
      machineId?: string;
      cycleTimeMins?: number;
      setupTimeMins?: number;
      description?: string;
      parameters?: Record<string, unknown>;
      isOptional?: boolean;
      dependencies?: Array<{ fromStepNumber: number; type: string; lagMins?: number }>;
    }>;
  }) {
    const p = await this.prisma.manufacturingProcess.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Manufacturing process not found');

    const { steps, ...headerDto } = dto;

    await this.prisma.manufacturingProcess.update({ where: { id }, data: headerDto });

    if (steps && steps.length > 0) {
      // Delete all existing steps (cascades to StepDependency via onDelete: Cascade)
      await this.prisma.routingStep.deleteMany({ where: { processId: id } });

      // Recreate steps
      const process = await this.prisma.manufacturingProcess.update({
        where: { id },
        data: {
          totalCycleTimeMins: steps.reduce((s, st) => s + (st.cycleTimeMins ?? 0), 0) || headerDto.totalCycleTimeMins,
          routingSteps: {
            create: steps.map(s => ({
              stepNumber: s.stepNumber,
              operationName: s.operationName,
              workCenter: s.workCenter,
              workCenterId: s.workCenterId ?? null,
              machineId: s.machineId ?? null,
              cycleTimeMins: s.cycleTimeMins,
              setupTimeMins: s.setupTimeMins,
              description: s.description,
              parameters: (s.parameters as any) ?? undefined,
              isOptional: s.isOptional ?? false,
            })),
          },
        },
        include: {
          sku: { select: { code: true, name: true } },
          routingSteps: { orderBy: { stepNumber: 'asc' } },
        },
      });

      // Recreate dependencies
      const stepMap = new Map(process.routingSteps.map(s => [s.stepNumber, s.id]));
      const depData: Array<{ fromStepId: string; toStepId: string; type: string; lagMins: number }> = [];

      for (const s of steps) {
        if (!s.dependencies?.length) continue;
        const toStepId = stepMap.get(s.stepNumber);
        if (!toStepId) continue;
        for (const dep of s.dependencies) {
          const fromStepId = stepMap.get(dep.fromStepNumber);
          if (!fromStepId || fromStepId === toStepId) continue;
          depData.push({ fromStepId, toStepId, type: dep.type, lagMins: dep.lagMins ?? 0 });
        }
      }

      if (depData.length > 0) {
        await (this.prisma as any).stepDependency.createMany({ data: depData, skipDuplicates: true });
      }

      return process;
    }

    return this.prisma.manufacturingProcess.findUnique({
      where: { id },
      include: {
        sku: { select: { code: true, name: true } },
        routingSteps: { orderBy: { stepNumber: 'asc' } },
      },
    });
  }

  async approveProcess(id: string, userId: string) {
    const p = await this.prisma.manufacturingProcess.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Manufacturing process not found');

    await this.prisma.manufacturingProcess.updateMany({
      where: { skuId: p.skuId, id: { not: id } },
      data: { isActive: false },
    });

    return this.prisma.manufacturingProcess.update({
      where: { id },
      data: { approvedAt: new Date(), approvedById: userId, isActive: true },
    });
  }

  async revertToDraft(id: string) {
    const p = await this.prisma.manufacturingProcess.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Manufacturing process not found');
    if (!p.approvedAt) throw new BadRequestException('Process is already in draft state.');
    return this.prisma.manufacturingProcess.update({
      where: { id },
      data: { approvedAt: null, approvedById: null, isActive: false },
    });
  }

  async findProcessById(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const process = await this.prisma.manufacturingProcess.findFirst({
      where: { id, ...factoryFilter },
      include: {
        sku: { select: { id: true, code: true, name: true, itemNumber: true } },
        routingSteps: {
          include: {
            machine: { select: { code: true, name: true } },
            workCenterRef: { select: { id: true, code: true, name: true, level: true } },
            predecessors: {
              include: { fromStep: { select: { id: true, stepNumber: true, operationName: true } } },
            },
          },
          orderBy: { stepNumber: 'asc' },
        },
      },
    });
    if (!process) throw new NotFoundException('Manufacturing process not found');
    return process;
  }

  async deleteProcess(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const process = await this.prisma.manufacturingProcess.findFirst({
      where: { id, ...factoryFilter },
      select: { id: true, approvedAt: true },
    });
    if (!process) throw new NotFoundException('Manufacturing process not found');
    if (process.approvedAt) {
      throw new BadRequestException('Approved processes cannot be deleted. Obsolete it first.');
    }
    await this.prisma.manufacturingProcess.delete({ where: { id } });
  }
}
