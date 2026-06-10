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
          categoryRef: { select: { id: true, name: true } },
          brandRef: { select: { id: true, name: true } },
          packagingTypeRef: { select: { id: true, name: true } },
          baseUnitRef: { select: { id: true, code: true, name: true } },
          baseWeightRef: { select: { id: true, value: true, unit: true, label: true } },
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
    categoryId?: string | null; brandId?: string | null; packagingTypeId?: string | null;
    baseUnitId?: string | null; baseWeightId?: string | null;
    unit?: string; weight?: number; weightUnit?: string;
    length?: number; width?: number; height?: number; dimensionUnit?: string;
    packagingType?: string;
    unitsPerInner?: number; innersPerCarton?: number; cartonsPerPallet?: number;
    storageLocationId?: string;
  }) {
    const resolvedFactoryId = factoryId ?? await this.getDefaultFactoryId();
    const refs = await this.resolveMasterRefs(resolvedFactoryId, dto);
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
        ...refs, // FK ids + synced legacy texts/weight (wins over raw strings)
      },
    });
  }

  async updateProduct(factoryId: string | null, id: string, dto: {
    name?: string; category?: string; brand?: string; unit?: string;
    categoryId?: string | null; brandId?: string | null; packagingTypeId?: string | null;
    baseUnitId?: string | null; baseWeightId?: string | null;
    weight?: number | null; weightUnit?: string;
    length?: number | null; width?: number | null; height?: number | null; dimensionUnit?: string;
    unitsPerInner?: number; innersPerCarton?: number; cartonsPerPallet?: number;
    packagingType?: string;
    storageLocationId?: string | null;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const sku = await this.prisma.sKU.findFirst({ where: { id, ...factoryFilter } });
    if (!sku) throw new NotFoundException('Product not found');
    const refs = await this.resolveMasterRefs(sku.factoryId, dto);
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
        ...(dto.unitsPerInner !== undefined && { unitsPerInner: dto.unitsPerInner }),
        ...(dto.innersPerCarton !== undefined && { innersPerCarton: dto.innersPerCarton }),
        ...(dto.cartonsPerPallet !== undefined && { cartonsPerPallet: dto.cartonsPerPallet }),
        ...(dto.packagingType !== undefined && { packagingType: dto.packagingType }),
        ...(dto.storageLocationId !== undefined && { storageLocationId: dto.storageLocationId }),
        ...refs,
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
  // PRODUCT MASTER DATA (Category / Brand / Packaging / Base Unit / Base Weight)
  // ────────────────────────────────────────────────────────────

  /** All five lookup lists in one call (powers the product form dropdowns). */
  async getProductMasterData(factoryId: string | null) {
    const fid = factoryId ?? await this.getDefaultFactoryId();
    const where = { factoryId: fid, isActive: true };
    const order = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];
    const [categories, brands, packagingTypes, baseUnits, baseWeights] = await Promise.all([
      this.prisma.productCategory.findMany({ where, orderBy: order }),
      this.prisma.productBrand.findMany({ where, orderBy: order }),
      this.prisma.packagingType.findMany({ where, orderBy: order }),
      this.prisma.baseUnit.findMany({ where, orderBy: order }),
      this.prisma.baseWeight.findMany({ where, orderBy: [{ value: 'asc' }] }),
    ]);
    return { categories, brands, packagingTypes, baseUnits, baseWeights };
  }

  private masterDelegate(entity: string): { d: any; label: string } {
    const map: Record<string, { d: any; label: string }> = {
      'categories': { d: this.prisma.productCategory, label: 'Category' },
      'brands': { d: this.prisma.productBrand, label: 'Brand' },
      'packaging-types': { d: this.prisma.packagingType, label: 'Packaging type' },
      'base-units': { d: this.prisma.baseUnit, label: 'Base unit' },
      'base-weights': { d: this.prisma.baseWeight, label: 'Base weight' },
    };
    const found = map[entity];
    if (!found) throw new BadRequestException(`Unknown master-data entity: ${entity}`);
    return found;
  }

  async createMasterItem(factoryId: string | null, entity: string, dto: {
    name?: string; nameAr?: string; code?: string; value?: number; unit?: string; sortOrder?: number;
  }) {
    const fid = factoryId ?? await this.getDefaultFactoryId();
    const { d, label } = this.masterDelegate(entity);

    if (entity === 'base-weights') {
      if (dto.value == null || dto.value <= 0) throw new BadRequestException('Base weight value is required');
      const unit = dto.unit ?? 'kg';
      return d.upsert({
        where: { factoryId_value_unit: { factoryId: fid, value: dto.value, unit } },
        update: { isActive: true, label: dto.name ?? `${dto.value} ${unit.toUpperCase() === 'KG' ? 'Kg' : unit}` },
        create: { factoryId: fid, value: dto.value, unit, label: dto.name ?? `${dto.value} Kg`, sortOrder: dto.sortOrder ?? 0 },
      });
    }
    if (entity === 'base-units') {
      const code = (dto.code ?? dto.name ?? '').trim().toUpperCase();
      if (!code) throw new BadRequestException('Base unit code is required');
      return d.upsert({
        where: { factoryId_code: { factoryId: fid, code } },
        update: { isActive: true, name: dto.name ?? code },
        create: { factoryId: fid, code, name: dto.name ?? code, sortOrder: dto.sortOrder ?? 0 },
      });
    }
    const name = (dto.name ?? '').trim();
    if (!name) throw new BadRequestException(`${label} name is required`);
    return d.upsert({
      where: { factoryId_name: { factoryId: fid, name } },
      update: { isActive: true, ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }) },
      create: { factoryId: fid, name, nameAr: dto.nameAr ?? null, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async updateMasterItem(factoryId: string | null, entity: string, id: string, dto: {
    name?: string; nameAr?: string; code?: string; value?: number; unit?: string; sortOrder?: number; isActive?: boolean;
  }) {
    const fid = factoryId ?? await this.getDefaultFactoryId();
    const { d, label } = this.masterDelegate(entity);
    const item = await d.findFirst({ where: { id, factoryId: fid } });
    if (!item) throw new NotFoundException(`${label} not found`);
    const data: Record<string, unknown> = {
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };
    if (entity === 'base-weights') {
      Object.assign(data,
        dto.value !== undefined && { value: dto.value },
        dto.unit && { unit: dto.unit },
        dto.name !== undefined && { label: dto.name });
    } else if (entity === 'base-units') {
      Object.assign(data,
        dto.code && { code: dto.code.trim().toUpperCase() },
        dto.name !== undefined && { name: dto.name });
    } else {
      Object.assign(data,
        dto.name && { name: dto.name.trim() },
        dto.nameAr !== undefined && { nameAr: dto.nameAr });
    }
    const updated = await d.update({ where: { id }, data });
    await this.syncLegacyProductTexts(entity, updated);
    return updated;
  }

  async deleteMasterItem(factoryId: string | null, entity: string, id: string) {
    const fid = factoryId ?? await this.getDefaultFactoryId();
    const { d, label } = this.masterDelegate(entity);
    const item = await d.findFirst({ where: { id, factoryId: fid }, include: { _count: { select: { skus: true } } } });
    if (!item) throw new NotFoundException(`${label} not found`);
    if (item._count.skus > 0) {
      // In use → soft-disable so existing products keep their reference
      await d.update({ where: { id }, data: { isActive: false } });
      return { id, disabled: true, usedBy: item._count.skus };
    }
    await d.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Renaming a lookup keeps the SKUs' legacy text columns in sync. */
  private async syncLegacyProductTexts(entity: string, item: any) {
    if (entity === 'categories') {
      await this.prisma.sKU.updateMany({ where: { categoryId: item.id }, data: { category: item.name } });
    } else if (entity === 'brands') {
      await this.prisma.sKU.updateMany({ where: { brandId: item.id }, data: { brand: item.name } });
    } else if (entity === 'packaging-types') {
      await this.prisma.sKU.updateMany({ where: { packagingTypeId: item.id }, data: { packagingType: item.name } });
    } else if (entity === 'base-units') {
      await this.prisma.sKU.updateMany({ where: { baseUnitId: item.id }, data: { baseUnit: item.code } });
    } else if (entity === 'base-weights') {
      await this.prisma.sKU.updateMany({ where: { baseWeightId: item.id }, data: { weight: item.value, weightUnit: item.unit } });
    }
  }

  /** Resolve master FK ids → legacy text values so both stay consistent. */
  private async resolveMasterRefs(fid: string, dto: {
    categoryId?: string | null; brandId?: string | null; packagingTypeId?: string | null;
    baseUnitId?: string | null; baseWeightId?: string | null;
  }) {
    const out: Record<string, unknown> = {};
    if (dto.categoryId !== undefined) {
      out.categoryId = dto.categoryId;
      out.category = dto.categoryId
        ? (await this.prisma.productCategory.findFirst({ where: { id: dto.categoryId, factoryId: fid } }))?.name ?? null
        : null;
    }
    if (dto.brandId !== undefined) {
      out.brandId = dto.brandId;
      out.brand = dto.brandId
        ? (await this.prisma.productBrand.findFirst({ where: { id: dto.brandId, factoryId: fid } }))?.name ?? null
        : null;
    }
    if (dto.packagingTypeId !== undefined) {
      out.packagingTypeId = dto.packagingTypeId;
      out.packagingType = dto.packagingTypeId
        ? (await this.prisma.packagingType.findFirst({ where: { id: dto.packagingTypeId, factoryId: fid } }))?.name ?? null
        : null;
    }
    if (dto.baseUnitId !== undefined) {
      out.baseUnitId = dto.baseUnitId;
      if (dto.baseUnitId) {
        const u = await this.prisma.baseUnit.findFirst({ where: { id: dto.baseUnitId, factoryId: fid } });
        if (u) out.baseUnit = u.code;
      }
    }
    if (dto.baseWeightId !== undefined) {
      out.baseWeightId = dto.baseWeightId;
      if (dto.baseWeightId) {
        const w = await this.prisma.baseWeight.findFirst({ where: { id: dto.baseWeightId, factoryId: fid } });
        if (w) { out.weight = w.value; out.weightUnit = w.unit; }
      }
    }
    return out;
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
          _count: { select: { items: true } },
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
          categoryRef: { select: { id: true, name: true } },
          baseWeightRef: { select: { id: true, value: true, unit: true, label: true } },
          skuLinks: { include: { sku: { select: { id: true, code: true, name: true } } } },
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
    skuId?: string;
    scopeType?: 'PRODUCT' | 'CATEGORY' | 'BASE_WEIGHT' | 'PRODUCT_LIST';
    categoryId?: string;
    baseWeightId?: string;
    skuIds?: string[];
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
      cycleTimeSec?: number;
      cycleTimeMins?: number;
      setupTimeMins?: number;
      description?: string;
      parameters?: Record<string, unknown>;
      isOptional?: boolean;
      dependencies?: Array<{ fromStepNumber: number; type: string; lagMins?: number }>;
    }>;
  }) {
    const version = dto.version ?? '1.0';
    const scopeType = dto.scopeType ?? 'PRODUCT';

    // Scope validation
    if (scopeType === 'PRODUCT' && !dto.skuId) throw new BadRequestException('skuId is required for PRODUCT scope');
    if (scopeType === 'CATEGORY' && !dto.categoryId) throw new BadRequestException('categoryId is required for CATEGORY scope');
    if (scopeType === 'BASE_WEIGHT' && !dto.baseWeightId) throw new BadRequestException('baseWeightId is required for BASE_WEIGHT scope');
    if (scopeType === 'PRODUCT_LIST' && !dto.skuIds?.length) throw new BadRequestException('skuIds list is required for PRODUCT_LIST scope');

    if (scopeType === 'PRODUCT') {
      const existing = await this.prisma.manufacturingProcess.findUnique({
        where: { skuId_version: { skuId: dto.skuId!, version } },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException(
          `A manufacturing process version ${version} already exists for this product. Use a different version or clone the existing one.`,
        );
      }
    }

    const process = await this.prisma.manufacturingProcess.create({
      data: {
        factoryId,
        skuId: scopeType === 'PRODUCT' ? dto.skuId! : null,
        scopeType: scopeType as any,
        categoryId: scopeType === 'CATEGORY' ? dto.categoryId : null,
        baseWeightId: scopeType === 'BASE_WEIGHT' ? dto.baseWeightId : null,
        version,
        name: dto.name,
        description: dto.description,
        totalCycleTimeMins: dto.totalCycleTimeMins,
        isActive: true,
        ...(scopeType === 'PRODUCT_LIST' && {
          skuLinks: { create: dto.skuIds!.map((skuId) => ({ skuId })) },
        }),
        routingSteps: {
          create: dto.steps.map(s => {
            // Seconds are the canonical cycle time; legacy minutes stay derived.
            const sec = s.cycleTimeSec ?? (s.cycleTimeMins != null ? s.cycleTimeMins * 60 : null);
            return {
              stepNumber: s.stepNumber,
              operationName: s.operationName,
              workCenter: s.workCenter,
              workCenterId: s.workCenterId ?? null,
              machineId: s.machineId ?? null,
              cycleTimeSec: sec,
              cycleTimeMins: sec != null ? sec / 60 : null,
              setupTimeMins: s.setupTimeMins,
              description: s.description,
              parameters: (s.parameters as any) ?? undefined,
              isOptional: s.isOptional ?? false,
            };
          }),
        },
      },
      include: {
        sku: { select: { code: true, name: true } },
        categoryRef: { select: { id: true, name: true } },
        baseWeightRef: { select: { id: true, value: true, unit: true, label: true } },
        skuLinks: { include: { sku: { select: { id: true, code: true, name: true } } } },
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
    scopeType?: 'PRODUCT' | 'CATEGORY' | 'BASE_WEIGHT' | 'PRODUCT_LIST';
    skuId?: string | null;
    categoryId?: string | null;
    baseWeightId?: string | null;
    skuIds?: string[];
    steps?: Array<{
      stepNumber: number;
      operationName: string;
      workCenter?: string;
      workCenterId?: string;
      machineId?: string;
      cycleTimeSec?: number;
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

    const { steps, skuIds, scopeType, skuId, categoryId, baseWeightId, ...headerDto } = dto;

    // Scope change handling
    const scopeData: Record<string, unknown> = {};
    if (scopeType) {
      scopeData.scopeType = scopeType;
      scopeData.skuId = scopeType === 'PRODUCT' ? (skuId ?? p.skuId) : null;
      scopeData.categoryId = scopeType === 'CATEGORY' ? (categoryId ?? p.categoryId) : null;
      scopeData.baseWeightId = scopeType === 'BASE_WEIGHT' ? (baseWeightId ?? p.baseWeightId) : null;
      if (scopeType === 'PRODUCT_LIST') {
        await this.prisma.manufacturingProcessSku.deleteMany({ where: { processId: id } });
        if (skuIds?.length) {
          await this.prisma.manufacturingProcessSku.createMany({
            data: skuIds.map((sid) => ({ processId: id, skuId: sid })),
            skipDuplicates: true,
          });
        }
      } else {
        await this.prisma.manufacturingProcessSku.deleteMany({ where: { processId: id } });
      }
    }

    await this.prisma.manufacturingProcess.update({ where: { id }, data: { ...headerDto, ...scopeData } });

    if (steps && steps.length > 0) {
      // Delete all existing steps (cascades to StepDependency via onDelete: Cascade)
      await this.prisma.routingStep.deleteMany({ where: { processId: id } });

      // Seconds are canonical
      const secOf = (s: { cycleTimeSec?: number; cycleTimeMins?: number }) =>
        s.cycleTimeSec ?? (s.cycleTimeMins != null ? s.cycleTimeMins * 60 : null);

      // Recreate steps
      const process = await this.prisma.manufacturingProcess.update({
        where: { id },
        data: {
          totalCycleTimeMins: steps.reduce((s, st) => s + ((secOf(st) ?? 0) / 60), 0) || headerDto.totalCycleTimeMins,
          routingSteps: {
            create: steps.map(s => {
              const sec = secOf(s);
              return {
                stepNumber: s.stepNumber,
                operationName: s.operationName,
                workCenter: s.workCenter,
                workCenterId: s.workCenterId ?? null,
                machineId: s.machineId ?? null,
                cycleTimeSec: sec,
                cycleTimeMins: sec != null ? sec / 60 : null,
                setupTimeMins: s.setupTimeMins,
                description: s.description,
                parameters: (s.parameters as any) ?? undefined,
                isOptional: s.isOptional ?? false,
              };
            }),
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
