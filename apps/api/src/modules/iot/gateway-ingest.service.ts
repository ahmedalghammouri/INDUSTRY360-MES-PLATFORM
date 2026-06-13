import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';

import { PrismaService } from '../../database/prisma.service';
import { MqttDriverService } from './drivers/mqtt-driver.service';

/**
 * Subscribes to the edge gateways' Job-Order count topic
 * (`star-mes/<factory>/jo/<jobOrderId>/count`) and rolls live counts up to the
 * parent Work Order so MES dashboards reflect production in real time. This
 * keeps the gateway thin (it owns the raw JO increments) while the MES business
 * roll-up logic stays here, in the API.
 */
@Injectable()
export class GatewayIngestService implements OnModuleInit {
  private readonly logger = new Logger(GatewayIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttDriverService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    // Ensure the broker forwards JO count messages; concrete topics surface via
    // the driver's 'iot.tag.value' event which we filter below.
    try {
      this.mqtt.subscribeToTag('star-mes/+/jo/+/count', () => undefined);
      this.logger.log('Subscribed to edge-gateway JO count topic');
    } catch (err) {
      this.logger.warn(`Could not subscribe to JO count topic: ${(err as Error).message}`);
    }
  }

  @OnEvent('iot.tag.value')
  async onMqttMessage(payload: { topic: string; value: unknown }) {
    const match = payload.topic?.match(/\/jo\/([^/]+)\/count$/);
    if (!match) return;
    const jobOrderId = match[1];
    try {
      await this.rollUpWorkOrder(jobOrderId);
      this.eventEmitter.emit('iot.jo.count', {
        jobOrderId,
        ...(payload.value && typeof payload.value === 'object' ? (payload.value as object) : {}),
      });
    } catch (err) {
      this.logger.error(`JO count roll-up failed for ${jobOrderId}`, err as Error);
    }
  }

  /**
   * Recompute the Work Order's live quantities from its Job Orders:
   *  - goodQty  = good output of the LAST routing step (finished output)
   *  - scrapQty = sum of rejects across all steps
   *  - actualQty = good + scrap
   */
  private async rollUpWorkOrder(jobOrderId: string): Promise<void> {
    const jo = await this.prisma.jobOrder.findUnique({
      where: { id: jobOrderId },
      select: { workOrderId: true },
    });
    if (!jo?.workOrderId) return;

    const steps = await this.prisma.jobOrder.findMany({
      where: { workOrderId: jo.workOrderId },
      select: { sequenceOrder: true, actualQtyGood: true, actualQtyRejected: true },
    });
    if (!steps.length) return;

    const last = steps.reduce((a, b) => (b.sequenceOrder > a.sequenceOrder ? b : a));
    const good = Math.round(last.actualQtyGood ?? 0);
    const scrap = Math.round(steps.reduce((s, j) => s + (j.actualQtyRejected ?? 0), 0));

    await this.prisma.workOrder.update({
      where: { id: jo.workOrderId },
      data: { goodQty: good, scrapQty: scrap, actualQty: good + scrap },
    });
  }
}
