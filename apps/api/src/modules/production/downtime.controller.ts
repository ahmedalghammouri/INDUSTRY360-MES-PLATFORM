import {
  Controller, Get, Post, Patch, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { DowntimeService } from './downtime.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateDowntimeEventDto,
  UpdateDowntimeEventDto,
  EndDowntimeEventDto,
  AcknowledgeDowntimeDto,
} from './dto/downtime.dto';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('Downtime')
@ApiBearerAuth('JWT-auth')
@Controller('downtime')
export class DowntimeController {
  constructor(private readonly downtimeService: DowntimeService) {}

  @Get('events')
  @ApiOperation({ summary: 'List downtime events with filters' })
  @ApiQuery({ name: 'machineId', required: false })
  @ApiQuery({ name: 'workOrderId', required: false })
  @ApiQuery({ name: 'isPlanned', required: false, type: Boolean })
  @ApiQuery({ name: 'isOpen', required: false, type: Boolean })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findEvents(
    @CurrentUser() user: RequestUser,
    @Query('machineId') machineId?: string,
    @Query('workOrderId') workOrderId?: string,
    @Query('isPlanned') isPlanned?: string,
    @Query('isOpen') isOpen?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.downtimeService.findDowntimeEvents(user.factoryId, {
      machineId,
      workOrderId,
      isPlanned: isPlanned !== undefined ? isPlanned === 'true' : undefined,
      isOpen: isOpen !== undefined ? isOpen === 'true' : undefined,
      dateFrom,
      dateTo,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('events')
  @RequirePermissions('production:execute')
  @AuditLog('DOWNTIME_EVENT_CREATE')
  @ApiOperation({ summary: 'Create a new downtime event for a machine' })
  async createEvent(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDowntimeEventDto,
  ) {
    return this.downtimeService.createDowntimeEvent(user.factoryId, user.id, dto);
  }

  @Patch('events/:id')
  @RequirePermissions('production:execute')
  @AuditLog('DOWNTIME_EVENT_UPDATE')
  @ApiOperation({ summary: 'Update downtime event (cause, category, notes)' })
  async updateEvent(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDowntimeEventDto,
  ) {
    return this.downtimeService.updateDowntimeEvent(user.factoryId, id, dto);
  }

  @Patch('events/:id/end')
  @RequirePermissions('production:execute')
  @AuditLog('DOWNTIME_EVENT_END')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End an open downtime event (set end time, record resolution)' })
  async endEvent(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndDowntimeEventDto,
  ) {
    return this.downtimeService.endDowntimeEvent(user.factoryId, id, user.id, dto);
  }

  @Patch('events/:id/acknowledge')
  @RequirePermissions('production:execute')
  @AuditLog('DOWNTIME_EVENT_ACK')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge a downtime event' })
  async acknowledgeEvent(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcknowledgeDowntimeDto,
  ) {
    return this.downtimeService.acknowledgeDowntimeEvent(user.factoryId, id, user.id, dto.notes);
  }

  @Get('causes')
  @ApiOperation({ summary: 'Get downtime cause codes (reference data)' })
  @ApiQuery({ name: 'machineId', required: false })
  async getCauses(
    @CurrentUser() user: RequestUser,
    @Query('machineId') machineId?: string,
  ) {
    return this.downtimeService.findDowntimeCauses(user.factoryId, machineId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get downtime summary for a date range' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getSummary(
    @CurrentUser() user: RequestUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const now = new Date();
    const from = dateFrom ? new Date(dateFrom) : new Date(now.setHours(0, 0, 0, 0));
    const to = dateTo ? new Date(dateTo) : new Date();
    return this.downtimeService.getDowntimeSummary(user.factoryId, from, to);
  }
}
