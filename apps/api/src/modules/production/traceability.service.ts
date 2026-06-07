import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';

type TraceEntityType = 'MATERIAL_LOT' | 'WORK_ORDER' | 'FINISHED_GOODS_LOT' | 'RECIPE';
type TraceLinkType = 'CONSUMED_BY' | 'PRODUCED_FROM' | 'GOVERNED_BY';

interface TraceNode {
  type: TraceEntityType;
  id: string;
  label: string;
  meta?: Record<string, unknown>;
  children?: TraceNode[];
}

@Injectable()
export class TraceabilityService {
  private readonly logger = new Logger(TraceabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Link recording ──────────────────────────────────────────

  /**
   * Records all traceability links when a Work Order completes.
   * Creates edges: MaterialLot→WO (CONSUMED_BY), WO→Recipe (GOVERNED_BY), WO→FGLot (PRODUCED_FROM)
   */
  @OnEvent('workorder.completed')
  async recordProductionLinks(payload: { workOrderId: string; factoryId: string; fgLotId?: string }) {
    const { workOrderId, factoryId, fgLotId } = payload;
    try {
      const wo = await this.prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          sku: { select: { name: true, code: true } },
          machine: { select: { code: true, name: true } },
        },
      });
      if (!wo) return;

      const links: Array<{
        parentType: TraceEntityType;
        parentId: string;
        childType: TraceEntityType;
        childId: string;
        linkType: TraceLinkType;
        factoryId: string;
        quantity?: number;
        unit?: string;
        metadata?: Record<string, unknown>;
      }> = [];

