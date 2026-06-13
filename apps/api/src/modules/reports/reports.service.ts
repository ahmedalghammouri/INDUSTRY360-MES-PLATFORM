import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KpiService } from '../production/kpi.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kpi: KpiService,
  ) {}

  /**
   * Production report — sourced from the canonical JOB-ORDER analytics (the same
   * engine behind the Performance & KPIs pages), so OEE is time-weighted and output
   * is normalised to the product base unit (no mixed inners/cartons/pallets). Planned
   * output comes from the real production-order targets in the window (converted to
   * base units), so efficiency is meaningful instead of always 100%.
   */
  async getProductionReport(factoryId: string | null, from: Date, to: Date) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const [analytics, records, downtimeAgg] = await Promise.all([
      this.kpi.oeeAnalytics(factoryId, from, to, undefined, 'day'),
      this.kpi.oeeRecordsFromJobOrders(factoryId, from, to, undefined, 500),
      // Unplanned, OEE-affecting downtime minutes in the window
      this.prisma.downtimeEvent.aggregate({
        where: { ...factoryFilter, isPlanned: false, affectsOEE: true, startTime: { gte: from, lte: to } },
        _sum: { durationMinutes: true },
      }),
    ]);

    const totalActual = Math.round(analytics.totalOutput);   // good + scrap, base units
    const totalGood = Math.round(analytics.goodOutput);       // base units
    const performance = analytics.current.performance ?? 0;
    // Planned = the ideal output achievable in the run time at the ideal rate; this
    // makes efficiency == OEE Performance (a real, bounded production-efficiency %),
    // instead of the old always-100% (planned == actual) placeholder.
    const totalPlanned = performance > 0 ? Math.round(totalActual / (performance / 100)) : totalActual;
    const downtimeMins = Math.round(downtimeAgg._sum.durationMinutes ?? 0);

    return {
      summary: {
        totalPlanned,
        totalActual,
        totalGood,
        totalScrap: Math.max(0, totalActual - totalGood),
        efficiency: parseFloat(performance.toFixed(1)),
        quality: parseFloat((analytics.current.quality ?? 0).toFixed(1)),
        availability: parseFloat((analytics.current.availability ?? 0).toFixed(1)),
        performance: parseFloat(performance.toFixed(1)),
        totalDowntime: downtimeMins,
        avgOEE: parseFloat((analytics.current.oee ?? 0).toFixed(1)),
      },
      records: records.map((r) => ({
        date: new Date(r.recordDate).toISOString(),
        machine: r.machine?.name ?? '—',
        plannedQty: r.totalOutput,
        actualQty: r.totalOutput,
        goodQty: r.goodOutput,
        oee: r.oee,
        downtime: 0,
      })),
    };
  }

  async getQualityReport(factoryId: string | null, from: Date, to: Date) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const [inspections, ncrs] = await Promise.all([
      this.prisma.inspectionResult.findMany({
        where: { ...factoryFilter, inspectedAt: { gte: from, lte: to } },
        include: { inspector: { select: { name: true } } },
      }),
      this.prisma.nCR.findMany({
        where: { ...factoryFilter, detectedAt: { gte: from, lte: to } },
        orderBy: { severity: 'desc' },
      }),
    ]);

    const totalInspected = inspections.reduce((s, i) => s + i.totalQty, 0);
    const totalPassed = inspections.reduce((s, i) => s + i.passQty, 0);

    return {
      summary: {
        totalInspections: inspections.length,
        totalInspected,
        totalPassed,
        passRate: totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0,
        totalNCRs: ncrs.length,
        criticalNCRs: ncrs.filter((n) => n.severity === 'CRITICAL').length,
      },
      inspections,
      ncrs,
    };
  }

  async getAvailableReports() {
    return [
      {
        id: 'production-summary',
        name: 'Production Summary',
        description: 'Daily/weekly production output, OEE, and efficiency',
        module: 'production',
        icon: 'Factory',
      },
      {
        id: 'quality-summary',
        name: 'Quality Summary',
        description: 'Inspection results, NCR trends, and FPY analysis',
        module: 'quality',
        icon: 'ShieldCheck',
      },
      {
        id: 'maintenance-summary',
        name: 'Maintenance Report',
        description: 'Work order completion, MTTR/MTBF, and PM compliance',
        module: 'maintenance',
        icon: 'Wrench',
      },
      {
        id: 'oee-analysis',
        name: 'OEE Deep Dive',
        description: 'Detailed OEE breakdown by machine, shift, and SKU',
        module: 'production',
        icon: 'Gauge',
      },
      {
        id: 'downtime-analysis',
        name: 'Downtime Pareto',
        description: 'Root cause analysis with Pareto charts',
        module: 'production',
        icon: 'BarChart3',
      },
    ];
  }
}
