import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { OEEService } from './oee.service';

@Module({
  controllers: [ProductionController],
  providers: [ProductionService, OEEService],
  exports: [ProductionService, OEEService],
})
export class ProductionModule {}
