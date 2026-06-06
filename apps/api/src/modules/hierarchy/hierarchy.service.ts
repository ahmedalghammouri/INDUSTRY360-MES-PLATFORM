import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  async getHierarchyTree(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};

    const factories = await this.prisma.factory.findMany({
      where: factoryId ? { id: factoryId } : {},
      include: {
        areas: {
          where: { isActive: true },
          include: {
            productionLines: {
              where: { isActive: true },
              include: {
                machines: {
                  where: { isActive: true },
                  include: { currentStatus: true },
                  orderBy: { name: 'asc' },
                },
              },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return factories.map((factory) => ({
      id: factory.id,
      type: 'FACTORY',
      code: factory.code,
      name: factory.name,
      city: factory.city,
      country: factory.country,
      children: factory.areas.map((area) => ({
        id: area.id,
        type: 'AREA',
        code: area.code,
        name: area.name,
        children: area.productionLines.map((line) => ({
          id: line.id,
          type: 'PRODUCTION_LINE',
          code: line.code,
          name: line.name,
          children: line.machines.map((m) => ({
            id: m.id,
            type: 'MACHINE',
            code: m.code,
            name: m.name,
            machineType: m.machineType,
            state: m.currentStatus?.state ?? 'OFFLINE',
            oee: m.currentStatus?.oee,
          })),
        })),
      })),
    }));
  }

  async getFactories(factoryId: string | null) {
    return this.prisma.factory.findMany({
      where: factoryId ? { id: factoryId } : {},
      orderBy: { name: 'asc' },
    });
  }

  async getMachines(factoryId: string | null, filters: { areaId?: string; lineId?: string; type?: string }) {
    const factoryFilter = factoryId ? { factoryId } : {};

    return this.prisma.machine.findMany({
      where: {
        ...factoryFilter,
        isActive: true,
        ...(filters.areaId && { areaId: filters.areaId }),
        ...(filters.lineId && { lineId: filters.lineId }),
        ...(filters.type && { machineType: filters.type as 'MACHINE' }),
      },
      include: { currentStatus: true },
      orderBy: { name: 'asc' },
    });
  }
}
