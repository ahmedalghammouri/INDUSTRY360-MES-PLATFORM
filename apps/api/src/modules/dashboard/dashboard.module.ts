import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ProductionModule } from '../production/production.module';

@Module({
  imports: [ProductionModule], // for KpiService (job-order OEE engine)
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
