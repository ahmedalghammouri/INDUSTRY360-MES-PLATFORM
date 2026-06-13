import { Module } from '@nestjs/common';
import { BufferService } from './buffer.service';
import { IngestService } from './ingest.service';
import { CounterService } from './counter.service';
import { ModbusPollerService } from './modbus-poller.service';

@Module({
  providers: [BufferService, IngestService, CounterService, ModbusPollerService],
  exports: [ModbusPollerService, IngestService, CounterService, BufferService],
})
export class AcquisitionModule {}
