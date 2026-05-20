import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class IotService {
  constructor(private readonly prisma: PrismaService) {}

  async getDevices(tenantId: string, filters: { status?: string }) {
    return this.prisma.ioTDevice.findMany({
      where: {
        tenantId,
        ...(filters.status && { status: filters.status }),
        isActive: true,
      },
      include: {
        equipment: { select: { name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getDeviceStatus(deviceId: string) {
    const device = await this.prisma.ioTDevice.findUnique({
      where: { deviceId },
      include: {
        equipment: { select: { name: true, code: true } },
        tagValues: {
          orderBy: { timestamp: 'desc' },
          take: 10,
          include: { tag: { select: { name: true, unit: true } } },
        },
      },
    });
    return device;
  }

  async connectDevice(tenantId: string, deviceId: string) {
    await this.prisma.ioTDevice.update({
      where: { deviceId },
      data: { status: 'CONNECTED', lastSeenAt: new Date() },
    });
    return { status: 'CONNECTED', timestamp: new Date() };
  }

  async getTags(tenantId: string, deviceId?: string) {
    return this.prisma.ioTTag.findMany({
      where: {
        tenantId,
        ...(deviceId && { deviceId }),
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async recordTagValue(tagId: string, value: string, quality: string): Promise<void> {
    await this.prisma.ioTTagValue.create({
      data: { tagId, value, quality, timestamp: new Date() },
    });
  }
}
