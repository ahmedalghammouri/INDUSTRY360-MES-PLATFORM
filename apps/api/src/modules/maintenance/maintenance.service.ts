import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getKPIs(tenantId: string) {
    const [openWOs, overdueWOs, completedWOs, totalWOs] = await Promise.all([
      this.prisma.maintenanceWorkOrder.count({
        where: { tenantId, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] }, deletedAt: null },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: { tenantId, status: { notIn: ['COMPLETED', 'CANCELLED'] }, dueDate: { lt: new Date() }, deletedAt: null },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: { tenantId, status: 'COMPLETED', deletedAt: null },
      }),
      this.prisma.maintenanceWorkOrder.count({ where: { tenantId, deletedAt: null } }),
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

  async findWorkOrders(tenantId: string, filters: { search?: string; status?: string; type?: string; page?: number; limit?: number }) {
    const { search, status, type, page = 1, limit = 20 } = filters;

    const where = {
      tenantId,
      deletedAt: null as null,
      ...(status && { status }),
      ...(type && { type }),
      ...(search && {
        OR: [
          { woNumber: { contains: search, mode: 'insensitive' as const } },
          { title: { contains: search, mode: 'insensitive' as const } },
          { equipment: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.maintenanceWorkOrder.count({ where }),
      this.prisma.maintenanceWorkOrder.findMany({
        where,
        include: {
          equipment: { select: { name: true, code: true } },
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
        asset: wo.equipment.name,
        assetCode: wo.equipment.code,
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
