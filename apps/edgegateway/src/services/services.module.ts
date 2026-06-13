import { Global, Module } from '@nestjs/common';
import { InfluxService } from './influx.service';
import { MqttService } from './mqtt.service';

@Global()
@Module({
  providers: [InfluxService, MqttService],
  exports: [InfluxService, MqttService],
})
export class ServicesModule {}
