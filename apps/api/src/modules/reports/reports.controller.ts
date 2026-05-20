import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List available report templates' })
  getAvailableReports() {
    return this.reportsService.getAvailableReports();
  }

  @Get('production')
  async getProductionReport(
    @Request() req: { user: { tenantId: string } },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getProductionReport(
      req.user.tenantId,
      new Date(from || Date.now() - 7 * 24 * 3600000),
      new Date(to || Date.now()),
    );
  }

  @Get('quality')
  async getQualityReport(
    @Request() req: { user: { tenantId: string } },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getQualityReport(
      req.user.tenantId,
      new Date(from || Date.now() - 7 * 24 * 3600000),
      new Date(to || Date.now()),
    );
  }
}
