import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe, NotFoundException, Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { RawMaterialsService } from './raw-materials.service';
import { StockMovementsService } from './stock-movements.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('Inventory')
@ApiBearerAuth('JWT-auth')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly rawMaterialsService: RawMaterialsService,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // OVERVIEW
  // ────────────────────────────────────────────────────────────

  @Get('overview')
  @ApiOperation({ summary: 'Inventory overview KPIs' })
  async getOverview(@CurrentUser() user: RequestUser) {
    return this.inventoryService.getOverview(user.factoryId);
  }

  // ────────────────────────────────────────────────────────────
  // SPARE PARTS
  // ────────────────────────────────────────────────────────────

  @Get('spare-parts')
  @ApiOperation({ summary: 'List spare parts' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findSpareParts(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('lowStock') lowStock?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.inventoryService.findSpareParts(user.factoryId, {
      search,
      category,
      lowStock: lowStock === 'true',
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('spare-parts')
  @ApiOperation({ summary: 'Create spare part' })
  async createSparePart(@CurrentUser() user: RequestUser, @Body() dto: any) {
    const factoryId = user.factoryId ?? dto.factoryId;
    if (!factoryId) throw new NotFoundException('Factory context required');
    return this.inventoryService.createSparePart(factoryId, dto);
  }

  @Patch('spare-parts/:id')
  @ApiOperation({ summary: 'Update spare part' })
  async updateSparePart(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.inventoryService.updateSparePart(user.factoryId, id, dto);
  }

  @Post('spare-parts/:id/adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjust spare part stock level' })
  async adjustStock(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { quantity: number; type: 'ADD' | 'REMOVE' | 'SET'; reason?: string },
  ) {
    return this.inventoryService.adjustStock(user.factoryId, id, dto);
  }

  // ────────────────────────────────────────────────────────────
  // PRODUCTS (SKUs)
  // ────────────────────────────────────────────────────────────

  @Get('products')
  @ApiOperation({ summary: 'List product SKUs with BOM' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'brand', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findProducts(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.inventoryService.findProducts(user.factoryId, {
      search,
      category,
      brand,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  // ────────────────────────────────────────────────────────────
  // MATERIAL LOTS
  // ────────────────────────────────────────────────────────────

  @Get('materials')
  @ApiOperation({ summary: 'List material lots' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findMaterials(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.inventoryService.findMaterials(user.factoryId, {
      search,
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('materials')
  @ApiOperation({ summary: 'Receive new material lot' })
  async createMaterialLot(@CurrentUser() user: RequestUser, @Body() dto: any) {
    const factoryId = user.factoryId ?? dto.factoryId;
    if (!factoryId) throw new NotFoundException('Factory context required');
    return this.inventoryService.createMaterialLot(factoryId, dto);
  }

  @Delete('materials/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a material lot' })
  async deleteMaterialLot(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.deleteMaterialLot(user.factoryId, id);
  }

  @Delete('spare-parts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a spare part' })
  async deleteSparePart(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.deleteSparePart(user.factoryId, id);
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a product (SKU)' })
  async createProduct(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.inventoryService.createProduct(user.factoryId, dto);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update a product (SKU)' })
  async updateProduct(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.inventoryService.updateProduct(user.factoryId, id, dto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product (SKU)' })
  async deleteProduct(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.deleteProduct(user.factoryId, id);
  }

  // ────────────────────────────────────────────────────────────
  // RAW MATERIALS
  // ────────────────────────────────────────────────────────────

  @Get('raw-materials')
  @ApiOperation({ summary: 'List raw materials / packaging / consumables' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findRawMaterials(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('lowStock') lowStock?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.rawMaterialsService.findAll(user.factoryId, {
      search,
      category,
      lowStock: lowStock === 'true',
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get('raw-materials/:id')
  @ApiOperation({ summary: 'Get a raw material by ID' })
  async getRawMaterial(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rawMaterialsService.findById(user.factoryId, id);
  }

  @Get('raw-materials/:id/movements')
  @ApiOperation({ summary: 'Get raw material with full stock movement history' })
  async getRawMaterialWithMovements(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rawMaterialsService.getWithMovements(user.factoryId, id);
  }

  @Post('raw-materials')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a raw material master record' })
  async createRawMaterial(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.rawMaterialsService.create(user.factoryId, dto, user.id);
  }

  @Patch('raw-materials/:id')
  @ApiOperation({ summary: 'Update a raw material' })
  async updateRawMaterial(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.rawMaterialsService.update(user.factoryId, id, dto, user.id);
  }

  @Delete('raw-materials/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate (soft-delete) a raw material' })
  async deleteRawMaterial(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rawMaterialsService.delete(user.factoryId, id, user.id);
  }

  @Post('raw-materials/:id/adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjust raw material stock level' })
  async adjustRawMaterialStock(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { quantity: number; reason: string },
  ) {
    return this.rawMaterialsService.adjustStock(
      user.factoryId,
      id,
      dto.quantity,
      dto.reason,
      user.id,
    );
  }

  // ────────────────────────────────────────────────────────────
  // STORAGE LOCATIONS
  // ────────────────────────────────────────────────────────────

  @Get('storage-locations')
  @ApiOperation({ summary: 'List storage locations' })
  @ApiQuery({ name: 'zone', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findStorageLocations(
    @CurrentUser() user: RequestUser,
    @Query('zone') zone?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.inventoryService.findStorageLocations(user.factoryId, {
      zone,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('storage-locations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a storage location' })
  async createStorageLocation(@CurrentUser() user: RequestUser, @Body() dto: any) {
    const factoryId = user.factoryId ?? dto.factoryId;
    if (!factoryId) throw new NotFoundException('Factory context required');
    return this.inventoryService.createStorageLocation(factoryId, dto);
  }

  @Patch('storage-locations/:id')
  @ApiOperation({ summary: 'Update a storage location' })
  async updateStorageLocation(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.inventoryService.updateStorageLocation(user.factoryId, id, dto);
  }

  @Delete('storage-locations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a storage location' })
  async deleteStorageLocation(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.deleteStorageLocation(user.factoryId, id);
  }

  // ────────────────────────────────────────────────────────────
  // BOM MANAGEMENT
  // ────────────────────────────────────────────────────────────

  @Get('bom')
  @ApiOperation({ summary: 'List BOMs with items' })
  @ApiQuery({ name: 'skuId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findBOMs(
    @CurrentUser() user: RequestUser,
    @Query('skuId') skuId?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.inventoryService.findBOMs(user.factoryId, {
      skuId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get('bom/:id')
  @ApiOperation({ summary: 'Get BOM by ID with all items' })
  async getBOMById(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getBOMById(id);
  }

  @Post('bom')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create BOM for a SKU' })
  async createBOM(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.inventoryService.createBOM(user.factoryId, dto);
  }

  @Patch('bom/:id')
  @ApiOperation({ summary: 'Update BOM header (version, notes, active)' })
  async updateBOM(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.inventoryService.updateBOM(id, dto);
  }

  @Post('bom/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve BOM (sets active, deactivates other versions)' })
  async approveBOM(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.approveBOM(id, user.id);
  }

  @Post('bom/:id/items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add or update a BOM line item' })
  async upsertBOMItem(
    @Param('id', ParseUUIDPipe) bomId: string,
    @Body() dto: any,
  ) {
    return this.inventoryService.upsertBOMItem(bomId, dto);
  }

  @Delete('bom/:bomId/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a BOM line item' })
  async deleteBOMItem(
    @Param('bomId', ParseUUIDPipe) bomId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.inventoryService.deleteBOMItem(bomId, itemId);
  }

  // ────────────────────────────────────────────────────────────
  // MANUFACTURING PROCESSES
  // ────────────────────────────────────────────────────────────

  @Get('manufacturing-processes')
  @ApiOperation({ summary: 'List manufacturing processes / routings' })
  @ApiQuery({ name: 'skuId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findProcesses(
    @CurrentUser() user: RequestUser,
    @Query('skuId') skuId?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.inventoryService.findProcesses(user.factoryId, {
      skuId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('manufacturing-processes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a manufacturing process with routing steps' })
  async createProcess(@CurrentUser() user: RequestUser, @Body() dto: any) {
    const factoryId = user.factoryId ?? dto.factoryId;
    if (!factoryId) throw new NotFoundException('Factory context required');
    return this.inventoryService.createProcess(factoryId, dto);
  }

  @Patch('manufacturing-processes/:id')
  @ApiOperation({ summary: 'Update a manufacturing process' })
  async updateProcess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.inventoryService.updateProcess(id, dto);
  }

  @Post('manufacturing-processes/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve process (sets active, deactivates others for same SKU)' })
  async approveProcess(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.approveProcess(id, user.id);
  }

  @Post('manufacturing-processes/:id/revert-to-draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revert an approved process back to draft' })
  async revertToDraft(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.revertToDraft(id);
  }

  @Get('manufacturing-processes/:id')
  @ApiOperation({ summary: 'Get a single manufacturing process by ID (with full step/dependency detail)' })
  async getProcess(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.findProcessById(user.factoryId, id);
  }

  @Delete('manufacturing-processes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a draft manufacturing process' })
  async deleteProcess(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.deleteProcess(user.factoryId, id);
  }

  // ────────────────────────────────────────────────────────────
  // STOCK MOVEMENTS
  // ────────────────────────────────────────────────────────────

  @Get('stock-movements')
  @ApiOperation({ summary: 'Universal stock movement ledger with filters' })
  @ApiQuery({ name: 'entityType', required: false, description: 'SPARE_PART | RAW_MATERIAL | PRODUCT' })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'movementType', required: false, description: 'RECEIPT | ISSUE | RETURN | ADJUSTMENT | RESERVATION | RELEASE | CONSUMPTION' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'ISO 8601 date string' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'ISO 8601 date string' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findStockMovements(
    @CurrentUser() user: RequestUser,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('movementType') movementType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.stockMovementsService.findMovements(user.factoryId, {
      entityType,
      entityId,
      movementType,
      dateFrom,
      dateTo,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }
}