      // WO → Recipe link
      const recipe = await (this.prisma as any).recipe.findFirst({
        where: { skuId: wo.skuId, status: 'APPROVED' },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, name: true },
      });
      if (recipe) {
        links.push({
          parentType: 'WORK_ORDER',
          parentId: workOrderId,
          childType: 'RECIPE',
          childId: recipe.id,
          linkType: 'GOVERNED_BY',
          factoryId,
          metadata: { recipeVersion: recipe.version, recipeName: recipe.name },
        });
      }

      // MaterialLot → WO links (from materialConsumption records if they exist)
      const consumptions = await (this.prisma as any).materialConsumption?.findMany?.({
        where: { workOrderId },
        include: { materialLot: { select: { lotNumber: true, materialCode: true, materialName: true } } },
      }).catch(() => []) ?? [];

      for (const c of consumptions) {
        if (c.materialLotId) {
          links.push({
            parentType: 'MATERIAL_LOT',
            parentId: c.materialLotId,
            childType: 'WORK_ORDER',
            childId: workOrderId,
            linkType: 'CONSUMED_BY',
            factoryId,
            quantity: c.quantityUsed,
            unit: c.unit,
            metadata: {
              lotNumber: c.materialLot?.lotNumber,
              materialCode: c.materialLot?.materialCode,
              materialName: c.materialLot?.materialName,
            },
          });
        }
      }

      // WO → FG Lot link
      if (fgLotId) {
        links.push({
          parentType: 'WORK_ORDER',
          parentId: workOrderId,
          childType: 'FINISHED_GOODS_LOT',
          childId: fgLotId,
          linkType: 'PRODUCED_FROM',
          factoryId,
          metadata: { skuCode: wo.sku?.code, skuName: wo.sku?.name },
        });
      }

      if (links.length > 0) {
        await (this.prisma as any).traceabilityLink.createMany({ data: links, skipDuplicates: true });
        this.logger.log(`Recorded ${links.length} traceability links for WO ${workOrderId}`);
      }
    } catch (err) {
      this.logger.error(`Failed to record traceability links for WO ${workOrderId}`, err);
    }
  }

  /**
   * Manually record a single traceability link (for UI-driven lot consumption).
   */
  async recordLink(dto: {
    parentType: TraceEntityType;
    parentId: string;
    childType: TraceEntityType;
    childId: string;
    linkType: TraceLinkType;
    factoryId: string;
    quantity?: number;
    unit?: string;
  }) {
    return (this.prisma as any).traceabilityLink.create({ data: dto });
  }

  // ── Backward trace (FG Lot → inputs) ────────────────────────

  /**
   * Backward genealogy: starting from a Finished Goods Lot,
   * walks the graph to find → WO → Recipe + Operators + WorkCenters + Material Lots consumed.
   */
  async traceBackward(fgLotId: string): Promise<TraceNode> {
    // Find WO that produced this FG lot
    const woLinks = await (this.prisma as any).traceabilityLink.findMany({
      where: { childType: 'FINISHED_GOODS_LOT', childId: fgLotId, linkType: 'PRODUCED_FROM' },
    });

    const fgNode: TraceNode = {
      type: 'FINISHED_GOODS_LOT',
      id: fgLotId,
      label: `FG Lot: ${fgLotId.slice(0, 8)}`,
      children: [],
    };

    for (const woLink of woLinks) {
      const woId = woLink.parentId;
      const wo = await this.prisma.workOrder.findUnique({
        where: { id: woId },
        include: {
          sku: { select: { name: true, code: true } },
          machine: { select: { name: true, code: true } },
        },
      });
      if (!wo) continue;

      const woNode: TraceNode = {
        type: 'WORK_ORDER',
        id: woId,
        label: `WO: ${wo.orderNumber}`,
        meta: {
          skuCode: wo.sku?.code,
          skuName: wo.sku?.name,
          machine: wo.machine?.name,
          status: wo.status,
          startedAt: wo.actualStart?.toISOString(),
          completedAt: wo.actualEnd?.toISOString(),
          qtyProduced: wo.goodQty,
        },
        children: [],
      };

      // Recipe link
      const recipeLinks = await (this.prisma as any).traceabilityLink.findMany({
        where: { parentType: 'WORK_ORDER', parentId: woId, linkType: 'GOVERNED_BY' },
      });
      for (const rl of recipeLinks) {
        const recipe = await (this.prisma as any).recipe.findUnique({
          where: { id: rl.childId },
          select: { id: true, name: true, version: true, status: true, batchSize: true, batchUnit: true },
        });
        if (recipe) {
          woNode.children!.push({
            type: 'RECIPE',
            id: recipe.id,
            label: `Recipe: ${recipe.name} v${recipe.version}`,
            meta: { status: recipe.status, batchSize: recipe.batchSize, batchUnit: recipe.batchUnit },
          });
        }
      }

      // Material Lot links
      const matLinks = await (this.prisma as any).traceabilityLink.findMany({
        where: { childType: 'WORK_ORDER', childId: woId, linkType: 'CONSUMED_BY' },
      });
      for (const ml of matLinks) {
        const lot = await this.prisma.materialLot.findUnique({
          where: { id: ml.parentId },
          select: {
            id: true, lotNumber: true, materialCode: true, materialName: true,
            quantity: true, unit: true, expiryDate: true, status: true,
          },
        });
        if (lot) {
          woNode.children!.push({
            type: 'MATERIAL_LOT',
            id: lot.id,
            label: `Lot: ${lot.lotNumber} (${lot.materialCode})`,
            meta: {
              materialName: lot.materialName,
              quantity: ml.quantity ?? lot.quantity,
              unit: ml.unit ?? lot.unit,
              expiryDate: lot.expiryDate?.toISOString(),
              status: lot.status,
            },
          });
        }
      }

      fgNode.children!.push(woNode);
    }

    return fgNode;
  }

  // ── Forward trace (Material Lot → outputs) ───────────────────

  /**
   * Forward genealogy: starting from a Material Lot,
   * finds all WOs that consumed it → FG Lots produced.
   */
  async traceForward(materialLotId: string): Promise<TraceNode> {
    const lot = await this.prisma.materialLot.findUnique({
      where: { id: materialLotId },
      select: { id: true, lotNumber: true, materialCode: true, materialName: true, quantity: true, unit: true },
    });
    if (!lot) throw new NotFoundException(`Material Lot ${materialLotId} not found`);

    const matNode: TraceNode = {
      type: 'MATERIAL_LOT',
      id: materialLotId,
      label: `Lot: ${lot.lotNumber} (${lot.materialCode})`,
      meta: { materialName: lot.materialName, quantity: lot.quantity, unit: lot.unit },
      children: [],
    };

    // Find WOs that consumed this lot
    const consumedByLinks = await (this.prisma as any).traceabilityLink.findMany({
      where: { parentType: 'MATERIAL_LOT', parentId: materialLotId, linkType: 'CONSUMED_BY' },
    });

    for (const cl of consumedByLinks) {
      const woId = cl.childId;
      const wo = await this.prisma.workOrder.findUnique({
        where: { id: woId },
        include: {
          sku: { select: { name: true, code: true } },
          machine: { select: { name: true, code: true } },
        },
      });
      if (!wo) continue;

      const woNode: TraceNode = {
        type: 'WORK_ORDER',
        id: woId,
        label: `WO: ${wo.orderNumber}`,
        meta: {
          skuCode: wo.sku?.code,
          skuName: wo.sku?.name,
          machine: wo.machine?.name,
          status: wo.status,
          qtyProduced: wo.goodQty,
          completedAt: wo.actualEnd?.toISOString(),
        },
        children: [],
      };

      // Find FG Lots produced by this WO
      const fgLinks = await (this.prisma as any).traceabilityLink.findMany({
        where: { parentType: 'WORK_ORDER', parentId: woId, linkType: 'PRODUCED_FROM' },
      });
      for (const fg of fgLinks) {
        woNode.children!.push({
          type: 'FINISHED_GOODS_LOT',
          id: fg.childId,
          label: `FG Lot: ${fg.childId.slice(0, 8)}`,
          meta: { skuCode: wo.sku?.code, ...(fg.metadata ?? {}) },
        });
      }

      matNode.children!.push(woNode);
    }

    return matNode;
  }

  // ── Query: raw link list ─────────────────────────────────────

  async getLinksForEntity(entityType: TraceEntityType, entityId: string) {
    const [asParent, asChild] = await Promise.all([
      (this.prisma as any).traceabilityLink.findMany({
        where: { parentType: entityType, parentId: entityId },
        orderBy: { createdAt: 'asc' },
      }),
      (this.prisma as any).traceabilityLink.findMany({
        where: { childType: entityType, childId: entityId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { asParent, asChild };
  }

  async getTraceabilityStats(factoryId: string) {
    const [totalLinks, lotsTracked, wosTracked] = await Promise.all([
      (this.prisma as any).traceabilityLink.count({ where: { factoryId } }),
      (this.prisma as any).traceabilityLink.groupBy({
        by: ['parentId'],
        where: { factoryId, parentType: 'MATERIAL_LOT' },
        _count: true,
      }).then((r: any[]) => r.length),
      (this.prisma as any).traceabilityLink.groupBy({
        by: ['parentId'],
        where: { factoryId, parentType: 'WORK_ORDER' },
        _count: true,
      }).then((r: any[]) => r.length),
    ]);
    return { totalLinks, lotsTracked, wosTracked };
  }
}
