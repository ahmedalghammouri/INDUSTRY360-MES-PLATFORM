import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { IotService, TelemetryDto } from './iot.service';
import { IndustrialDriverFactory } from './drivers/driver-factory';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

class TagValueDto {
  @IsString() tagCode!: string;
  @IsString() value!: string;
  @IsOptional() @IsString() quality?: string;
}

class IngestTelemetryDto implements TelemetryDto {
  @IsString() machineId!: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsNumber() actualSpeed?: number;
  @IsOptional() @IsNumber() goodCount?: number;
  @IsOptional() @IsNumber() rejectCount?: number;
  @IsOptional() @IsNumber() runtimeDelta?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TagValueDto)
  tagValues?: TagValueDto[];
}

@ApiTags('IIoT')
@ApiBearerAuth('JWT-auth')
@Controller('iot')
export class IotController {
  constructor(
    private readonly iotService: IotService,
    private readonly driverFactory: IndustrialDriverFactory,
  ) {}

  @Post('ingest')
  @ApiOperation({
    summary: 'Ingest machine telemetry',
    description: 'Push real-time machine state, speed, counts, and tag values from PLCs/HMIs/simulators.',
  })
  async ingestTelemetry(
    @CurrentUser() user: RequestUser,
    @Body() dto: IngestTelemetryDto,
  ) {
    return this.iotService.ingestTelemetry(user.factoryId, dto);
  }

  @Get('machines/states')
  @ApiOperation({ summary: 'Get live state of all machines in the factory' })
  async getMachineStates(@CurrentUser() user: RequestUser) {
    return this.iotService.getMachineStates(user.factoryId);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List IoT devices' })
  async getDevices(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    return this.iotService.getDevices(user.factoryId, { status });
  }

  @Get('devices/:id/status')
  @ApiOperation({ summary: 'Get device connection status and latest tag values' })
  async getDeviceStatus(@Param('id') id: string) {
    return this.iotService.getDeviceStatus(id);
  }

  @Post('devices/:id/connect')
  @ApiOperation({ summary: 'Mark device as CONNECTED' })
  async connectDevice(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.iotService.connectDevice(user.factoryId, id);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Browse tag definitions' })
  async getTags(
    @CurrentUser() user: RequestUser,
    @Query('deviceId') deviceId?: string,
    @Query('machineId') machineId?: string,
  ) {
    return this.iotService.getTags(user.factoryId, { deviceId, machineId });
  }

  @Post('tags/read')
  @ApiOperation({ summary: 'Read live tag values via industrial protocol driver' })
  async readTags(
    @Body() body: { deviceId: string; addresses: string[]; protocol: string },
  ) {
    const driver = this.driverFactory.getDriver(body.protocol as 'MQTT' | 'OPCUA' | 'MODBUS');
    const results: Record<string, unknown> = {};
    for (const addr of body.addresses) {
      results[addr] = await driver.readTag(addr);
    }
    return results;
  }

  @Get('protocols')
  @ApiOperation({ summary: 'List supported industrial protocols' })
  getSupportedProtocols() {
    return {
      protocols: this.driverFactory.getSupportedProtocols(),
      details: [
        { protocol: 'MQTT', description: 'Message Queue Telemetry Transport', port: 1883 },
        { protocol: 'OPCUA', description: 'OPC Unified Architecture', port: 4840 },
        { protocol: 'MODBUS', description: 'Modbus TCP/IP', port: 502 },
        { protocol: 'S7', description: 'Siemens S7 Protocol', port: 102 },
        { protocol: 'FINS', description: 'Omron FINS', port: 9600 },
        { protocol: 'HTTP', description: 'REST/HTTP Integration', port: 80 },
      ],
    };
  }

  // ────────────────────────────────────────────────────────────
  // DEVICE CRUD
  // ────────────────────────────────────────────────────────────

  @Get('devices/kpis')
  @ApiOperation({ summary: 'Device connection KPIs' })
  async getDeviceKPIs(@CurrentUser() user: RequestUser) {
    return this.iotService.getDeviceKPIs(user.factoryId);
  }

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new industrial device' })
  async createDevice(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.iotService.createDevice(user.factoryId, dto);
  }

  @Patch('devices/:id')
  @ApiOperation({ summary: 'Update device details' })
  async updateDevice(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.iotService.updateDevice(user.factoryId, id, dto);
  }

  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a device' })
  async deleteDevice(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.iotService.deleteDevice(user.factoryId, id);
  }

  // ────────────────────────────────────────────────────────────
  // TAG CRUD
  // ────────────────────────────────────────────────────────────

  @Post('tags')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tag definition' })
  async createTag(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.iotService.createTag(user.factoryId, dto);
  }

  @Patch('tags/:id')
  @ApiOperation({ summary: 'Update a tag definition' })
  async updateTag(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.iotService.updateTag(user.factoryId, id, dto);
  }

  @Delete('tags/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a tag definition' })
  async deleteTag(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.iotService.deleteTag(user.factoryId, id);
  }
}
