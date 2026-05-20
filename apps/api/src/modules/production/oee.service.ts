import { Injectable } from '@nestjs/common';

export interface OEEInput {
  plannedProductionTime: number; // minutes
  downtime: number; // minutes
  idealCycleTime: number; // minutes per unit
  totalCount: number;
  goodCount: number;
}

export interface OEEResult {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  actualRunTime: number;
}

@Injectable()
export class OEEService {
  calculate(input: OEEInput): OEEResult {
    const { plannedProductionTime, downtime, idealCycleTime, totalCount, goodCount } = input;

    const actualRunTime = plannedProductionTime - downtime;

    // Availability = Actual Run Time / Planned Production Time
    const availability = plannedProductionTime > 0
      ? (actualRunTime / plannedProductionTime) * 100
      : 0;

    // Performance = (Ideal Cycle Time × Total Count) / Actual Run Time
    const performance = actualRunTime > 0
      ? ((idealCycleTime * totalCount) / actualRunTime) * 100
      : 0;

    // Quality = Good Count / Total Count
    const quality = totalCount > 0 ? (goodCount / totalCount) * 100 : 0;

    // OEE = Availability × Performance × Quality
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

    return {
      oee: Math.min(Math.round(oee * 10) / 10, 100),
      availability: Math.min(Math.round(availability * 10) / 10, 100),
      performance: Math.min(Math.round(performance * 10) / 10, 100),
      quality: Math.min(Math.round(quality * 10) / 10, 100),
      actualRunTime,
    };
  }

  getClassification(oee: number): 'world-class' | 'good' | 'acceptable' | 'poor' {
    if (oee >= 85) return 'world-class';
    if (oee >= 65) return 'good';
    if (oee >= 45) return 'acceptable';
    return 'poor';
  }
}
