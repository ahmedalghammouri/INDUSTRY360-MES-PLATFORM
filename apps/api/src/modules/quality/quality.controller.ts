import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QualityService } from './quality.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('Quality')
@ApiBearerAuth('JWT-auth')
@Controller('quality')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get quality KPIs for current day' })
  async getKPIs(@CurrentUser() user: RequestUser) {
    return this.qualityService.getKPIs(user.factoryId);
  }

  @Get('ncr')
  @ApiOperation({ summary: 'List non-conformance reports' })
  async findNCRs(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.qualityService.findNCRs(user.factoryId, {
      search,
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get('inspections')
  @ApiOperation({ summary: 'List inspection results' })
  async findInspections(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.qualityService.findInspections(user.factoryId, {
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }
}
