import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QualityService } from './quality.service';

@ApiTags('Quality')
@ApiBearerAuth('JWT-auth')
@Controller('quality')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('kpis')
  async getKPIs(@Request() req: { user: { tenantId: string } }) {
    return this.qualityService.getKPIs(req.user.tenantId);
  }

  @Get('ncr')
  async findNCRs(
    @Request() req: { user: { tenantId: string } },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.qualityService.findNCRs(req.user.tenantId, {
      search,
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get('inspections')
  async findInspections(
    @Request() req: { user: { tenantId: string } },
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.qualityService.findInspections(req.user.tenantId, {
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }
}
