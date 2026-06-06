import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NCRStatus, Severity } from '@prisma/client';

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  async getKPIs(factoryId: string | null) {
    const now = new Date();
    const dayStart = new Date(now.setHours(0, 0, 0, 0));
    const factoryFilter = factoryId ? { factoryId } : {};

    const [inspections, ncrs] = await Promise.all([
      this.prisma.inspectionResult.findMany({
        where: { ...factoryFilter, inspectedAt: { gte: dayStart } },
      }),
      this.prisma.nCR.count({
        where: { ...factoryFilter, status: NCRStatus.OPEN },
      }),
    ]);

    const totalInspected = inspections.reduce((s, i) => s + i.totalQty, 0);
    const totalPassed = inspections.reduce((s, i) => s + i.passQty, 0);
    const fpy = totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 99.2;

    const criticalNCRs = await this.prisma.nCR.count({
      where: { ...factoryFilter, status: NCRStatus.OPEN, severity: Severity.CRITICAL },
    });

    return {
      fpy: parseFloat(fpy.toFixed(1)),
      fpyTrend: 0.3,
      reworkRate: 1.2,
      scrapRate: 0.4,
      openNCRs: ncrs,
      criticalNCRs,
      passRate: fpy,
      cpk: 1.45,
    };
  }

  async findNCRs(factoryId: string | null, filters: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, status, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: any = {
      ...factoryFilter,
      ...(status && { status: status as NCRStatus }),
      ...(search && {
        OR: [
          { ncrNumber: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.nCR.count({ where }),
      this.prisma.nCR.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, total, page, limit };
  }

  async findInspections(factoryId: string | null, filters: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: any = {
      ...factoryFilter,
      ...(search && {
        OR: [
          { inspectionNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.inspectionResult.count({ where }),
      this.prisma.inspectionResult.findMany({
        where,
        include: { inspector: { select: { name: true } } },
        orderBy: { inspectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((i) => ({
        id: i.id,
        inspectionNumber: i.inspectionNumber,
        type: i.type,
        result: i.result,
        inspector: i.inspector.name,
        date: i.inspectedAt.toISOString(),
        passQty: i.passQty,
        failQty: i.failQty,
        totalQty: i.totalQty,
      })),
      total,
      page,
      limit,
    };
  }
}
