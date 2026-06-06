import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get real-time operations dashboard data' })
  async getOverview(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getOverview(user.factoryId);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get current shift KPIs' })
  async getKPIs(@CurrentUser() user: RequestUser) {
    const data = await this.dashboardService.getOverview(user.factoryId);
    return data.kpis;
  }
}
