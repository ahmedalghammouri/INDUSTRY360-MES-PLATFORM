import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('Inventory')
@ApiBearerAuth('JWT-auth')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

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
}
