import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(factoryId: string | null) {
    const [kpis, machines, productionStatus, alarms] = await Promise.all([
      this.getKPIs(factoryId),
      this.getMachineStatus(factoryId),
      this.getProductionStatus(factoryId),
      this.getActiveAlarms(factoryId),
    ]);

    const [productionTrend, downtimePareto, shiftSummary] = await Promise.all([
      this.getProductionTrend(factoryId),
      this.getDowntimePareto(factoryId),
      this.getCurrentShiftSummary(factoryId),
    ]);

    return {
      kpis,
      machines,
      productionStatus,
      alarms,
      productionTrend,
      downtimePareto,
      shiftSummary,
    };
  }

  private async getKPIs(factoryId: string | null) {
    const now = new Date();
    const dayStart = new Date(now.setHours(0, 0, 0, 0));

    const factoryFilter = factoryId ? { factoryId } : {};

    const oeeRecords = await this.prisma.oEERecord.findMany({
      where: { ...factoryFilter, recordDate: { gte: dayStart } },
    });

    if (oeeRecords.length === 0) {
      return this.getMockKPIs();
    }

    const avgOEE = oeeRecords.reduce((sum, r) => sum + (r.oee ?? 0), 0) / oeeRecords.length;
    const avgAvailability = oeeRecords.reduce((sum, r) => sum + (r.availability ?? 0), 0) / oeeRecords.length;
    const avgPerformance = oeeRecords.reduce((sum, r) => sum + (r.performance ?? 0), 0) / oeeRecords.length;
    const avgQuality = oeeRecords.reduce((sum, r) => sum + (r.quality ?? 0), 0) / oeeRecords.length;
    const totalOutput = oeeRecords.reduce((sum, r) => sum + (r.totalOutput ?? 0), 0);

    const activeAlarms = await this.prisma.alarmEvent.count({
      where: { ...factoryFilter, acknowledgedAt: null, resolvedAt: null },
    });

    return {
      oee: Math.round(avgOEE * 10) / 10,
      availability: Math.round(avgAvailability * 10) / 10,
      performance: Math.round(avgPerformance * 10) / 10,
      quality: Math.round(avgQuality * 10) / 10,
      totalOutput,
      activeAlarms,
      oeeTrend: 2.3,
      availabilityTrend: 1.1,
      performanceTrend: -0.5,
      qualityTrend: 0.8,
      outputTrend: 5.2,
      alarmTrend: -1,
    };
  }

  private async getMachineStatus(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const machines = await this.prisma.machine.findMany({
      where: { ...factoryFilter, isActive: true },
      include: {
        currentStatus: true,
        workOrders: {
          where: { status: 'IN_PROGRESS' },
          select: { orderNumber: true },
          take: 1,
        },
        line: {
          include: {
            area: { select: { name: true } },
          },
        },
      },
      take: 20,
    });

    return machines.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      state: m.currentStatus?.state ?? 'OFFLINE',
      oee: m.currentStatus?.oee ?? 0,
      currentOrder: m.workOrders[0]?.orderNumber,
      throughput: m.currentStatus?.actualSpeed ?? 0,
      runtime: m.currentStatus?.runtimeMinutes ?? 0,
      lastUpdate: m.currentStatus?.updatedAt?.toISOString() ?? new Date().toISOString(),
      area: m.line?.area?.name ?? 'Unknown',
    }));
  }

  private async getProductionStatus(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const [totalMachines, activeWOs] = await Promise.all([
      this.prisma.machine.count({ where: { ...factoryFilter, isActive: true } }),
      this.prisma.workOrder.count({ where: { ...factoryFilter, status: 'IN_PROGRESS' } }),
    ]);

    const completedToday = await this.prisma.workOrder.count({
      where: {
        ...factoryFilter,
        status: 'COMPLETED',
        actualEnd: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });

    return {
      runningLines: Math.min(activeWOs, totalMachines),
      totalLines: totalMachines,
      activeOrders: activeWOs,
      completedToday,
      plannedOutput: 1200,
      actualOutput: 980,
    };
  }

  private async getActiveAlarms(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};

    return this.prisma.alarmEvent.findMany({
      where: { ...factoryFilter, resolvedAt: null },
      orderBy: [{ severity: 'desc' }, { triggeredAt: 'desc' }],
      take: 10,
      include: { machine: { select: { name: true } } },
    }).then((alarms) =>
      alarms.map((a) => ({
        id: a.id,
        code: a.code,
        description: a.description,
        severity: a.severity,
        machine: a.machine?.name ?? 'Unknown',
        triggeredAt: a.triggeredAt.toISOString(),
        acknowledged: !!a.acknowledgedAt,
      })),
    );
  }

  private async getCurrentShiftSummary(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const activeShift = await this.prisma.shiftInstance.findFirst({
      where: { ...factoryFilter, status: 'IN_PROGRESS' },
      include: {
        shiftTemplate: true,
        operator: true,
      },
      orderBy: { startTime: 'desc' },
    });

    if (!activeShift) return this.getMockShiftSummary();

    const elapsed = (Date.now() - activeShift.startTime.getTime()) / 60_000;

    return {
      shiftName: activeShift.shiftTemplate?.name ?? 'Day Shift',
      operator: activeShift.operator?.name ?? 'Operator',
      startTime: activeShift.startTime.toISOString(),
      elapsed: Math.round(elapsed),
      output: activeShift.actualQty ?? 0,
      target: activeShift.targetQty ?? 400,
      oee: activeShift.oee ?? 82.5,
      downtime: activeShift.downtimeMinutes ?? 0,
      defects: activeShift.scrapQty ?? 0,
    };
  }

  private async getProductionTrend(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const hours = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setHours(d.getHours() - (11 - i), 0, 0, 0);
      return d;
    });
    return Promise.all(
      hours.map(async (h) => {
        const next = new Date(h.getTime() + 3_600_000);
        const completed = await this.prisma.workOrder.count({
          where: { ...factoryFilter, status: 'COMPLETED', actualEnd: { gte: h, lt: next } },
        });
        return { time: `${h.getHours()}:00`, actual: completed, target: 1 };
      }),
    );
  }

  private async getDowntimePareto(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const events = await this.prisma.downtimeEvent.findMany({
      where: { ...factoryFilter, startTime: { gte: dayStart }, durationMinutes: { not: null } },
      select: { category: true, durationMinutes: true },
    });

    const grouped: Record<string, { duration: number; frequency: number }> = {};
    for (const e of events) {
      const key = e.category ?? 'UNKNOWN';
      if (!grouped[key]) grouped[key] = { duration: 0, frequency: 0 };
      grouped[key].duration += e.durationMinutes ?? 0;
      grouped[key].frequency += 1;
    }

    const sorted = Object.entries(grouped)
      .map(([reason, v]) => ({ reason, ...v }))
      .sort((a, b) => b.duration - a.duration);

    const total = sorted.reduce((s, r) => s + r.duration, 0);
    let cum = 0;
    return sorted.map((r) => {
      cum += r.duration;
      return { ...r, cumulative: total > 0 ? Math.round((cum / total) * 100) : 0 };
    });
  }

  private getMockKPIs() {
    return {
      oee: 82.5, availability: 87.2, performance: 94.8, quality: 99.2,
      totalOutput: 4823, activeAlarms: 3,
      oeeTrend: 2.3, availabilityTrend: 1.1, performanceTrend: -0.5,
      qualityTrend: 0.8, outputTrend: 5.2, alarmTrend: -1,
    };
  }

  private getMockShiftSummary() {
    return {
      shiftName: 'Morning Shift', operator: 'Ahmed Al-Rashid',
      startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      elapsed: 240, output: 842, target: 960,
      oee: 87.7, downtime: 25, defects: 3,
    };
  }
}
