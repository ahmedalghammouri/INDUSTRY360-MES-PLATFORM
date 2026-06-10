import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { JobOrderStatus, WorkOrderStatus, Priority, DependencyType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { RunScheduleDto, RescheduleJobDto, CtpDto } from './dto/aps.dto';

const HOUR = 3_600_000;
const PRIORITY_WEIGHT: Record<Priority, number> = {
  CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
};
// Job orders that still consume capacity (not finished/cancelled)
const OPEN_JO: JobOrderStatus[] = [
  JobOrderStatus.SCHEDULED, JobOrderStatus.READY, JobOrderStatus.EXECUTING, JobOrderStatus.PAUSED,
];
const OPEN_WO: WorkOrderStatus[] = [
  WorkOrderStatus.PLANNED, WorkOrderStatus.RELEASED, WorkOrderStatus.IN_PROGRESS,
];

type JOWithRefs = {
  id: string;
  workOrderId: string;
  machineId: string | null;
  predecessorId: string | null;
  predecessorType: DependencyType;
  predecessorLagMins: number;
  sequenceOrder: number;
  operationName: string;
  status: JobOrderStatus;
  plannedQtyOut: number | null;
  plannedQtyIn: number | null;
  idealCycleTimeSec: number | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  machine: { id: string; name: string; code: string; designCapacity: number | null } | null;
  workOrder: {
    id: string; orderNumber: string; priority: Priority; plannedQty: number; plannedEnd: Date | null; skuId: string | null;
    productionOrder: { id: string; orderNumber: string } | null;
  };
};

@Injectable()
export class ApsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireFactory(factoryId: string | null): string {
    if (!factoryId) throw new BadRequestException('A factory context is required for APS');
    return factoryId;
  }

  /** Operation duration in ms: cycle-time × qty, else machine design capacity, else 1h. */
  private durationMs(jo: JOWithRefs): number {
    const qty = jo.plannedQtyOut ?? jo.plannedQtyIn ?? jo.workOrder.plannedQty ?? 1;
    if (jo.idealCycleTimeSec && jo.idealCycleTimeSec > 0) return Math.max(qty * jo.idealCycleTimeSec * 1000, 5 * 60_000);
    const cap = jo.machine?.designCapacity ?? 0;
    if (cap > 0) return Math.max((qty / cap) * HOUR, 5 * 60_000);
    return HOUR;
  }

  private async loadOpenJobs(factoryId: string): Promise<JOWithRefs[]> {
    return this.prisma.jobOrder.findMany({
      where: { factoryId, status: { in: OPEN_JO }, machineId: { not: null } },
      select: {
        id: true, workOrderId: true, machineId: true, predecessorId: true,
        predecessorType: true, predecessorLagMins: true, sequenceOrder: true,
        operationName: true, status: true, plannedQtyOut: true, plannedQtyIn: true, idealCycleTimeSec: true,
        plannedStart: true, plannedEnd: true,
        machine: { select: { id: true, name: true, code: true, designCapacity: true } },
        workOrder: {
          select: {
            id: true, orderNumber: true, priority: true, plannedQty: true, plannedEnd: true, skuId: true,
            productionOrder: { select: { id: true, orderNumber: true } },
          },
        },
      },
    }) as unknown as Promise<JOWithRefs[]>;
  }

  // ────────────────────────────────────────────────────────────
  // FINITE-CAPACITY FORWARD SCHEDULER (the "Factory Navigator")
  // ────────────────────────────────────────────────────────────

  /**
   * Recalculate a feasible production plan: sequence every open operation onto
   * its machine respecting finite capacity (no overlap per machine), operation
   * precedence (predecessor must finish), work-order priority and due dates.
   * Persists plannedStart/plannedEnd on each job order.
   */
  async runSchedule(factoryId: string | null, dto: RunScheduleDto) {
    const fid = this.requireFactory(factoryId);
    const horizon = dto.startFrom ? new Date(dto.startFrom).getTime() : Date.now();

    const jobs = await this.loadOpenJobs(fid);
    if (jobs.length === 0) throw new BadRequestException('No open operations to schedule. Release work orders first.');

    // Group operations by work order, ordered by priority → due date.
    const byWo = new Map<string, JOWithRefs[]>();
    for (const j of jobs) {
      if (!byWo.has(j.workOrderId)) byWo.set(j.workOrderId, []);
      byWo.get(j.workOrderId)!.push(j);
    }
    const woOrder = [...byWo.values()].sort((a, b) => {
      const wa = a[0].workOrder, wb = b[0].workOrder;
      const p = PRIORITY_WEIGHT[wb.priority] - PRIORITY_WEIGHT[wa.priority];
      if (p !== 0) return p;
      const da = wa.plannedEnd ? +wa.plannedEnd : Infinity;
      const db = wb.plannedEnd ? +wb.plannedEnd : Infinity;
      return da - db;
    });

    const machineFree = new Map<string, number>(); // next free instant per machine
    const jobStart = new Map<string, number>();      // computed start per operation
    const jobEnd = new Map<string, number>();        // computed end per operation
    const updates: { id: string; start: number; end: number }[] = [];

    for (const woJobs of woOrder) {
      // Within a WO, follow the routing sequence so precedence is naturally respected.
      const ops = woJobs.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      for (const jo of ops) {
        const mId = jo.machineId!;
        const dur = this.durationMs(jo);
        const lag = (jo.predecessorLagMins ?? 0) * 60_000;

        // Earliest start from the typed dependency (FS default).
        let depEarliest = horizon;
        if (jo.predecessorId) {
          const pStart = jobStart.get(jo.predecessorId) ?? horizon;
          const pEnd = jobEnd.get(jo.predecessorId) ?? horizon;
          switch (jo.predecessorType) {
            case DependencyType.START_TO_START:   depEarliest = pStart + lag; break;
            case DependencyType.FINISH_TO_FINISH: depEarliest = pEnd + lag - dur; break;
            case DependencyType.START_TO_FINISH:  depEarliest = pStart + lag - dur; break;
            case DependencyType.FINISH_TO_START:
            default:                              depEarliest = pEnd + lag; break;
          }
        }

        const mFree = machineFree.get(mId) ?? horizon;
        const start = Math.max(depEarliest, mFree, horizon);
        const end = start + dur;
        machineFree.set(mId, end);
        jobStart.set(jo.id, start);
        jobEnd.set(jo.id, end);
        updates.push({ id: jo.id, start, end });
      }
    }

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.jobOrder.update({
          where: { id: u.id },
          data: { plannedStart: new Date(u.start), plannedEnd: new Date(u.end) },
        }),
      ),
    );

    return { scheduled: updates.length, ...this.metricsFrom(jobs, jobEnd, horizon) };
  }

  /** Aggregate schedule KPIs from computed ends. */
  private metricsFrom(jobs: JOWithRefs[], jobEnd: Map<string, number>, horizon: number) {
    const ends = [...jobEnd.values()];
    const makespanH = ends.length ? (Math.max(...ends) - horizon) / HOUR : 0;

    // On-time: a WO is late if its last op finishes after the WO due date.
    const woLast = new Map<string, { end: number; due: number | null; order: string }>();
    for (const j of jobs) {
      const e = jobEnd.get(j.id);
      if (e === undefined) continue;
      const cur = woLast.get(j.workOrderId);
      const due = j.workOrder.plannedEnd ? +j.workOrder.plannedEnd : null;
      if (!cur || e > cur.end) woLast.set(j.workOrderId, { end: e, due, order: j.workOrder.orderNumber });
    }
    let onTime = 0, late = 0;
    const lateOrders: { orderNumber: string; finish: string; due: string | null; lateHours: number }[] = [];
    for (const w of woLast.values()) {
      if (w.due !== null && w.end > w.due) {
        late++;
        lateOrders.push({ orderNumber: w.order, finish: new Date(w.end).toISOString(), due: new Date(w.due).toISOString(), lateHours: Math.round((w.end - w.due) / HOUR * 10) / 10 });
      } else onTime++;
    }
    const totalWo = onTime + late;

    // Utilization: busy time / (machines × makespan)
    const machines = new Set(jobs.map((j) => j.machineId));
    let busy = 0;
    for (const j of jobs) busy += this.durationMs(j);
    const cap = machines.size * makespanH * HOUR;
    const utilization = cap > 0 ? Math.round((busy / cap) * 1000) / 10 : 0;

    return {
      makespanHours: Math.round(makespanH * 10) / 10,
      onTimeOrders: onTime,
      lateOrderCount: late,
      onTimePct: totalWo ? Math.round((onTime / totalWo) * 1000) / 10 : 100,
      machinesUsed: machines.size,
      utilizationPct: utilization,
      lateOrders: lateOrders.sort((a, b) => b.lateHours - a.lateHours).slice(0, 20),
    };
  }

  // ────────────────────────────────────────────────────────────
  // CURRENT PLAN (resource Gantt rows + metrics)
  // ────────────────────────────────────────────────────────────

  async getPlan(factoryId: string | null) {
    const fid = this.requireFactory(factoryId);
    const jobs = await this.loadOpenJobs(fid);

    const scheduled = jobs.filter((j) => j.plannedStart && j.plannedEnd);
    const unscheduled = jobs.length - scheduled.length;
    const horizon = scheduled.length ? Math.min(...scheduled.map((j) => +j.plannedStart!)) : Date.now();

    const jobEnd = new Map<string, number>();
    for (const j of scheduled) jobEnd.set(j.id, +j.plannedEnd!);

    const statusColor: Record<JobOrderStatus, string> = {
      SCHEDULED: '#6366f1', READY: '#0ea5e9', EXECUTING: '#22c55e',
      PAUSED: '#f59e0b', COMPLETE: '#94a3b8', CANCELLED: '#94a3b8',
    };

    // Stable colour per work order (operations of one order share a hue).
    const palette = ['#6366f1', '#f59e0b', '#22c55e', '#ec4899', '#0ea5e9', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#8b5cf6'];
    const woColor = new Map<string, string>();
    let ci = 0;
    for (const j of scheduled) if (!woColor.has(j.workOrderId)) woColor.set(j.workOrderId, palette[ci++ % palette.length]);

    // Resource (machine) rows for the Gantt
    const machineMap = new Map<string, { id: string; name: string; code: string }>();
    const items = scheduled.map((j) => {
      if (j.machine) machineMap.set(j.machine.id, { id: j.machine.id, name: j.machine.name, code: j.machine.code });
      return {
        id: j.id,
        type: 'job_order',
        title: `${j.workOrder.orderNumber} · ${j.operationName}`,
        subtitle: j.operationName,
        operation: j.operationName,
        sequenceOrder: j.sequenceOrder,
        orderNumber: j.workOrder.orderNumber,
        workOrderId: j.workOrderId,
        productionOrderId: j.workOrder.productionOrder?.id ?? null,
        productionOrderNumber: j.workOrder.productionOrder?.orderNumber ?? null,
        predecessorId: j.predecessorId,
        predecessorType: j.predecessorType,
        predecessorLagMins: j.predecessorLagMins,
        status: j.status,
        resourceId: j.machineId!,
        resourceName: j.machine ? `${j.machine.name}` : 'Unassigned',
        start: j.plannedStart!.toISOString(),
        end: j.plannedEnd!.toISOString(),
        qty: j.plannedQtyOut ?? j.plannedQtyIn ?? null,
        progress: j.status === JobOrderStatus.COMPLETE ? 100 : j.status === JobOrderStatus.EXECUTING ? 50 : 0,
        color: woColor.get(j.workOrderId) ?? statusColor[j.status],
        statusColor: statusColor[j.status],
        priority: j.workOrder.priority,
      };
    });

    // Demand lane: one marker per work order at its due date + scheduled finish.
    const demandMap = new Map<string, { orderNumber: string; color: string; due: number | null; finish: number; priority: Priority }>();
    for (const j of scheduled) {
      const finish = jobEnd.get(j.id) ?? +j.plannedEnd!;
      const cur = demandMap.get(j.workOrderId);
      const due = j.workOrder.plannedEnd ? +j.workOrder.plannedEnd : null;
      if (!cur || finish > cur.finish) {
        demandMap.set(j.workOrderId, { orderNumber: j.workOrder.orderNumber, color: woColor.get(j.workOrderId)!, due, finish, priority: j.workOrder.priority });
      }
    }
    const demand = [...demandMap.values()].map((d) => ({
      orderNumber: d.orderNumber,
      color: d.color,
      dueDate: d.due ? new Date(d.due).toISOString() : null,
      scheduledFinish: new Date(d.finish).toISOString(),
      late: d.due !== null && d.finish > d.due,
      priority: d.priority,
    })).sort((a, b) => +new Date(a.scheduledFinish) - +new Date(b.scheduledFinish));

    return {
      items,
      machines: [...machineMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      demand,
      unscheduled,
      range: items.length
        ? { from: new Date(horizon).toISOString(), to: new Date(Math.max(...scheduled.map((j) => +j.plannedEnd!))).toISOString() }
        : { from: new Date(horizon).toISOString(), to: new Date(horizon + 7 * 24 * HOUR).toISOString() },
      metrics: this.metricsFrom(scheduled, jobEnd, horizon),
    };
  }

  // ────────────────────────────────────────────────────────────
  // INTERACTIVE RESCHEDULE (drag & drop) — ripples successors
  // ────────────────────────────────────────────────────────────

  async rescheduleJob(factoryId: string | null, dto: RescheduleJobDto) {
    const fid = this.requireFactory(factoryId);
    const jo = await this.prisma.jobOrder.findFirst({
      where: { id: dto.jobId, factoryId: fid },
      select: { id: true, plannedStart: true, plannedEnd: true, machineId: true },
    });
    if (!jo) throw new NotFoundException('Job order not found');

    const start = new Date(dto.start);
    const prevDur = jo.plannedStart && jo.plannedEnd ? +jo.plannedEnd - +jo.plannedStart : HOUR;
    const end = dto.end ? new Date(dto.end) : new Date(+start + prevDur);

    await this.prisma.jobOrder.update({
      where: { id: jo.id },
      data: { plannedStart: start, plannedEnd: end, ...(dto.machineId ? { machineId: dto.machineId } : {}) },
    });

    // Ripple: push any successors that now start before this op ends.
    let rippled = 0;
    let frontier = [{ id: jo.id, end: +end }];
    const seen = new Set<string>([jo.id]);
    while (frontier.length) {
      const next: { id: string; end: number }[] = [];
      for (const f of frontier) {
        const succs = await this.prisma.jobOrder.findMany({
          where: { predecessorId: f.id, factoryId: fid, status: { in: OPEN_JO } },
          select: { id: true, plannedStart: true, plannedEnd: true },
        });
        for (const s of succs) {
          if (seen.has(s.id) || !s.plannedStart || !s.plannedEnd) continue;
          if (+s.plannedStart >= f.end) continue; // no conflict
          const dur = +s.plannedEnd - +s.plannedStart;
          const ns = f.end, ne = f.end + dur;
          await this.prisma.jobOrder.update({ where: { id: s.id }, data: { plannedStart: new Date(ns), plannedEnd: new Date(ne) } });
          seen.add(s.id); rippled++;
          next.push({ id: s.id, end: ne });
        }
      }
      frontier = next;
    }

    return { id: jo.id, start: start.toISOString(), end: end.toISOString(), rippledSuccessors: rippled };
  }

  // ────────────────────────────────────────────────────────────
  // CAPABLE-TO-PROMISE (CTP)
  // ────────────────────────────────────────────────────────────

  async ctp(factoryId: string | null, dto: CtpDto) {
    const fid = this.requireFactory(factoryId);
    const sku = await this.prisma.sKU.findFirst({ where: { id: dto.skuId, factoryId: fid }, select: { id: true, code: true, name: true } });
    if (!sku) throw new NotFoundException('SKU not found');

    // Candidate machines: those that have produced this SKU before, else any with capacity.
    const priorJobs = await this.prisma.jobOrder.findMany({
      where: { factoryId: fid, workOrder: { skuId: dto.skuId }, machineId: { not: null } },
      select: { machineId: true }, take: 50,
    });
    const machineIds = [...new Set(priorJobs.map((j) => j.machineId!).filter(Boolean))];
    const machines = await this.prisma.machine.findMany({
      where: { factoryId: fid, isActive: true, designCapacity: { gt: 0 }, ...(machineIds.length ? { id: { in: machineIds } } : {}) },
      select: { id: true, name: true, code: true, designCapacity: true },
    });
    if (machines.length === 0) {
      return { sku, feasible: false, reason: 'No capable machine with a defined capacity for this SKU' };
    }

    // Current load per machine from the scheduled plan.
    const load = await this.prisma.jobOrder.groupBy({
      by: ['machineId'],
      where: { factoryId: fid, status: { in: OPEN_JO }, machineId: { in: machines.map((m) => m.id) } },
      _max: { plannedEnd: true },
    });
    const freeAt = new Map<string, number>();
    for (const l of load) if (l.machineId) freeAt.set(l.machineId, l._max.plannedEnd ? +l._max.plannedEnd : Date.now());

    // Pick the machine that can finish soonest.
    let best: { machine: typeof machines[number]; start: number; end: number } | null = null;
    for (const m of machines) {
      const start = Math.max(Date.now(), freeAt.get(m.id) ?? Date.now());
      const durH = dto.quantity / (m.designCapacity || 1);
      const end = start + durH * HOUR;
      if (!best || end < best.end) best = { machine: m, start, end };
    }

    const promise = best!;
    const due = dto.dueDate ? +new Date(dto.dueDate) : null;
    const feasible = due === null ? true : promise.end <= due;
    return {
      sku,
      quantity: dto.quantity,
      machine: { id: promise.machine.id, name: promise.machine.name, code: promise.machine.code, capacityPerHour: promise.machine.designCapacity },
      earliestStart: new Date(promise.start).toISOString(),
      promiseDate: new Date(promise.end).toISOString(),
      runtimeHours: Math.round((promise.end - promise.start) / HOUR * 10) / 10,
      requestedDate: dto.dueDate ?? null,
      feasible,
      slackHours: due !== null ? Math.round((due - promise.end) / HOUR * 10) / 10 : null,
    };
  }

  // ────────────────────────────────────────────────────────────
  // MATERIAL REQUIREMENTS PLANNING (MRP)
  // ────────────────────────────────────────────────────────────

  async mrp(factoryId: string | null) {
    const fid = this.requireFactory(factoryId);
    const wos = await this.prisma.workOrder.findMany({
      where: { factoryId: fid, status: { in: OPEN_WO }, skuId: { not: null }, deletedAt: null },
      select: { id: true, orderNumber: true, skuId: true, plannedQty: true, plannedStart: true },
    });
    if (wos.length === 0) return { requirements: [], shortages: 0, ordersConsidered: 0 };

    // Active BOM per SKU.
    const skuIds = [...new Set(wos.map((w) => w.skuId!))];
    const boms = await this.prisma.bOMHeader.findMany({
      where: { factoryId: fid, skuId: { in: skuIds }, isActive: true },
      select: { skuId: true, items: { select: { rawMaterialId: true, quantityPer: true, scrapFactor: true, unit: true } } },
    });
    const bomBySku = new Map<string, typeof boms[number]['items']>();
    for (const b of boms) if (!bomBySku.has(b.skuId)) bomBySku.set(b.skuId, b.items);

    // Aggregate gross requirement per material + earliest need date.
    const need = new Map<string, { required: number; date: number }>();
    for (const wo of wos) {
      const items = bomBySku.get(wo.skuId!);
      if (!items) continue;
      const when = wo.plannedStart ? +wo.plannedStart : Date.now();
      for (const it of items) {
        const gross = wo.plannedQty * it.quantityPer * (1 + (it.scrapFactor ?? 0));
        const cur = need.get(it.rawMaterialId);
        if (cur) { cur.required += gross; cur.date = Math.min(cur.date, when); }
        else need.set(it.rawMaterialId, { required: gross, date: when });
      }
    }

    const mats = await this.prisma.rawMaterial.findMany({
      where: { id: { in: [...need.keys()] } },
      select: { id: true, code: true, name: true, unit: true, currentStock: true, reservedStock: true, leadTimeDays: true },
    });

    const requirements = mats.map((m) => {
      const n = need.get(m.id)!;
      const available = (m.currentStock ?? 0) - (m.reservedStock ?? 0);
      const shortage = Math.max(0, n.required - available);
      const requiredDate = new Date(n.date);
      const orderBy = m.leadTimeDays ? new Date(n.date - m.leadTimeDays * 24 * HOUR) : null;
      return {
        materialId: m.id, code: m.code, name: m.name, unit: m.unit,
        required: Math.round(n.required * 100) / 100,
        available: Math.round(available * 100) / 100,
        shortage: Math.round(shortage * 100) / 100,
        requiredDate: requiredDate.toISOString(),
        suggestedOrderDate: orderBy ? orderBy.toISOString() : null,
        leadTimeDays: m.leadTimeDays ?? null,
      };
    }).sort((a, b) => b.shortage - a.shortage);

    return {
      requirements,
      shortages: requirements.filter((r) => r.shortage > 0).length,
      ordersConsidered: wos.length,
    };
  }
}
