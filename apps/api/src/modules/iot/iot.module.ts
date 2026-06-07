import { Module } from '@nestjs/common';
import { IotController } from './iot.controller';
import { IotService } from './iot.service';
import { MqttDriverService } from './drivers/mqtt-driver.service';
import { OpcuaDriverService } from './drivers/opcua-driver.service';
import { ModbusDriverService } from './drivers/modbus-driver.service';
import { IndustrialDriverFactory } from './drivers/driver-factory';
import { EnergyContextService } from './energy-context.service';

@Module({
  controllers: [IotController],
  providers: [
    IotService,
    MqttDriverService,
    OpcuaDriverService,
    ModbusDriverService,
    IndustrialDriverFactory,
    EnergyContextService,
  ],
  exports: [IotService, IndustrialDriverFactory, EnergyContextService],
})
export class IotModule {}
