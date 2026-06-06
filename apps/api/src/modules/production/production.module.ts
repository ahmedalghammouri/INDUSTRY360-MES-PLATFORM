import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { OEEService } from './oee.service';
import { DowntimeController } from './downtime.controller';
import { DowntimeService } from './downtime.service';

@Module({
  controllers: [ProductionController, DowntimeController],
  providers: [ProductionService, OEEService, DowntimeService],
  exports: [ProductionService, OEEService, DowntimeService],
})
export class ProductionModule {}
