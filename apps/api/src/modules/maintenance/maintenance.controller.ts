import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance')
@ApiBearerAuth('JWT-auth')
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('kpis')
  async getKPIs(@Request() req: { user: { tenantId: string } }) {
    return this.maintenanceService.getKPIs(req.user.tenantId);
  }

  @Get('work-orders')
  async findWorkOrders(
    @Request() req: { user: { tenantId: string } },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.maintenanceService.findWorkOrders(req.user.tenantId, {
      search,
      status,
      type,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }
}
