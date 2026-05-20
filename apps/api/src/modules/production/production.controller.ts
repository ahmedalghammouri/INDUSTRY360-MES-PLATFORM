import {
  Controller, Get, Post, Patch, Body, Param, Query, Request,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { ProductionService } from './production.service';
import { OEEService } from './oee.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';

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
  async getKPIs(@Request() req: { user: { tenantId: string } }) {
    return this.productionService.getKPIs(req.user.tenantId);
  }

  @Get('work-orders')
  @ApiOperation({ summary: 'List work orders with filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findWorkOrders(
    @Request() req: { user: { tenantId: string } },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.productionService.findWorkOrders(req.user.tenantId, {
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
    @Request() req: { user: { tenantId: string; id: string } },
    @Body() dto: {
      productId: string;
      equipmentId: string;
      plannedQty: number;
      plannedStart: string;
      plannedEnd: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      recipeId?: string;
      notes?: string;
    },
  ) {
    return this.productionService.createWorkOrder(req.user.tenantId, req.user.id, {
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
    @Request() req: { user: { tenantId: string; id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productionService.startWorkOrder(req.user.tenantId, req.user.id, id);
  }

  @Patch('work-orders/:id/complete')
  @RequirePermissions('production:execute')
  @AuditLog('PRODUCTION_WO_COMPLETE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a work order' })
  async completeWorkOrder(
    @Request() req: { user: { tenantId: string; id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { actualQty: number },
  ) {
    return this.productionService.completeWorkOrder(req.user.tenantId, req.user.id, id, body.actualQty);
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
