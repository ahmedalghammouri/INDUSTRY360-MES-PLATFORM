import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KpiService } from '../production/kpi.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kpi: KpiService,
  ) {}

  /** Resolve an analysis scope (area/line/machine) to the machine ids it covers. */
  private async scopeMachineIds(
    factoryId: string | null,
    scope?: { areaId?: string; lineId?: string; machineId?: string },
  ): Promise<string[] | undefined> {
    if (!scope || (!scope.areaId && !scope.lineId && !scope.machineId)) return undefined;
    const ms = await this.prisma.machine.findMany({
      where: {
        ...(factoryId ? { factoryId } : {}),
        ...(scope.machineId ? { id: scope.machineId } : {}),
        ...(scope.lineId ? { lineId: scope.lineId } : {}),
        ...(scope.areaId ? { line: { areaId: scope.areaId } } : {}),
      },
      select: { id: true },
    });
    return ms.map((m) => m.id);
  }

  async getOverview(
    factoryId: string | null,
    scope?: { areaId?: string; lineId?: string; machineId?: string },
  ) {
    const machineIds = await this.scopeMachineIds(factoryId, scope);
    const [kpis, machines, productionStatus, alarms] = await Promise.all([
      this.getKPIs(factoryId, machineIds),
      this.getMachineStatus(factoryId, machineIds),
      this.getProductionStatus(factoryId, machineIds),
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

  private async getKPIs(factoryId: string | null, machineIds?: string[]) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const prevDayStart = new Date(dayStart.getTime() - 86_400_000);
    const now = new Date();

    const factoryFilter = factoryId ? { factoryId } : {};
    const r1 = (n: number) => Math.round(n * 10) / 10;

    // Plant OEE is rolled up from JOB ORDERS (per-machine) via the shared engine —
    // so a routed WO contributes on every machine it ran, and scope works per-machine.
    const [today, prev, activeAlarms, prevAlarms] = await Promise.all([
      this.kpi.oeeAnalytics(factoryId, dayStart, now, machineIds, 'hour'),
      this.kpi.oeeAnalytics(factoryId, prevDayStart, dayStart, machineIds, 'hour'),
      this.prisma.alarmEvent.count({ where: { ...factoryFilter, acknowledgedAt: null, resolvedAt: null } }),
      this.prisma.alarmEvent.count({ where: { ...factoryFilter, triggeredAt: { gte: prevDayStart, lt: dayStart } } }),
    ]);

    const hasData = today.totalOutput > 0 && prev.totalOutput > 0;
    const trend = (t: number, p: number) => (hasData ? r1(t - p) : 0);

    return {
      oee: today.current.oee,
      availability: today.current.availability,
      performance: today.current.performance,
      quality: today.current.quality,
      totalOutput: today.totalOutput,
      activeAlarms,
      oeeTrend: trend(today.current.oee, prev.current.oee),
      availabilityTrend: trend(today.current.availability, prev.current.availability),
      performanceTrend: trend(today.current.performance, prev.current.performance),
      qualityTrend: trend(today.current.quality, prev.current.quality),
      outputTrend: trend(today.totalOutput, prev.totalOutput),
      alarmTrend: activeAlarms - prevAlarms,
    };
  }

  private async getMachineStatus(factoryId: string | null, machineIds?: string[]) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const scopeFilter = machineIds ? { id: { in: machineIds } } : {};

    const machines = await this.prisma.machine.findMany({
      where: { ...factoryFilter, ...scopeFilter, isActive: true },
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

  private async getProductionStatus(factoryId: string | null, machineIds?: string[]) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const machineScope = machineIds ? { machineId: { in: machineIds } } : {};
    const idScope = machineIds ? { id: { in: machineIds } } : {};
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [totalMachines, activeWOs, completedToday, shiftTargets, outputToday] = await Promise.all([
      this.prisma.machine.count({ where: { ...factoryFilter, ...idScope, isActive: true } }),
      this.prisma.workOrder.count({ where: { ...factoryFilter, ...machineScope, status: 'IN_PROGRESS' } }),
      this.prisma.workOrder.count({
        where: { ...factoryFilter, ...machineScope, status: 'COMPLETED', actualEnd: { gte: dayStart } },
      }),
      // Planned output = sum of today's shift targets (real shift model)
      this.prisma.shiftInstance.aggregate({
        where: { ...factoryFilter, startTime: { gte: dayStart } },
        _sum: { targetQty: true },
      }),
      // Actual output = today's recorded OEE output
      this.prisma.oEERecord.aggregate({
        where: { ...factoryFilter, ...machineScope, recordDate: { gte: dayStart } },
        _sum: { totalOutput: true },
      }),
    ]);

    return {
      runningLines: Math.min(activeWOs, totalMachines),
      totalLines: totalMachines,
      activeOrders: activeWOs,
      completedToday,
      plannedOutput: shiftTargets._sum.targetQty ?? 0,
      actualOutput: outputToday._sum.totalOutput ?? 0,
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

    if (!activeShift) return null; // no active shift right now — UI renders an idle state

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
      // Unplanned-loss Pareto only — planned downtime (break/cleaning) is excluded
      where: { ...factoryFilter, startTime: { gte: dayStart }, durationMinutes: { not: null }, isPlanned: false },
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

}
