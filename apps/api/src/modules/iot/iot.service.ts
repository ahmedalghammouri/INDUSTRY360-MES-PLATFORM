import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class IotService {
  constructor(private readonly prisma: PrismaService) {}

  async getDevices(factoryId: string | null, filters: { status?: string }) {
    const factoryFilter = factoryId ? { factoryId } : {};

    return this.prisma.device.findMany({
      where: {
        ...factoryFilter,
        ...(filters.status && { status: filters.status }),
        isActive: true,
      },
      include: {
        machine: { select: { name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getDeviceStatus(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        machine: { select: { name: true, code: true } },
        tagDefinitions: {
          where: { isActive: true },
          include: {
            currentValue: true,
          },
          orderBy: { name: 'asc' },
          take: 10,
        },
      },
    });
    return device;
  }

  async connectDevice(factoryId: string | null, deviceId: string) {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { status: 'CONNECTED', lastSeenAt: new Date() },
    });
    return { status: 'CONNECTED', timestamp: new Date() };
  }

  async getTags(factoryId: string | null, deviceId?: string) {
    const factoryFilter = factoryId ? { factoryId } : {};

    return this.prisma.tagDefinition.findMany({
      where: {
        ...factoryFilter,
        ...(deviceId && { deviceId }),
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async recordTagValue(tagId: string, value: string, quality: string): Promise<void> {
    await this.prisma.tagCurrentValue.upsert({
      where: { tagId },
      create: {
        tagId,
        factoryId: (await this.prisma.tagDefinition.findUnique({ where: { id: tagId }, select: { factoryId: true } }))?.factoryId ?? '',
        value,
        quality: quality as 'GOOD' | 'BAD' | 'UNCERTAIN' | 'NOT_CONNECTED',
        timestamp: new Date(),
      },
      update: {
        value,
        quality: quality as 'GOOD' | 'BAD' | 'UNCERTAIN' | 'NOT_CONNECTED',
        timestamp: new Date(),
      },
    });
  }
}
