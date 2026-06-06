import {
  Controller, Get, Post, Patch, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { ProductionService } from './production.service';
import { OEEService } from './oee.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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

  @Get('kpis')
  @ApiOperation({ summary: 'Get production KPIs for current day' })
  async getKPIs(@CurrentUser() user: RequestUser) {
    return this.productionService.getKPIs(user.factoryId);
  }

  @Get('work-orders')
  @ApiOperation({ summary: 'List work orders with filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findWorkOrders(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.productionService.findWorkOrders(user.factoryId, {
      search,
      status: status as 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED',
      priority,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('work-orders')
  @RequirePermissions('production:write')
  @AuditLog('PRODUCTION_WO_CREATE')
  @ApiOperation({ summary: 'Create a new work order' })
  async createWorkOrder(
    @CurrentUser() user: RequestUser & { id: string },
    @Body() dto: {
      skuId: string;
      machineId: string;
      plannedQty: number;
      plannedStart: string;
      plannedEnd: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      notes?: string;
    },
  ) {
    return this.productionService.createWorkOrder(user.factoryId, user.id, {
      ...dto,
      plannedStart: new Date(dto.plannedStart),
      plannedEnd: new Date(dto.plannedEnd),
    });
  }

  @Patch('work-orders/:id/start')
  @RequirePermissions('production:execute')
  @AuditLog('PRODUCTION_WO_START')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a planned work order' })
  async startWorkOrder(
    @CurrentUser() user: RequestUser & { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productionService.startWorkOrder(user.factoryId, user.id, id);
  }

  @Patch('work-orders/:id/complete')
  @RequirePermissions('production:execute')
  @AuditLog('PRODUCTION_WO_COMPLETE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a work order' })
  async completeWorkOrder(
    @CurrentUser() user: RequestUser & { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { actualQty: number },
  ) {
    return this.productionService.completeWorkOrder(user.factoryId, user.id, id, body.actualQty);
  }

  @Post('oee/calculate')
  @ApiOperation({ summary: 'Calculate OEE from input values' })
  calculateOEE(@Body() body: {
    plannedProductionTime: number;
    downtime: number;
    idealCycleTime: number;
    totalCount: number;
    goodCount: number;
  }) {
    return this.oeeService.calculate(body);
  }
}
