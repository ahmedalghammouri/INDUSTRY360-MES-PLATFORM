import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse,
} from '@nestjs/swagger';

import { MaintenanceService } from './maintenance.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateMaintenanceWODto,
  UpdateMaintenanceWODto,
  AssignWODto,
  StartWODto,
  CompleteWODto,
  CancelWODto,
} from './dto/maintenance.dto';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('Maintenance')
@ApiBearerAuth('JWT-auth')
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // ────────────────────────────────────────────────────────────
  // KPIs
  // ────────────────────────────────────────────────────────────

  @Get('kpis')
  @ApiOperation({ summary: 'Get maintenance KPIs' })
  async getKPIs(@CurrentUser() user: RequestUser) {
    return this.maintenanceService.getKPIs(user.factoryId);
  }

  // ────────────────────────────────────────────────────────────
  // WORK ORDERS
  // ────────────────────────────────────────────────────────────

  @Get('work-orders')
  @ApiOperation({ summary: 'List maintenance work orders' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'machineId', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findWorkOrders(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('machineId') machineId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.maintenanceService.findWorkOrders(user.factoryId, {
      search,
      status,
      type,
      priority,
      machineId,
      assignedToId,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get('work-orders/:id')
  @ApiOperation({ summary: 'Get maintenance work order by ID' })
  async getWOById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.maintenanceService.getWOById(user.factoryId, id);
  }

  @Post('work-orders')
  @RequirePermissions('maintenance:write')
  @AuditLog('MAINTENANCE_WO_CREATE')
  @ApiOperation({ summary: 'Create a new maintenance work order' })
  @ApiResponse({ status: 201 })
  async createWO(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMaintenanceWODto,
  ) {
    return this.maintenanceService.createMaintenanceWO(user.factoryId, user.id, dto);
  }

  @Patch('work-orders/:id')
  @RequirePermissions('maintenance:write')
  @AuditLog('MAINTENANCE_WO_UPDATE')
  @ApiOperation({ summary: 'Update maintenance work order details' })
  async updateWO(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceWODto,
  ) {
    return this.maintenanceService.updateWO(user.factoryId, id, dto);
  }

  @Delete('work-orders/:id')
  @RequirePermissions('maintenance:write')
  @AuditLog('MAINTENANCE_WO_DELETE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a maintenance work order' })
  async deleteWO(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.maintenanceService.deleteWO(user.factoryId, id);
  }

  // ────────────────────────────────────────────────────────────
  // STATE MACHINE TRANSITIONS
  // ────────────────────────────────────────────────────────────

  @Patch('work-orders/:id/assign')
  @RequirePermissions('maintenance:write')
  @AuditLog('MAINTENANCE_WO_ASSIGN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign WO to a technician → ASSIGNED' })
  async assignWO(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignWODto,
  ) {
    return this.maintenanceService.assignWO(user.factoryId, id, dto);
  }

  @Patch('work-orders/:id/start')
  @RequirePermissions('maintenance:execute')
  @AuditLog('MAINTENANCE_WO_START')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a maintenance work order → IN_PROGRESS (sets machine to MAINTENANCE state)' })
  async startWO(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartWODto,
  ) {
    return this.maintenanceService.startWO(user.factoryId, id, dto);
  }

  @Patch('work-orders/:id/complete')
  @RequirePermissions('maintenance:execute')
  @AuditLog('MAINTENANCE_WO_COMPLETE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a maintenance WO (logs time, cost, spare parts consumption)' })
  async completeWO(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteWODto,
  ) {
    return this.maintenanceService.completeWO(user.factoryId, id, dto);
  }

  @Patch('work-orders/:id/cancel')
  @RequirePermissions('maintenance:write')
  @AuditLog('MAINTENANCE_WO_CANCEL')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a maintenance work order' })
  async cancelWO(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelWODto,
  ) {
    return this.maintenanceService.cancelWO(user.factoryId, id, user.id, dto);
  }

  // ────────────────────────────────────────────────────────────
  // SPARE PARTS
  // ────────────────────────────────────────────────────────────

  @Get('spare-parts')
  @ApiOperation({ summary: 'List spare parts inventory' })
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
    return this.maintenanceService.findSpareParts(user.factoryId, {
      search,
      category,
      lowStock: lowStock === 'true',
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  // ────────────────────────────────────────────────────────────
  // PM PLANS & TASKS
  // ────────────────────────────────────────────────────────────

  @Get('pm-plans')
  @ApiOperation({ summary: 'List preventive maintenance plans' })
  @ApiQuery({ name: 'machineId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findPMPlans(
    @CurrentUser() user: RequestUser,
    @Query('machineId') machineId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.maintenanceService.findPMPlans(user.factoryId, {
      machineId,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  // ────────────────────────────────────────────────────────────
  // PREVENTIVE MAINTENANCE (/preventive alias for PM Plans)
  // ────────────────────────────────────────────────────────────

  @Get('preventive/kpis')
  @ApiOperation({ summary: 'Get preventive maintenance KPIs' })
  async getPreventiveKPIs(@CurrentUser() user: RequestUser) {
    return this.maintenanceService.getPreventiveKPIs(user.factoryId);
  }

  @Get('preventive')
  @ApiOperation({ summary: 'List preventive maintenance schedules' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findPreventive(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.maintenanceService.findPreventiveSchedules(user.factoryId, {
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('preventive')
  @ApiOperation({ summary: 'Create a preventive maintenance schedule' })
  async createPreventive(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.maintenanceService.createPreventiveSchedule(user.factoryId, dto);
  }

  @Patch('preventive/:id')
  @ApiOperation({ summary: 'Update a preventive maintenance schedule' })
  async updatePreventive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.maintenanceService.updatePreventiveSchedule(user.factoryId, id, dto);
  }

  @Delete('preventive/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a preventive maintenance schedule' })
  async deletePreventive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.maintenanceService.deletePreventiveSchedule(user.factoryId, id);
  }

  // ────────────────────────────────────────────────────────────
  // ASSETS (Machine-based)
  // ────────────────────────────────────────────────────────────

  @Get('assets')
  @ApiOperation({ summary: 'List machines / assets' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAssets(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.maintenanceService.findAssets(user.factoryId, {
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('assets')
  @ApiOperation({ summary: 'Register a new asset (machine)' })
  async createAsset(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.maintenanceService.createAsset(user.factoryId, dto);
  }

  @Patch('assets/:id')
  @ApiOperation({ summary: 'Update asset details' })
  async updateAsset(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.maintenanceService.updateAsset(user.factoryId, id, dto);
  }

  @Delete('assets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an asset' })
  async deleteAsset(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.maintenanceService.deleteAsset(user.factoryId, id);
  }

  // ────────────────────────────────────────────────────────────
  // SPARE PARTS KPIs
  // ────────────────────────────────────────────────────────────

  @Get('spare-parts/kpis')
  @ApiOperation({ summary: 'Get spare parts KPIs' })
  async getSparePartsKPIs(@CurrentUser() user: RequestUser) {
    return this.maintenanceService.getSparePartsKPIs(user.factoryId);
  }

  @Get('pm-tasks')
  @ApiOperation({ summary: 'List PM task schedule' })
  @ApiQuery({ name: 'machineId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findPMTasks(
    @CurrentUser() user: RequestUser,
    @Query('machineId') machineId?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.maintenanceService.findPMTasks(user.factoryId, {
      machineId,
      status,
      dateFrom,
      dateTo,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }
}
