import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse,
} from '@nestjs/swagger';

import { ProductionService } from './production.service';
import { OEEService } from './oee.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  StartWorkOrderDto,
  CompleteWorkOrderDto,
  HoldWorkOrderDto,
  CancelWorkOrderDto,
  RecordCountDto,
} from './dto/work-order.dto';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('Production')
@ApiBearerAuth('JWT-auth')
@Controller('production')
export class ProductionController {
  constructor(
    private readonly productionService: ProductionService,
    private readonly oeeService: OEEService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // KPIs & OEE
  // ────────────────────────────────────────────────────────────

  @Get('kpis')
  @ApiOperation({ summary: 'Get production KPIs for current day' })
  async getKPIs(@CurrentUser() user: RequestUser) {
    return this.productionService.getKPIs(user.factoryId);
  }

  @Get('oee/calculate')
  @ApiOperation({ summary: 'Get current OEE summary with trend and per-equipment breakdown' })
  async getOEESummary(@CurrentUser() user: RequestUser) {
    return this.productionService.getOEESummary(user.factoryId);
  }

  @Post('oee/calculate')
  @ApiOperation({ summary: 'Calculate OEE from manual input values' })
  calculateOEE(@Body() body: {
    plannedProductionTime: number;
    downtime: number;
    idealCycleTime: number;
    totalCount: number;
    goodCount: number;
  }) {
    return this.oeeService.calculate(body);
  }

  @Get('oee-records')
  @ApiOperation({ summary: 'Get stored OEE records' })
  @ApiQuery({ name: 'machineId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getOEERecords(
    @CurrentUser() user: RequestUser,
    @Query('machineId') machineId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.productionService.getOEERecords(user.factoryId, {
      machineId,
      dateFrom,
      dateTo,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  // ────────────────────────────────────────────────────────────
  // WORK ORDER CRUD
  // ────────────────────────────────────────────────────────────

  @Get('work-orders')
  @ApiOperation({ summary: 'List work orders with filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'machineId', required: false })
  @ApiQuery({ name: 'lineId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findWorkOrders(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('machineId') machineId?: string,
    @Query('lineId') lineId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.productionService.findWorkOrders(user.factoryId, {
      search,
      status: status as any,
      priority,
      machineId,
      lineId,
      dateFrom,
      dateTo,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get('work-orders/:id')
  @ApiOperation({ summary: 'Get a work order by ID with full detail' })
  async getWorkOrderById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productionService.getWorkOrderById(user.factoryId, id);
  }

  @Post('work-orders')
  @RequirePermissions('production:write')
  @AuditLog('PRODUCTION_WO_CREATE')
  @ApiOperation({ summary: 'Create a new work order' })
  @ApiResponse({ status: 201, description: 'Work order created' })
  async createWorkOrder(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWorkOrderDto,
  ) {
    return this.productionService.createWorkOrder(user.factoryId, user.id, dto);
  }

  @Patch('work-orders/:id')
  @RequirePermissions('production:write')
  @AuditLog('PRODUCTION_WO_UPDATE')
  @ApiOperation({ summary: 'Update work order metadata (not status)' })
  async updateWorkOrder(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkOrderDto,
  ) {
    return this.productionService.updateWorkOrder(user.factoryId, id, dto);
  }

  @Delete('work-orders/:id')
  @RequirePermissions('production:write')
  @AuditLog('PRODUCTION_WO_DELETE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a work order (cannot delete IN_PROGRESS)' })
  async deleteWorkOrder(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.productionService.deleteWorkOrder(user.factoryId, id);
  }

  // ────────────────────────────────────────────────────────────
  // STATE MACHINE TRANSITIONS
  // ────────────────────────────────────────────────────────────

  @Patch('work-orders/:id/start')
  @RequirePermissions('production:execute')
  @AuditLog('PRODUCTION_WO_START')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a planned/released work order → IN_PROGRESS' })
  async startWorkOrder(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartWorkOrderDto,
  ) {
    return this.productionService.startWorkOrder(user.factoryId, user.id, id, dto.operatorId);
  }

  @Patch('work-orders/:id/hold')
  @RequirePermissions('production:execute')
  @AuditLog('PRODUCTION_WO_HOLD')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hold an in-progress work order → ON_HOLD' })
  async holdWorkOrder(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HoldWorkOrderDto,
  ) {
    return this.productionService.holdWorkOrder(user.factoryId, user.id, id, dto);
  }

  @Patch('work-orders/:id/release')
  @RequirePermissions('production:execute')
  @AuditLog('PRODUCTION_WO_RELEASE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release a held work order → IN_PROGRESS' })
  async releaseWorkOrder(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productionService.releaseWorkOrder(user.factoryId, user.id, id);
  }

  @Patch('work-orders/:id/cancel')
  @RequirePermissions('production:write')
  @AuditLog('PRODUCTION_WO_CANCEL')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a work order' })
  async cancelWorkOrder(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelWorkOrderDto,
  ) {
    return this.productionService.cancelWorkOrder(user.factoryId, user.id, id, dto.reason);
  }

  @Patch('work-orders/:id/complete')
  @RequirePermissions('production:execute')
  @AuditLog('PRODUCTION_WO_COMPLETE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete an in-progress work order (triggers OEE calculation)' })
  async completeWorkOrder(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteWorkOrderDto,
  ) {
    return this.productionService.completeWorkOrder(user.factoryId, user.id, id, dto);
  }

  // ────────────────────────────────────────────────────────────
  // PRODUCTION COUNT RECORDING
  // ────────────────────────────────────────────────────────────

  @Post('work-orders/:id/count')
  @RequirePermissions('production:execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record production count update (called periodically during production)' })
  async recordCount(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordCountDto,
  ) {
    return this.productionService.recordCount(user.factoryId, id, dto);
  }

  // ────────────────────────────────────────────────────────────
  // BATCH RECORDS
  // ────────────────────────────────────────────────────────────

  @Get('batches')
  @ApiOperation({ summary: 'List batch records' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'workOrderId', required: false })
  @ApiQuery({ name: 'skuId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findBatches(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('workOrderId') workOrderId?: string,
    @Query('skuId') skuId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.productionService.findBatches(user.factoryId, {
      search, status, workOrderId, skuId,
      page: parseInt(page, 10), limit: parseInt(limit, 10),
    });
  }

  @Post('batches')
  @ApiOperation({ summary: 'Create batch record' })
  async createBatch(@CurrentUser() user: RequestUser, @Body() dto: any) {
    const factoryId = user.factoryId ?? dto.factoryId;
    if (!factoryId) throw new Error('Factory context required');
    return this.productionService.createBatch(factoryId, dto);
  }

  @Patch('batches/:id')
  @ApiOperation({ summary: 'Update batch record' })
  async updateBatch(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.productionService.updateBatch(user.factoryId, id, dto);
  }

  @Delete('batches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a non-active batch record' })
  async deleteBatch(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productionService.deleteBatch(user.factoryId, id);
  }
}
