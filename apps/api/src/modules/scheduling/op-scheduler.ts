import { DependencyType } from '@prisma/client';

/**
 * Pure finite-capacity, dependency-aware forward scheduler.
 *
 * Extracted from the APS engine so both APS "Recalculate Plan" and the
 * production Auto-Generate preview compute identical, overlap-aware schedules
 * (the "largest common intersection between steps" the routing relationships
 * allow) without persisting anything.
 *
 * Honours typed precedence with lag:
 *   FINISH_TO_START (default) · START_TO_START · FINISH_TO_FINISH · START_TO_FINISH
 * START_TO_START operations form one synchronised line — they start together and
 * all end at the bottleneck end (the slowest member dictates the line speed), so
 * parallel steps overlap instead of running back-to-back.
 *
 * Machines are finite: `machineFree` seeds the next-free instant per machine
 * (e.g. an existing plan on that machine), and each placed op pushes it forward.
 */

export interface SchedOp {
  id: string;
  machineId: string | null;
  durationMs: number;
  predecessorId: string | null;
  predecessorType: DependencyType;
  predecessorLagMins: number;
  sequenceOrder: number;
}

export interface SchedResult {
  start: Map<string, number>;
  end: Map<string, number>;
  /** Latest op end across the set (the makespan finish instant). */
  finish: number;
}

/**
 * Schedule one set of operations (e.g. all job orders of a single work order)
 * forward from `horizon`. `machineFree` is consulted AND mutated so callers can
 * chain multiple work orders onto the same finite machine pool.
 */
export function scheduleOps(
  ops: SchedOp[],
  horizon: number,
  machineFree: Map<string, number> = new Map(),
): SchedResult {
  const jobStart = new Map<string, number>();
  const jobEnd = new Map<string, number>();
  if (ops.length === 0) return { start: jobStart, end: jobEnd, finish: horizon };

  const sorted = [...ops].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const opById = new Map(sorted.map((o) => [o.id, o]));

  // ── Union-find: group ops chained by START_TO_START into one component ──
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== c) { const n = parent.get(c)!; parent.set(c, r); c = n; }
    return r;
  };
  for (const o of sorted) parent.set(o.id, o.id);
  for (const o of sorted) {
    if (o.predecessorId && o.predecessorType === DependencyType.START_TO_START && opById.has(o.predecessorId)) {
      parent.set(find(o.id), find(o.predecessorId));
    }
  }
  const comps = new Map<string, SchedOp[]>();
  for (const o of sorted) {
    const r = find(o.id);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r)!.push(o);
  }
  const compList = [...comps.values()].sort(
    (a, b) => Math.min(...a.map((o) => o.sequenceOrder)) - Math.min(...b.map((o) => o.sequenceOrder)),
  );

  for (const comp of compList) {
    // SS-lag offset of each member relative to the component anchor
    const offset = new Map<string, number>();
    for (const m of comp) {
      if (!(m.predecessorId && m.predecessorType === DependencyType.START_TO_START && opById.has(m.predecessorId))) {
        offset.set(m.id, 0); // anchor
      }
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of comp) {
        if (offset.has(m.id)) continue;
        const po = offset.get(m.predecessorId!);
        if (po !== undefined) {
          offset.set(m.id, po + (m.predecessorLagMins ?? 0) * 60_000);
          changed = true;
        }
      }
    }
    for (const m of comp) if (!offset.has(m.id)) offset.set(m.id, 0);

    // Group start: every member's external constraints must hold at
    // (groupStart + its offset), including cross-WO machine windows.
    let groupStart = horizon;
    for (const m of comp) {
      const off = offset.get(m.id)!;
      const dur = m.durationMs;
      let extEarliest = horizon;
      if (m.predecessorId && m.predecessorType !== DependencyType.START_TO_START) {
        const lag = (m.predecessorLagMins ?? 0) * 60_000;
        const pStart = jobStart.get(m.predecessorId) ?? horizon;
        const pEnd = jobEnd.get(m.predecessorId) ?? horizon;
        switch (m.predecessorType) {
          case DependencyType.FINISH_TO_FINISH: extEarliest = pEnd + lag - dur; break;
          case DependencyType.START_TO_FINISH:  extEarliest = pStart + lag - dur; break;
          case DependencyType.FINISH_TO_START:
          default:                              extEarliest = pEnd + lag; break;
        }
      }
      const mFree = m.machineId ? (machineFree.get(m.machineId) ?? horizon) : horizon;
      groupStart = Math.max(groupStart, extEarliest - off, mFree - off);
    }

    // Bottleneck end: the longest member stretches the whole synchronised line.
    let groupEnd = groupStart;
    for (const m of comp) {
      groupEnd = Math.max(groupEnd, groupStart + offset.get(m.id)! + m.durationMs);
    }

    for (const m of comp) {
      const s = groupStart + offset.get(m.id)!;
      const e = comp.length > 1 ? groupEnd : s + m.durationMs;
      jobStart.set(m.id, s);
      jobEnd.set(m.id, e);
      if (m.machineId) machineFree.set(m.machineId, e);
    }
  }

  const finish = Math.max(...[...jobEnd.values()], horizon);
  return { start: jobStart, end: jobEnd, finish };
}
