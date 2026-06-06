import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EnergyPeriod } from '@prisma/client';

@Injectable()
export class EnergyService {
  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────
  // OVERVIEW
  // ────────────────────────────────────────────────────────────

  async getOverview(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [meterCount, monthlySummaries, dailySummaries] = await Promise.all([
      this.prisma.energyMeter.count({ where: { ...factoryFilter, isActive: true } }),
      this.prisma.energySummary.findMany({
        where: { ...factoryFilter, periodType: EnergyPeriod.DAILY, periodStart: { gte: monthStart } },
        include: { meter: { select: { type: true } } },
      }),
      this.prisma.energySummary.findMany({
        where: { ...factoryFilter, periodType: EnergyPeriod.DAILY, periodStart: { gte: dayStart } },
        include: { meter: { select: { type: true } } },
      }),
    ]);

    const totalMTD = monthlySummaries.reduce((s, r) => s + r.totalConsumption, 0);
    const costMTD = monthlySummaries.reduce((s, r) => s + (r.cost ?? 0), 0);
    const totalToday = dailySummaries.reduce((s, r) => s + r.totalConsumption, 0);

    const byType: Record<string, number> = {};
    for (const s of monthlySummaries) {
      const t = s.meter.type;
      byType[t] = (byType[t] ?? 0) + s.totalConsumption;
    }

    // Trend: last 7 days daily totals
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const trendSummaries = await this.prisma.energySummary.findMany({
      where: { ...factoryFilter, periodType: EnergyPeriod.DAILY, periodStart: { gte: sevenDaysAgo } },
      include: { meter: { select: { type: true } } },
      orderBy: { periodStart: 'asc' },
    });

    const byDate: Record<string, number> = {};
    for (const s of trendSummaries) {
      const d = s.periodStart.toISOString().slice(5, 10); // MM-DD
      byDate[d] = (byDate[d] ?? 0) + s.totalConsumption;
    }

    return {
      meterCount,
      totalConsumptionMtd: parseFloat(totalMTD.toFixed(2)),
      totalCostMtd: parseFloat(costMTD.toFixed(2)),
      totalConsumptionToday: parseFloat(totalToday.toFixed(2)),
      byType,
      trend: Object.entries(byDate).map(([date, value]) => ({ date, value: parseFloat(value.toFixed(2)) })),
    };
  }

  // ────────────────────────────────────────────────────────────
  // METERS
  // ────────────────────────────────────────────────────────────

  async findMeters(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const meters = await this.prisma.energyMeter.findMany({
      where: { ...factoryFilter, isActive: true },
      include: {
        machine: { select: { name: true, code: true } },
        area: { select: { name: true } },
        readings: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { value: true, unit: true, timestamp: true, source: true },
        },
        summaries: {
          where: {
            periodType: EnergyPeriod.DAILY,
            periodStart: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          select: { totalConsumption: true, cost: true },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    return meters.map(m => ({
      id: m.id,
      meterNumber: m.meterNumber,
      name: m.name,
      type: m.type,
      unit: m.unit,
      brand: m.brand,
      location: m.location,
      machine: m.machine,
      area: m.area,
      lastReading: m.readings[0] ?? null,
      mtdConsumption: parseFloat(
        m.summaries.reduce((s, r) => s + r.totalConsumption, 0).toFixed(2),
      ),
      mtdCost: parseFloat(m.summaries.reduce((s, r) => s + (r.cost ?? 0), 0).toFixed(2)),
    }));
  }

  // ────────────────────────────────────────────────────────────
  // READINGS
  // ────────────────────────────────────────────────────────────

  async addReading(factoryId: string | null, dto: {
    meterId: string;
    value: number;
    timestamp?: string;
    source?: string;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const meter = await this.prisma.energyMeter.findFirst({
      where: { id: dto.meterId, ...factoryFilter },
    });
    if (!meter) throw new NotFoundException('Energy meter not found');

    return this.prisma.energyReading.create({
      data: {
        meterId: dto.meterId,
        factoryId: meter.factoryId,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
        value: dto.value,
        unit: meter.unit,
        source: dto.source ?? 'MANUAL',
      },
    });
  }

  // ────────────────────────────────────────────────────────────
  // CONSUMPTION REPORT
  // ────────────────────────────────────────────────────────────

  async getConsumption(factoryId: string | null, filters: {
    from: string;
    to: string;
    periodType?: string;
    meterId?: string;
  }) {
    const { from, to, periodType = 'DAILY', meterId } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const summaries = await this.prisma.energySummary.findMany({
      where: {
        ...factoryFilter,
        periodType: periodType as EnergyPeriod,
        periodStart: { gte: new Date(from), lte: new Date(to) },
        ...(meterId && { meterId }),
      },
      include: {
        meter: { select: { name: true, type: true, unit: true } },
      },
      orderBy: { periodStart: 'asc' },
    });

    // Aggregate by date for chart
    const byDate: Record<string, Record<string, number>> = {};
    for (const s of summaries) {
      const date = s.periodStart.toISOString().slice(0, 10);
      if (!byDate[date]) byDate[date] = {};
      const key = s.meter.type;
      byDate[date][key] = parseFloat(((byDate[date][key] ?? 0) + s.totalConsumption).toFixed(2));
    }

    return {
      summaries,
      chart: Object.entries(byDate).map(([date, values]) => ({ date: date.slice(5), ...values })),
    };
  }

  // ────────────────────────────────────────────────────────────
  // METER CRUD
  // ────────────────────────────────────────────────────────────

  async createMeter(factoryId: string | null, dto: {
    meterNumber: string; name: string; type: string; unit: string;
    location?: string; brand?: string; machineId?: string; areaId?: string;
  }) {
    const resolvedFactoryId = factoryId ?? await this.getDefaultFactoryId();
    return this.prisma.energyMeter.create({
      data: {
        factoryId: resolvedFactoryId,
        meterNumber: dto.meterNumber,
        name: dto.name,
        type: dto.type as any,
        unit: dto.unit,
        location: dto.location,
        brand: dto.brand,
        machineId: dto.machineId || null,
        areaId: dto.areaId || null,
        isActive: true,
      },
    });
  }

  async updateMeter(factoryId: string | null, id: string, dto: {
    name?: string; type?: string; unit?: string; location?: string; brand?: string;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const meter = await this.prisma.energyMeter.findFirst({ where: { id, ...factoryFilter } });
    if (!meter) throw new NotFoundException('Energy meter not found');
    return this.prisma.energyMeter.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type as any }),
        ...(dto.unit && { unit: dto.unit }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
      },
    });
  }

  async deleteMeter(factoryId: string | null, id: string) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const meter = await this.prisma.energyMeter.findFirst({ where: { id, ...factoryFilter } });
    if (!meter) throw new NotFoundException('Energy meter not found');
    await this.prisma.energyMeter.update({ where: { id }, data: { isActive: false } });
  }

  private async getDefaultFactoryId(): Promise<string> {
    const factory = await this.prisma.factory.findFirst({ where: { isActive: true } });
    if (!factory) throw new NotFoundException('No active factory found');
    return factory.id;
  }
}
