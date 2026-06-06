import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MaintStatus, MaintType, Priority } from '@prisma/client';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getKPIs(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const [openWOs, overdueWOs, completedWOs, totalWOs] = await Promise.all([
      this.prisma.maintenanceWO.count({
        where: { ...factoryFilter, status: { in: [MaintStatus.OPEN, MaintStatus.ASSIGNED, MaintStatus.IN_PROGRESS] }, deletedAt: null },
      }),
      this.prisma.maintenanceWO.count({
        where: { ...factoryFilter, status: { notIn: [MaintStatus.COMPLETED, MaintStatus.CANCELLED] }, dueDate: { lt: new Date() }, deletedAt: null },
      }),
      this.prisma.maintenanceWO.count({
        where: { ...factoryFilter, status: MaintStatus.COMPLETED, deletedAt: null },
      }),
      this.prisma.maintenanceWO.count({ where: { ...factoryFilter, deletedAt: null } }),
    ]);

    const completionRate = totalWOs > 0 ? (completedWOs / totalWOs) * 100 : 0;

    return {
      openWOs,
      overdueWOs,
      completionRate: parseFloat(completionRate.toFixed(1)),
      mttr: 4.2,
      mtbf: 520,
      availabilityRate: 97.8,
      pmCompliance: 88.5,
    };
  }

  async findWorkOrders(factoryId: string | null, filters: {
    search?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, status, type, page = 1, limit = 20 } = filters;
    const factoryFilter = factoryId ? { factoryId } : {};

    const where: any = {
      ...factoryFilter,
      deletedAt: null,
      ...(status && { status: status as MaintStatus }),
      ...(type && { type: type as MaintType }),
      ...(search && {
        OR: [
          { woNumber: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { machine: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.maintenanceWO.count({ where }),
      this.prisma.maintenanceWO.findMany({
        where,
        include: {
          machine: { select: { name: true, code: true } },
          assignedTo: { select: { name: true } },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((wo) => ({
        id: wo.id,
        woNumber: wo.woNumber,
        title: wo.title,
        type: wo.type,
        priority: wo.priority,
        status: wo.status,
        asset: wo.machine.name,
        assetCode: wo.machine.code,
        assignedTo: wo.assignedTo?.name,
        createdAt: wo.createdAt.toISOString(),
        dueDate: wo.dueDate?.toISOString(),
        estimatedHours: wo.estimatedHours,
        actualHours: wo.actualHours,
        description: wo.description,
      })),
      total,
      page,
      limit,
    };
  }
}
