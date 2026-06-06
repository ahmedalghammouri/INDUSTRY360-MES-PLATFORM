import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('Maintenance')
@ApiBearerAuth('JWT-auth')
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get maintenance KPIs' })
  async getKPIs(@CurrentUser() user: RequestUser) {
    return this.maintenanceService.getKPIs(user.factoryId);
  }

  @Get('work-orders')
  @ApiOperation({ summary: 'List maintenance work orders' })
  async findWorkOrders(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.maintenanceService.findWorkOrders(user.factoryId, {
      search,
      status,
      type,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }
}
