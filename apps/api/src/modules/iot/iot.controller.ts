import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IotService } from './iot.service';
import { IndustrialDriverFactory } from './drivers/driver-factory';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('IIoT')
@ApiBearerAuth('JWT-auth')
@Controller('iot')
export class IotController {
  constructor(
    private readonly iotService: IotService,
    private readonly driverFactory: IndustrialDriverFactory,
  ) {}

  @Get('devices')
  @ApiOperation({ summary: 'List IoT devices' })
  async getDevices(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    return this.iotService.getDevices(user.factoryId, { status });
  }

  @Get('devices/:id/status')
  @ApiOperation({ summary: 'Get device connection status' })
  async getDeviceStatus(@Param('id') id: string) {
    return this.iotService.getDeviceStatus(id);
  }

  @Post('devices/:id/connect')
  @ApiOperation({ summary: 'Connect to an IoT device' })
  async connectDevice(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.iotService.connectDevice(user.factoryId, id);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Browse tag hierarchy' })
  async getTags(
    @CurrentUser() user: RequestUser,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.iotService.getTags(user.factoryId, deviceId);
  }

  @Post('tags/read')
  @ApiOperation({ summary: 'Read tag values' })
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
}
