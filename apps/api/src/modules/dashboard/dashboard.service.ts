import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(tenantId: string) {
    const [kpis, machines, productionStatus, alarms] = await Promise.all([
      this.getKPIs(tenantId),
      this.getMachineStatus(tenantId),
      this.getProductionStatus(tenantId),
      this.getActiveAlarms(tenantId),
    ]);

    return {
      kpis,
      machines,
      productionStatus,
      alarms,
      productionTrend: this.generateProductionTrend(),
      qualityTrend: this.generateQualityTrend(),
      downtimePareto: this.generateDowntimePareto(),
      shiftSummary: await this.getCurrentShiftSummary(tenantId),
    };
  }

  private async getKPIs(tenantId: string) {
    // Aggregate OEE and KPIs from recent production records
    const now = new Date();
    const dayStart = new Date(now.setHours(0, 0, 0, 0));

    const productionRecords = await this.prisma.productionRecord.findMany({
      where: { tenantId, createdAt: { gte: dayStart } },
    });

    if (productionRecords.length === 0) {
      return this.getMockKPIs();
    }

    const avgOEE = productionRecords.reduce((sum, r) => sum + (r.oee ?? 0), 0) / productionRecords.length;
    const avgAvailability = productionRecords.reduce((sum, r) => sum + (r.availability ?? 0), 0) / productionRecords.length;
    const avgPerformance = productionRecords.reduce((sum, r) => sum + (r.performance ?? 0), 0) / productionRecords.length;
    const avgQuality = productionRecords.reduce((sum, r) => sum + (r.quality ?? 0), 0) / productionRecords.length;
    const totalOutput = productionRecords.reduce((sum, r) => sum + (r.actualQty ?? 0), 0);

    const activeAlarms = await this.prisma.alarm.count({
      where: { tenantId, status: 'ACTIVE', acknowledgedAt: null },
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

  private async getMachineStatus(tenantId: string) {
    const equipment = await this.prisma.equipment.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        latestStatus: true,
        activeWorkOrders: { include: { workOrder: true } },
      },
      take: 20,
    });

    return equipment.map((eq) => ({
      id: eq.id,
      name: eq.name,
      code: eq.code,
      state: eq.latestStatus?.state ?? 'OFFLINE',
      oee: eq.latestStatus?.oee ?? 0,
      currentOrder: eq.activeWorkOrders[0]?.workOrder?.orderNumber,
      throughput: eq.latestStatus?.throughput ?? 0,
      runtime: eq.latestStatus?.runtimeMinutes ?? 0,
      lastUpdate: eq.latestStatus?.updatedAt?.toISOString() ?? new Date().toISOString(),
      area: eq.areaName ?? 'Unknown',
    }));
  }

  private async getProductionStatus(tenantId: string) {
    const [totalLines, activeWOs] = await Promise.all([
      this.prisma.equipment.count({ where: { tenantId, type: 'PRODUCTION_LINE', deletedAt: null } }),
      this.prisma.workOrder.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
    ]);

    const completedToday = await this.prisma.workOrder.count({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });

    return {
      runningLines: Math.min(activeWOs, totalLines),
      totalLines,
      activeOrders: activeWOs,
      completedToday,
      plannedOutput: 1200,
      actualOutput: 980,
    };
  }

  private async getActiveAlarms(tenantId: string) {
    return this.prisma.alarm.findMany({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: [{ severity: 'desc' }, { triggeredAt: 'desc' }],
      take: 10,
      include: { equipment: { select: { name: true } } },
    }).then((alarms) =>
      alarms.map((a) => ({
        id: a.id,
        code: a.code,
        description: a.description,
        severity: a.severity,
        machine: a.equipment?.name ?? 'Unknown',
        triggeredAt: a.triggeredAt.toISOString(),
        acknowledged: !!a.acknowledgedAt,
      })),
    );
  }

  private async getCurrentShiftSummary(tenantId: string) {
    const activeShift = await this.prisma.shiftLog.findFirst({
      where: { tenantId, endTime: null },
      include: { shift: true, operator: true },
      orderBy: { startTime: 'desc' },
    });

    if (!activeShift) return this.getMockShiftSummary();

    const elapsed = (Date.now() - activeShift.startTime.getTime()) / 60_000;

    return {
      shiftName: activeShift.shift?.name ?? 'Day Shift',
      operator: activeShift.operator?.name ?? 'Operator',
      startTime: activeShift.startTime.toISOString(),
      elapsed: Math.round(elapsed),
      output: activeShift.actualOutput ?? 0,
      target: activeShift.targetOutput ?? 400,
      oee: activeShift.oee ?? 82.5,
      downtime: activeShift.downtimeMinutes ?? 0,
      defects: activeShift.defectCount ?? 0,
    };
  }

  private generateProductionTrend() {
    const hours = Array.from({ length: 12 }, (_, i) => {
      const h = new Date();
      h.setHours(h.getHours() - (11 - i));
      return `${h.getHours()}:00`;
    });
    return hours.map((time, i) => ({
      time,
      actual: 80 + Math.round(Math.random() * 40),
      target: 100,
      efficiency: 75 + Math.round(Math.random() * 20),
    }));
  }

  private generateQualityTrend() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((time) => ({
      time,
      fpy: 95 + Math.random() * 4,
      rework: 1 + Math.random() * 2,
      scrap: 0.2 + Math.random() * 0.8,
    }));
  }

  private generateDowntimePareto() {
    const reasons = [
      { reason: 'Mechanical Failure', duration: 145, frequency: 12 },
      { reason: 'Material Shortage', duration: 98, frequency: 8 },
      { reason: 'Operator Break', duration: 72, frequency: 24 },
      { reason: 'Changeover', duration: 54, frequency: 6 },
      { reason: 'Quality Hold', duration: 38, frequency: 4 },
    ];
    const total = reasons.reduce((s, r) => s + r.duration, 0);
    let cum = 0;
    return reasons.map((r) => {
      cum += r.duration;
      return { ...r, cumulative: Math.round((cum / total) * 100) };
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
