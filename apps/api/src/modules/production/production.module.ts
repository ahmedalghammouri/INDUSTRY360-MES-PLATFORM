import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { OEEService } from './oee.service';
import { DowntimeController } from './downtime.controller';
import { DowntimeService } from './downtime.service';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { TraceabilityService } from './traceability.service';
import { TraceabilityController } from './traceability.controller';

@Module({
  controllers: [ProductionController, DowntimeController, RecipeController, TraceabilityController],
  providers: [ProductionService, OEEService, DowntimeService, RecipeService, TraceabilityService],
  exports: [ProductionService, OEEService, DowntimeService, RecipeService, TraceabilityService],
})
export class ProductionModule {}
