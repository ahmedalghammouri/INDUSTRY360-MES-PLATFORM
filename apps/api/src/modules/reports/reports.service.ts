import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProductionReport(factoryId: string | null, from: Date, to: Date) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const records = await this.prisma.oEERecord.findMany({
      where: { ...factoryFilter, recordDate: { gte: from, lte: to } },
      include: { machine: { select: { name: true, code: true } } },
      orderBy: { recordDate: 'asc' },
    });

    const totalPlanned = records.reduce((s, r) => s + r.totalOutput, 0);
    const totalActual = records.reduce((s, r) => s + r.totalOutput, 0);
    const totalGood = records.reduce((s, r) => s + r.goodOutput, 0);
    const totalDowntime = records.reduce((s, r) => s + r.downtimeMin, 0);
    const avgOEE = records.length ? records.reduce((s, r) => s + (r.oee ?? 0), 0) / records.length : 0;

    return {
      summary: {
        totalPlanned,
        totalActual,
        totalGood,
        totalScrap: totalActual - totalGood,
        efficiency: totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0,
        quality: totalActual > 0 ? (totalGood / totalActual) * 100 : 0,
        totalDowntime,
        avgOEE: parseFloat(avgOEE.toFixed(1)),
      },
      records: records.map((r) => ({
        date: r.recordDate.toISOString(),
        machine: r.machine.name,
        plannedQty: r.totalOutput,
        actualQty: r.totalOutput,
        goodQty: r.goodOutput,
        oee: r.oee,
        downtime: r.downtimeMin,
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
