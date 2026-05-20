import { Controller, Get, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get real-time operations dashboard data' })
  async getOverview(@Request() req: { user: { tenantId: string } }) {
    return this.dashboardService.getOverview(req.user.tenantId);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get current shift KPIs' })
  async getKPIs(@Request() req: { user: { tenantId: string } }) {
    const data = await this.dashboardService.getOverview(req.user.tenantId);
    return data.kpis;
  }
}
