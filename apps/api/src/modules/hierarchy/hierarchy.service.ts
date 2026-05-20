import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  async getHierarchyTree(tenantId: string) {
    const sites = await this.prisma.site.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        areas: {
          where: { deletedAt: null },
          include: {
            equipment: {
              where: { deletedAt: null },
              include: { latestStatus: true },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return sites.map((site) => ({
      id: site.id,
      type: 'SITE',
      code: site.code,
      name: site.name,
      city: site.city,
      country: site.country,
      children: site.areas.map((area) => ({
        id: area.id,
        type: 'AREA',
        code: area.code,
        name: area.name,
        children: area.equipment.map((eq) => ({
          id: eq.id,
          type: 'EQUIPMENT',
          code: eq.code,
          name: eq.name,
          equipmentType: eq.type,
          state: eq.latestStatus?.state ?? 'OFFLINE',
          oee: eq.latestStatus?.oee,
        })),
      })),
    }));
  }

  async getSites(tenantId: string) {
    return this.prisma.site.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async getEquipment(tenantId: string, filters: { siteId?: string; areaId?: string; type?: string }) {
    return this.prisma.equipment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters.siteId && { siteId: filters.siteId }),
        ...(filters.areaId && { areaId: filters.areaId }),
        ...(filters.type && { type: filters.type }),
      },
      include: { latestStatus: true },
      orderBy: { name: 'asc' },
    });
  }
}
