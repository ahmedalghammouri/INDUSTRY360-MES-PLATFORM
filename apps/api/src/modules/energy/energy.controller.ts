import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EnergyService } from './energy.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('Energy')
@ApiBearerAuth('JWT-auth')
@Controller('energy')
export class EnergyController {
  constructor(private readonly energyService: EnergyService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Energy management overview KPIs' })
  @ApiQuery({ name: 'areaId', required: false })
  @ApiQuery({ name: 'lineId', required: false })
  @ApiQuery({ name: 'machineId', required: false })
  async getOverview(
    @CurrentUser() user: RequestUser,
    @Query('areaId') areaId?: string,
    @Query('lineId') lineId?: string,
    @Query('machineId') machineId?: string,
  ) {
    return this.energyService.getOverview(user.factoryId, { areaId, lineId, machineId });
  }

  @Get('meters')
  @ApiOperation({ summary: 'List all energy meters with last reading' })
  async findMeters(@CurrentUser() user: RequestUser) {
    return this.energyService.findMeters(user.factoryId);
  }

  @Post('meters')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an energy meter' })
  async createMeter(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.energyService.createMeter(user.factoryId, dto);
  }

  @Patch('meters/:id')
  @ApiOperation({ summary: 'Update an energy meter' })
  async updateMeter(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.energyService.updateMeter(user.factoryId, id, dto);
  }

  @Delete('meters/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate an energy meter' })
  async deleteMeter(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.energyService.deleteMeter(user.factoryId, id);
  }

  @Post('readings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add manual energy reading' })
  async addReading(
    @CurrentUser() user: RequestUser,
    @Body() dto: { meterId: string; value: number; timestamp?: string; source?: string },
  ) {
    return this.energyService.addReading(user.factoryId, dto);
  }

  @Get('consumption')
  @ApiOperation({ summary: 'Energy consumption data for charts' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'periodType', required: false })
  @ApiQuery({ name: 'meterId', required: false })
  async getConsumption(
    @CurrentUser() user: RequestUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('periodType') periodType?: string,
    @Query('meterId') meterId?: string,
  ) {
    return this.energyService.getConsumption(user.factoryId, { from, to, periodType, meterId });
  }
}
