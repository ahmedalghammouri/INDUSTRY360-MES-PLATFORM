import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { HistorianService } from './historian.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser { id: string; factoryId: string | null }

@ApiTags('Historian')
@ApiBearerAuth('JWT-auth')
@Controller('historian')
export class HistorianController {
  constructor(private readonly historian: HistorianService) {}

  @Get('health')
  @ApiOperation({ summary: 'Historian (InfluxDB) availability' })
  health() {
    return { enabled: this.historian.isEnabled() };
  }

  @Get('oee-trend')
  @ApiOperation({ summary: 'OEE / availability time-series for a machine (classic + time-based)' })
  @ApiQuery({ name: 'machineId', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'everyMin', required: false, type: Number })
  oeeTrend(
    @Query('machineId') machineId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('everyMin') everyMin?: string,
  ) {
    const toIso = to ?? new Date().toISOString();
    const fromIso = from ?? new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
    return this.historian.getOeeTrend(machineId, fromIso, toIso, everyMin ? parseInt(everyMin, 10) : 30);
  }

  @Get('production-trend')
  @ApiOperation({ summary: 'Production (good/rejected) time-series for a machine' })
  @ApiQuery({ name: 'machineId', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'everyMin', required: false, type: Number })
  productionTrend(
    @Query('machineId') machineId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('everyMin') everyMin?: string,
  ) {
    const toIso = to ?? new Date().toISOString();
    const fromIso = from ?? new Date(Date.now() - 24 * 3600_000).toISOString();
    return this.historian.getProductionTrend(machineId, fromIso, toIso, everyMin ? parseInt(everyMin, 10) : 30);
  }

  @Post('backfill')
  @ApiOperation({ summary: 'Backfill realistic historian series into InfluxDB (admin / first-run)' })
  backfill(@Body() body: { days?: number; stepMin?: number }) {
    return this.historian.backfill(body?.days ?? 14, body?.stepMin ?? 30);
  }

  @Post('sample')
  @ApiOperation({ summary: 'Force an immediate sample of all active job orders' })
  sample() {
    return this.historian.sampleActiveJobOrders().then((n) => ({ sampled: n }));
  }
}
