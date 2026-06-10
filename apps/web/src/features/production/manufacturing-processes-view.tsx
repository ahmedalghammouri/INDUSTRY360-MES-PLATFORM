'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, ChevronDown, ChevronRight, CheckCircle2,
  Workflow, Clock, X, FileCheck2, Pencil, Trash2,
  ArrowRight, Timer, Info, Link2, MoreVertical, RotateCcw, GripVertical,
} from 'lucide-react';
import { api } from '@/services/api.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { TablePagination } from '@/components/ui/table-pagination';
import { useSortedData } from '@/lib/use-sorted-data';
import { WorkCenterPicker } from '@/components/ui/workcenter-picker';
import { useProductMasterData } from '@/components/ui/master-data-select';

// ── Types ─────────────────────────────────────────────────────

type DependencyType = 'FINISH_TO_START' | 'START_TO_START' | 'START_TO_FINISH' | 'FINISH_TO_FINISH';

interface StepDependency {
  fromStepIndex: number;
  toStepIndex: number;
  type: DependencyType;
  lagMins: number;
}

interface StepMaterialForm {
  rawMaterialId: string;
  name: string;
  qty: string;     // per ONE output unit of the step
  unit: string;
}

interface StepForm {
  stepNumber: number;
  operationName: string;
  workCenterId: string;
  workCenterName: string;
  cycleTimeSec: string;   // seconds per ONE output unit — THE reference for JO cycle/duration
  setupTimeMins: string;
  inUnit: string;         // consumed unit (PCS/INNER/CARTON/PALLET)
  outUnit: string;        // produced unit — scheduling converts order qty to this
  materials: StepMaterialForm[];
  description: string;
  isOptional: boolean;
}

const FLOW_UNITS = ['PCS', 'INNER', 'CARTON', 'PALLET'] as const;

type ProcessScope = 'PRODUCT' | 'CATEGORY' | 'BASE_WEIGHT' | 'PRODUCT_LIST';

interface ProcHeader {
  scopeType: ProcessScope;
  skuId: string;
  categoryId: string;
  baseWeightId: string;
  skuIds: string[];
  version: string;
  name: string;
  description: string;
}

const EMPTY_HEADER: ProcHeader = {
  scopeType: 'PRODUCT', skuId: '', categoryId: '', baseWeightId: '', skuIds: [],
  version: '1.0', name: '', description: '',
};

interface PredecessorLink {
  fromStep: { id: string; stepNumber: number; operationName: string };
  type: DependencyType;
  lagMins: number;
}

interface RoutingStep {
  id: string;
  stepNumber: number;
  operationName: string;
  workCenter?: string;
  workCenterId?: string;
  workCenterRef?: { id: string; code: string; name: string; level: string };
  cycleTimeSec?: number;
  cycleTimeMins?: number;
  setupTimeMins?: number;
  inUnit?: string | null;
  outUnit?: string | null;
  materials?: Array<{ id: string; rawMaterialId: string | null; materialCode: string | null; name: string; qtyPerOutputUnit: number; unit: string }>;
  description?: string;
  isOptional: boolean;
  machine?: { code: string; name: string };
  predecessors?: PredecessorLink[];
}

interface ManufacturingProcess {
  id: string;
  skuId: string | null;
  scopeType?: ProcessScope;
  version: string;
  name: string;
  description?: string;
  totalCycleTimeMins?: number;
  isActive: boolean;
  approvedAt?: string;
  sku: { id: string; code: string; name: string; itemNumber: string } | null;
  categoryRef?: { id: string; name: string } | null;
  baseWeightRef?: { id: string; value: number; unit: string; label: string | null } | null;
  skuLinks?: Array<{ sku: { id: string; code: string; name: string } }>;
  routingSteps: RoutingStep[];
}

/** Human label for what a process applies to. */
function processScopeLabel(p: ManufacturingProcess): string {
  switch (p.scopeType) {
    case 'CATEGORY': return `Category: ${p.categoryRef?.name ?? '—'}`;
    case 'BASE_WEIGHT': return `Weight: ${p.baseWeightRef?.label ?? `${p.baseWeightRef?.value ?? '—'} ${p.baseWeightRef?.unit ?? ''}`}`;
    case 'PRODUCT_LIST': return `${p.skuLinks?.length ?? 0} products`;
    default: return p.sku?.name ?? '—';
  }
}

// ── Constants ─────────────────────────────────────────────────

const COMMON_OPERATIONS = [
  'Mixing', 'Blending', 'Filling', 'Capping', 'Sealing',
  'Labelling', 'Coding', 'Wrapping', 'Cartoning', 'Palletizing',
  'Inspection', 'Weighing', 'Sampling', 'Sterilization', 'Packaging',
  'Granulation', 'Compression', 'Coating', 'Assembly', 'Testing',
];

const DEP_TYPES: { value: DependencyType; label: string; short: string; color: string; stroke: string; desc: string }[] = [
  { value: 'FINISH_TO_START',  label: 'Finish → Start',  short: 'FS', color: 'text-blue-400',   stroke: '#60a5fa', desc: 'B starts after A finishes' },
  { value: 'START_TO_START',   label: 'Start → Start',   short: 'SS', color: 'text-violet-400', stroke: '#a78bfa', desc: 'B starts when A starts (parallel)' },
  { value: 'START_TO_FINISH',  label: 'Start → Finish',  short: 'SF', color: 'text-orange-400', stroke: '#fb923c', desc: 'B must finish before A starts' },
  { value: 'FINISH_TO_FINISH', label: 'Finish → Finish', short: 'FF', color: 'text-emerald-400', stroke: '#34d399', desc: 'B finishes when A finishes' },
];

const EMPTY_STEP = (): StepForm => ({
  stepNumber: 1,
  operationName: '',
  workCenterId: '',
  workCenterName: '',
  cycleTimeSec: '',
  setupTimeMins: '',
  inUnit: '',
  outUnit: '',
  materials: [],
  description: '',
  isOptional: false,
});

// ── PDM Layout ────────────────────────────────────────────────

const BOX_W = 168;
const BOX_H = 90;
const COL_GAP = 72;
const ROW_GAP = 20;
const PAD = 16;

function computeLayout(steps: RoutingStep[]) {
  const cols = new Map<string, number>();
  steps.forEach(s => cols.set(s.id, 0));

  // Multiple passes to propagate columns transitively
  for (let iter = 0; iter < steps.length + 1; iter++) {
    for (const step of steps) {
      if (!step.predecessors?.length) continue;
      for (const pred of step.predecessors) {
        const predCol = cols.get(pred.fromStep.id) ?? 0;
        const addCol = pred.type === 'FINISH_TO_START' ? 1 : 0;
        const minCol = predCol + addCol;
        if ((cols.get(step.id) ?? 0) < minCol) cols.set(step.id, minCol);
      }
    }
  }

  // Group by column, sort by stepNumber within column
  const colGroups = new Map<number, RoutingStep[]>();
  for (const step of steps) {
    const col = cols.get(step.id) ?? 0;
    if (!colGroups.has(col)) colGroups.set(col, []);
    colGroups.get(col)!.push(step);
  }
  for (const arr of colGroups.values()) arr.sort((a, b) => a.stepNumber - b.stepNumber);

  // Assign pixel positions
  const positions = new Map<string, { x: number; y: number }>();
  const maxCol = Math.max(...cols.values(), 0);

  for (let col = 0; col <= maxCol; col++) {
    const arr = colGroups.get(col) ?? [];
    arr.forEach((step, row) => {
      positions.set(step.id, {
        x: PAD + col * (BOX_W + COL_GAP),
        y: PAD + row * (BOX_H + ROW_GAP),
      });
    });
  }

  const maxRow = Math.max(...Array.from(positions.values()).map(p =>
    Math.floor(p.y / (BOX_H + ROW_GAP))), 0);
  const svgW = PAD * 2 + (maxCol + 1) * BOX_W + maxCol * COL_GAP;
  const svgH = PAD * 2 + (maxRow + 1) * BOX_H + maxRow * ROW_GAP;

  return { positions, svgW: Math.max(svgW, 300), svgH: Math.max(svgH, BOX_H + PAD * 2) };
}

// Arrow entry/exit points based on dependency type
function arrowPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  type: DependencyType,
): { fx: number; fy: number; tx: number; ty: number } {
  switch (type) {
    case 'FINISH_TO_START':
      return { fx: from.x + BOX_W, fy: from.y + BOX_H / 2, tx: to.x, ty: to.y + BOX_H / 2 };
    case 'START_TO_START':
      return { fx: from.x + BOX_W / 2, fy: from.y, tx: to.x + BOX_W / 2, ty: to.y };
    case 'FINISH_TO_FINISH':
      return { fx: from.x + BOX_W / 2, fy: from.y + BOX_H, tx: to.x + BOX_W / 2, ty: to.y + BOX_H };
    case 'START_TO_FINISH':
      return { fx: from.x + BOX_W / 2, fy: from.y, tx: to.x + BOX_W / 2, ty: to.y + BOX_H };
  }
}

function buildArrowPath(fx: number, fy: number, tx: number, ty: number): string {
  const dx = tx - fx;
  const dy = ty - fy;
  if (Math.abs(dx) > Math.abs(dy) * 0.5) {
    // Horizontal-ish: S-curve
    const cx = fx + dx / 2;
    return `M ${fx} ${fy} C ${cx} ${fy}, ${cx} ${ty}, ${tx} ${ty}`;
  }
  // Vertical-ish: arc around the left side
  const offset = 28;
  return `M ${fx} ${fy} C ${fx - offset} ${fy}, ${tx - offset} ${ty}, ${tx} ${ty}`;
}

// ── PDM Diagram ───────────────────────────────────────────────

function PdmDiagram({ steps }: { steps: RoutingStep[] }) {
  if (!steps.length) return null;
  const { positions, svgW, svgH } = computeLayout(steps);

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={svgH} className="block">
        <defs>
          {DEP_TYPES.map(dt => (
            <marker
              key={dt.value}
              id={`arrow-${dt.value}`}
              markerWidth="8" markerHeight="8"
              refX="6" refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill={dt.stroke} />
            </marker>
          ))}
        </defs>

        {/* Draw dependency arrows */}
        {steps.map(step => (step.predecessors ?? []).map((pred, pi) => {
          const fromPos = positions.get(pred.fromStep.id);
          const toPos = positions.get(step.id);
          if (!fromPos || !toPos) return null;

          const { fx, fy, tx, ty } = arrowPoints(fromPos, toPos, pred.type);
          const dt = DEP_TYPES.find(d => d.value === pred.type)!;
          const d = buildArrowPath(fx, fy, tx, ty);
          const lx = (fx + tx) / 2;
          const ly = (fy + ty) / 2;

          return (
            <g key={`${step.id}-${pi}`}>
              <path
                d={d}
                fill="none"
                stroke={dt.stroke}
                strokeWidth="1.5"
                strokeDasharray={pred.type === 'START_TO_START' || pred.type === 'FINISH_TO_FINISH' ? '5 3' : undefined}
                markerEnd={`url(#arrow-${pred.type})`}
                opacity="0.85"
              />
              {/* Dependency type label */}
              <rect x={lx - 10} y={ly - 8} width="20" height="14" rx="3" fill="#0f1117" opacity="0.85" />
              <text x={lx} y={ly + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={dt.stroke} fontFamily="monospace">
                {dt.short}{pred.lagMins !== 0 ? (pred.lagMins > 0 ? `+${pred.lagMins}` : pred.lagMins) : ''}
              </text>
            </g>
          );
        }))}

        {/* Draw step boxes */}
        {steps.map(step => {
          const pos = positions.get(step.id);
          if (!pos) return null;
          const wcName = step.workCenterRef?.name ?? step.workCenter;

          return (
            <g key={step.id}>
              {/* Box shadow */}
              <rect
                x={pos.x + 2} y={pos.y + 2}
                width={BOX_W} height={BOX_H}
                rx="8" fill="rgba(0,0,0,0.35)"
              />
              {/* Box background */}
              <rect
                x={pos.x} y={pos.y}
                width={BOX_W} height={BOX_H}
                rx="8"
                fill="#1a1d2e"
                stroke="#2d3155"
                strokeWidth="1.5"
              />
              {/* Step number badge */}
              <circle cx={pos.x + 18} cy={pos.y + 18} r="12" fill="#3b4bdb" opacity="0.85" />
              <text x={pos.x + 18} y={pos.y + 22} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">
                {step.stepNumber}
              </text>
              {/* Operation name */}
              <text x={pos.x + 36} y={pos.y + 22} fontSize="11" fontWeight="700" fill="#e2e8f0" fontFamily="sans-serif">
                {step.operationName.length > 16 ? step.operationName.slice(0, 15) + '…' : step.operationName}
              </text>
              {/* Divider */}
              <line x1={pos.x + 10} y1={pos.y + 33} x2={pos.x + BOX_W - 10} y2={pos.y + 33} stroke="#2d3155" strokeWidth="1" />
              {/* Work center */}
              {wcName && (
                <text x={pos.x + 10} y={pos.y + 48} fontSize="9.5" fill="#94a3b8" fontFamily="sans-serif">
                  {wcName.length > 22 ? wcName.slice(0, 21) + '…' : wcName}
                </text>
              )}
              {/* Cycle / setup time */}
              <text x={pos.x + 10} y={pos.y + 64} fontSize="9" fill="#64748b" fontFamily="sans-serif">
                {(() => {
                  const sec = step.cycleTimeSec ?? (step.cycleTimeMins != null ? step.cycleTimeMins * 60 : null);
                  return sec != null ? `⏱ ${sec}s cycle` : '';
                })()}
                {(step.cycleTimeSec != null || step.cycleTimeMins != null) && step.setupTimeMins != null ? '  ' : ''}
                {step.setupTimeMins != null && step.setupTimeMins > 0 ? `⚙ ${step.setupTimeMins}m setup` : ''}
              </text>
              {/* Optional badge */}
              {step.isOptional && (
                <>
                  <rect x={pos.x + BOX_W - 48} y={pos.y + 72} width="40" height="12" rx="4" fill="#374151" />
                  <text x={pos.x + BOX_W - 28} y={pos.y + 81} textAnchor="middle" fontSize="8" fill="#9ca3af">Optional</text>
                </>
              )}
              {/* Description tooltip indicator */}
              {step.description && (
                <circle cx={pos.x + BOX_W - 10} cy={pos.y + 10} r="5" fill="#1e3a5f" />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2 px-1 flex-wrap">
        {DEP_TYPES.map(dt => (
          <div key={dt.value} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="font-mono font-bold text-xs" style={{ color: dt.stroke }}>{dt.short}</span>
            <span>{dt.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Process Form (shared by Create & Edit) ────────────────────

function ProcessForm({
  title,
  skus,
  newProcess,
  setNewProcess,
  steps,
  setSteps,
  deps,
  setDeps,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
  lockSku,
}: {
  title: string;
  skus: any[];
  newProcess: ProcHeader;
  setNewProcess: React.Dispatch<React.SetStateAction<ProcHeader>>;
  steps: StepForm[];
  setSteps: React.Dispatch<React.SetStateAction<StepForm[]>>;
  deps: StepDependency[];
  setDeps: React.Dispatch<React.SetStateAction<StepDependency[]>>;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
  lockSku?: boolean;
}) {
  const totalCycleSec = steps.reduce((s, st) => s + (parseFloat(st.cycleTimeSec || '0') || 0), 0);
  const { data: masterData } = useProductMasterData();
  const { data: rawMatData } = useQuery({
    queryKey: ['raw-materials-list'],
    queryFn: () => api.get('/inventory/raw-materials?limit=200'),
    staleTime: 120_000,
  });
  const rawMaterials: Array<{ id: string; code: string; name: string; unit: string }> =
    ((rawMatData as any)?.data ?? []);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const handleDragStart = (i: number) => setDragIdx(i);
  const handleDragEnd = () => { setDragIdx(null); setHoverIdx(null); };

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { handleDragEnd(); return; }

    // Build new order: remove dragIdx, insert at targetIdx
    const order = Array.from({ length: steps.length }, (_, i) => i);
    const [moved] = order.splice(dragIdx, 1);
    order.splice(targetIdx, 0, moved);

    // newMapping[oldIdx] = newIdx
    const newMapping: number[] = new Array(steps.length);
    order.forEach((oldIdx, newIdx) => { newMapping[oldIdx] = newIdx; });

    setSteps(prev => {
      const reordered = order.map(oldIdx => prev[oldIdx]);
      return reordered.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    });

    setDeps(prev => prev.map(d => ({
      ...d,
      fromStepIndex: newMapping[d.fromStepIndex],
      toStepIndex: newMapping[d.toStepIndex],
    })));

    handleDragEnd();
  };

  const addStep = () => setSteps(prev => [...prev, { ...EMPTY_STEP(), stepNumber: prev.length + 1 }]);

  const removeStep = (i: number) => {
    setSteps(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, stepNumber: idx + 1 })));
    setDeps(prev => prev
      .filter(d => d.fromStepIndex !== i && d.toStepIndex !== i)
      .map(d => ({
        ...d,
        fromStepIndex: d.fromStepIndex > i ? d.fromStepIndex - 1 : d.fromStepIndex,
        toStepIndex: d.toStepIndex > i ? d.toStepIndex - 1 : d.toStepIndex,
      })));
  };

  const updateStep = (i: number, patch: Partial<StepForm>) =>
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const addDep = () => {
    if (steps.length < 2) return;
    setDeps(prev => [...prev, { fromStepIndex: 0, toStepIndex: 1, type: 'FINISH_TO_START', lagMins: 0 }]);
  };

  const removeDep = (i: number) => setDeps(prev => prev.filter((_, idx) => idx !== i));

  const updateDep = (i: number, patch: Partial<StepDependency>) =>
    setDeps(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));

  const scopeValid =
    newProcess.scopeType === 'PRODUCT' ? !!newProcess.skuId :
    newProcess.scopeType === 'CATEGORY' ? !!newProcess.categoryId :
    newProcess.scopeType === 'BASE_WEIGHT' ? !!newProcess.baseWeightId :
    newProcess.skuIds.length > 0;
  const canSubmit = scopeValid && newProcess.name && steps.every(s => s.operationName);

  const toggleListSku = (id: string) =>
    setNewProcess(p => ({
      ...p,
      skuIds: p.skuIds.includes(id) ? p.skuIds.filter(x => x !== id) : [...p.skuIds, id],
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-background z-10">
          <h2 className="font-semibold text-base">{title}</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
            <X size={14} />
          </Button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Scope — which products this routing applies to */}
          <div className="flex flex-col gap-2">
            <Label>Applies To *</Label>
            <div className="flex flex-wrap gap-1.5">
              {([
                { v: 'PRODUCT', label: 'Single product' },
                { v: 'CATEGORY', label: 'Category' },
                { v: 'BASE_WEIGHT', label: 'Base weight' },
                { v: 'PRODUCT_LIST', label: 'Product list' },
              ] as Array<{ v: ProcessScope; label: string }>).map(o => (
                <button
                  key={o.v}
                  type="button"
                  disabled={lockSku}
                  onClick={() => setNewProcess(p => ({ ...p, scopeType: o.v }))}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    newProcess.scopeType === o.v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  } ${lockSku ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              {newProcess.scopeType === 'PRODUCT' && (
                <>
                  <Label>Product (SKU) *</Label>
                  {lockSku ? (
                    <div className="h-8 text-sm flex items-center px-3 rounded-md border bg-muted text-muted-foreground">
                      {skus.find(s => s.id === newProcess.skuId)?.name ?? newProcess.skuId}
                    </div>
                  ) : (
                    <Select value={newProcess.skuId} onValueChange={v => setNewProcess(p => ({ ...p, skuId: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select product..." /></SelectTrigger>
                      <SelectContent>
                        {skus.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.itemNumber} — {s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}
              {newProcess.scopeType === 'CATEGORY' && (
                <>
                  <Label>Category * <span className="text-[10px] text-muted-foreground font-normal">(all products in it)</span></Label>
                  <Select value={newProcess.categoryId} onValueChange={v => setNewProcess(p => ({ ...p, categoryId: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select category..." /></SelectTrigger>
                    <SelectContent>
                      {(masterData?.categories ?? []).filter(c => c.isActive).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              {newProcess.scopeType === 'BASE_WEIGHT' && (
                <>
                  <Label>Base Weight * <span className="text-[10px] text-muted-foreground font-normal">(all products with it)</span></Label>
                  <Select value={newProcess.baseWeightId} onValueChange={v => setNewProcess(p => ({ ...p, baseWeightId: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select base weight..." /></SelectTrigger>
                    <SelectContent>
                      {(masterData?.baseWeights ?? []).filter(w => w.isActive).map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.label ?? `${w.value} ${w.unit}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              {newProcess.scopeType === 'PRODUCT_LIST' && (
                <>
                  <Label>Products * <span className="text-[10px] text-muted-foreground font-normal">({newProcess.skuIds.length} selected)</span></Label>
                  <div className="max-h-36 overflow-y-auto rounded-md border border-input bg-background p-1.5 space-y-0.5">
                    {skus.map((s: any) => (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={newProcess.skuIds.includes(s.id)}
                          onChange={() => toggleListSku(s.id)}
                          className="accent-[hsl(var(--primary))]"
                        />
                        <span className="truncate">{s.itemNumber} — {s.name}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Version</Label>
              <Input value={newProcess.version} onChange={e => setNewProcess(p => ({ ...p, version: e.target.value }))} placeholder="1.0" className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Process Name *</Label>
            <Input value={newProcess.name} onChange={e => setNewProcess(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Standard Production Routing — Line 1" className="h-8 text-sm" />
          </div>

          {/* Routing steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Routing Steps *</Label>
              <Button size="sm" variant="outline" onClick={addStep} className="h-7 text-xs">
                <Plus size={12} className="mr-1" />Add Step
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              {steps.map((step, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={e => { e.preventDefault(); setHoverIdx(i); }}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'border rounded-lg p-3 bg-muted/20 transition-all duration-150 select-none',
                    dragIdx === i && 'opacity-40 scale-[0.98] border-dashed',
                    hoverIdx === i && dragIdx !== null && dragIdx !== i && 'border-primary border-2 bg-primary/5 shadow-[0_0_0_2px_hsl(var(--primary)/0.15)]',
                  )}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {/* Drag handle */}
                    <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 touch-none">
                      <GripVertical size={16} />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {step.stepNumber}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Select value={step.operationName} onValueChange={v => updateStep(i, { operationName: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Operation..." /></SelectTrigger>
                        <SelectContent>
                          {COMMON_OPERATIONS.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <WorkCenterPicker
                        value={step.workCenterId || null}
                        onChange={(id, node) => updateStep(i, { workCenterId: id ?? '', workCenterName: node?.name ?? '' })}
                        placeholder="Work center..."
                        className="h-7 text-xs"
                      />
                    </div>
                    {steps.length > 1 && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => removeStep(i)}
                        onDragStart={e => e.stopPropagation()}
                      >
                        <X size={12} />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">Cycle time (sec / 1 out-unit)</span>
                      <Input type="number" min="0" step="1" value={step.cycleTimeSec} onChange={e => updateStep(i, { cycleTimeSec: e.target.value })} className="h-7 text-xs" placeholder="0" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">Setup time (min)</span>
                      <Input type="number" min="0" step="0.5" value={step.setupTimeMins} onChange={e => updateStep(i, { setupTimeMins: e.target.value })} className="h-7 text-xs" placeholder="0" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">Notes</span>
                      <Input value={step.description} onChange={e => updateStep(i, { description: e.target.value })} className="h-7 text-xs" placeholder="Parameters, notes..." />
                    </div>
                  </div>

                  {/* Unit flow — drives qty conversion + duration in scheduling */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">In unit (consumes)</span>
                      <select
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        value={step.inUnit}
                        onChange={e => updateStep(i, { inUnit: e.target.value })}
                      >
                        <option value="">— auto (previous step) —</option>
                        {FLOW_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">Out unit (produces · cycle is per 1)</span>
                      <select
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        value={step.outUnit}
                        onChange={e => updateStep(i, { outUnit: e.target.value })}
                      >
                        <option value="">— auto —</option>
                        {FLOW_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Input raw materials — feed Traceability & Genealogy on completion */}
                  <div className="mt-2 rounded-lg border border-border/50 bg-muted/20 p-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Input materials <span className="normal-case font-normal">(qty per 1 out-unit)</span>
                      </span>
                      <Button
                        size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]"
                        onClick={() => updateStep(i, { materials: [...step.materials, { rawMaterialId: '', name: '', qty: '', unit: 'KG' }] })}
                      >
                        <Plus size={10} className="mr-0.5" />Add material
                      </Button>
                    </div>
                    {step.materials.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/60 px-1">No input materials for this step.</p>
                    ) : step.materials.map((mat, mi) => (
                      <div key={mi} className="flex items-center gap-1.5 mb-1">
                        <select
                          className="h-7 flex-[2] rounded-md border border-input bg-background px-2 text-xs focus:outline-none"
                          value={mat.rawMaterialId}
                          onChange={e => {
                            const rm = rawMaterials.find(r => r.id === e.target.value);
                            const next = [...step.materials];
                            next[mi] = { ...mat, rawMaterialId: e.target.value, name: rm?.name ?? mat.name, unit: rm?.unit ?? mat.unit };
                            updateStep(i, { materials: next });
                          }}
                        >
                          <option value="">— free text —</option>
                          {rawMaterials.map(r => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
                        </select>
                        <Input
                          value={mat.name} placeholder="Material name"
                          onChange={e => { const next = [...step.materials]; next[mi] = { ...mat, name: e.target.value }; updateStep(i, { materials: next }); }}
                          className="h-7 flex-[2] text-xs" disabled={!!mat.rawMaterialId}
                        />
                        <Input
                          type="number" min="0" step="0.001" value={mat.qty} placeholder="Qty"
                          onChange={e => { const next = [...step.materials]; next[mi] = { ...mat, qty: e.target.value }; updateStep(i, { materials: next }); }}
                          className="h-7 w-20 text-xs"
                        />
                        <Input
                          value={mat.unit} placeholder="Unit"
                          onChange={e => { const next = [...step.materials]; next[mi] = { ...mat, unit: e.target.value }; updateStep(i, { materials: next }); }}
                          className="h-7 w-14 text-xs"
                        />
                        <button
                          className="p-1 text-muted-foreground hover:text-red-400"
                          onClick={() => updateStep(i, { materials: step.materials.filter((_, x) => x !== mi) })}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {dragIdx !== null && (
                <p className="text-[10px] text-muted-foreground text-center py-1 animate-pulse">
                  Drop to reorder — dependencies will update automatically
                </p>
              )}
            </div>
            {totalCycleSec > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Timer size={12} />
                Total cycle time: <strong>{totalCycleSec.toFixed(0)} sec</strong>
                <span className="text-muted-foreground/60">(≈ {(totalCycleSec / 60).toFixed(1)} min)</span>
              </div>
            )}
          </div>

          {/* Step Dependencies */}
          {steps.length >= 2 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label>Step Dependencies</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    FS = Finish-to-Start · SS = Start-to-Start (parallel) · SF = Start-to-Finish · FF = Finish-to-Finish · lag &lt;0 = lead
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={addDep} className="h-7 text-xs">
                  <Link2 size={12} className="mr-1" />Add Dependency
                </Button>
              </div>
              {deps.length === 0 ? (
                <div className="text-xs text-muted-foreground p-3 border rounded-lg border-dashed text-center">
                  No dependencies — sequential by default. Add SS for parallel operations.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {deps.map((dep, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/10">
                      <Select value={String(dep.fromStepIndex)} onValueChange={v => updateDep(i, { fromStepIndex: parseInt(v, 10) })}>
                        <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {steps.map((s, si) => si !== dep.toStepIndex && (
                            <SelectItem key={si} value={String(si)}>Step {s.stepNumber}: {s.operationName || 'Unnamed'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={dep.type} onValueChange={v => updateDep(i, { type: v as DependencyType })}>
                        <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DEP_TYPES.map(dt => (
                            <SelectItem key={dt.value} value={dt.value}>
                              <span className={cn('font-mono font-bold mr-1.5', dt.color)}>{dt.short}</span>{dt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <ArrowRight size={12} className="shrink-0 text-muted-foreground" />
                      <Select value={String(dep.toStepIndex)} onValueChange={v => updateDep(i, { toStepIndex: parseInt(v, 10) })}>
                        <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {steps.map((s, si) => si !== dep.fromStepIndex && (
                            <SelectItem key={si} value={String(si)}>Step {s.stepNumber}: {s.operationName || 'Unnamed'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-col gap-0.5 w-24">
                        <span className="text-[9px] text-muted-foreground">Lag (min, -=lead)</span>
                        <Input type="number" step="1" value={dep.lagMins} onChange={e => updateDep(i, { lagMins: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeDep(i)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t flex items-center justify-end gap-2 sticky bottom-0 bg-background">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={onSubmit} disabled={isPending || !canSubmit}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────

export function ManufacturingProcessesView() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [newProcess, setNewProcess] = useState<ProcHeader>(EMPTY_HEADER);
  const [steps, setSteps] = useState<StepForm[]>([{ ...EMPTY_STEP(), stepNumber: 1 }]);
  const [deps, setDeps] = useState<StepDependency[]>([]);

  // Edit form
  const [editProc, setEditProc] = useState<ManufacturingProcess | null>(null);
  const [editProcess, setEditProcess] = useState<ProcHeader>(EMPTY_HEADER);
  const [editSteps, setEditSteps] = useState<StepForm[]>([]);
  const [editDeps, setEditDeps] = useState<StepDependency[]>([]);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ManufacturingProcess | null>(null);
  // Revert to draft confirm
  const [revertTarget, setRevertTarget] = useState<ManufacturingProcess | null>(null);

  const [sortCol, setSortCol] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (col: string) => {
    if (col === sortCol) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const { data: processData, isLoading } = useQuery({
    queryKey: ['manufacturing-processes', page, sortCol, sortDir],
    queryFn: () => api.get(`/inventory/manufacturing-processes?page=${page}&limit=20&sortBy=${sortCol}&sortOrder=${sortDir}`),
  });

  const { data: skusData } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/inventory/products?limit=200'),
    staleTime: 60_000,
  });

  const processes: ManufacturingProcess[] = (processData as any)?.data ?? [];
  const total: number = (processData as any)?.total ?? 0;
  const skus: any[] = (skusData as any)?.data ?? [];

  const { sortedData } = useSortedData(processes, sortCol, sortDir);

  const resetCreate = () => {
    setNewProcess(EMPTY_HEADER);
    setSteps([{ ...EMPTY_STEP(), stepNumber: 1 }]);
    setDeps([]);
  };

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/inventory/manufacturing-processes', dto),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['manufacturing-processes'] }); setCreateOpen(false); resetCreate(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/inventory/manufacturing-processes/${id}`, dto),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['manufacturing-processes'] }); setEditProc(null); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/inventory/manufacturing-processes/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manufacturing-processes'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/manufacturing-processes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['manufacturing-processes'] }); setDeleteTarget(null); },
  });

  const revertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/inventory/manufacturing-processes/${id}/revert-to-draft`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['manufacturing-processes'] }); setRevertTarget(null); },
  });

  useEffect(() => { setPage(1); }, [sortCol, sortDir]);
  useEffect(() => { setPage(1); }, [search]);

  const filteredProcesses = sortedData.filter(p =>
    !search || processScopeLabel(p).toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const openEdit = (proc: ManufacturingProcess) => {
    setEditProc(proc);
    setEditProcess({
      scopeType: proc.scopeType ?? 'PRODUCT',
      skuId: proc.skuId ?? '',
      categoryId: proc.categoryRef?.id ?? '',
      baseWeightId: proc.baseWeightRef?.id ?? '',
      skuIds: (proc.skuLinks ?? []).map(l => l.sku.id),
      version: proc.version, name: proc.name, description: proc.description ?? '',
    });
    setEditSteps(proc.routingSteps.map(s => ({
      stepNumber: s.stepNumber,
      operationName: s.operationName,
      workCenterId: s.workCenterId ?? s.workCenterRef?.id ?? '',
      workCenterName: s.workCenterRef?.name ?? s.workCenter ?? '',
      cycleTimeSec: String(s.cycleTimeSec ?? (s.cycleTimeMins != null ? s.cycleTimeMins * 60 : '')),
      setupTimeMins: String(s.setupTimeMins ?? ''),
      inUnit: s.inUnit ?? '',
      outUnit: s.outUnit ?? '',
      materials: (s.materials ?? []).map(m => ({
        rawMaterialId: m.rawMaterialId ?? '',
        name: m.name,
        qty: String(m.qtyPerOutputUnit),
        unit: m.unit,
      })),
      description: s.description ?? '',
      isOptional: s.isOptional,
    })));
    // Rebuild deps from predecessors
    const newDeps: StepDependency[] = [];
    proc.routingSteps.forEach((step, toIdx) => {
      (step.predecessors ?? []).forEach(pred => {
        const fromIdx = proc.routingSteps.findIndex(s => s.id === pred.fromStep.id);
        if (fromIdx >= 0) newDeps.push({ fromStepIndex: fromIdx, toStepIndex: toIdx, type: pred.type, lagMins: pred.lagMins });
      });
    });
    setEditDeps(newDeps);
  };

  const stepsPayload = (list: StepForm[], depList: StepDependency[]) =>
    list.map((s, i) => ({
      stepNumber: s.stepNumber,
      operationName: s.operationName,
      workCenterId: s.workCenterId || undefined,
      workCenter: s.workCenterName || undefined,
      cycleTimeSec: parseFloat(s.cycleTimeSec || '0') || undefined,
      setupTimeMins: parseFloat(s.setupTimeMins || '0') || undefined,
      inUnit: s.inUnit || undefined,
      outUnit: s.outUnit || undefined,
      materials: s.materials
        .filter(m => m.name.trim() && parseFloat(m.qty || '0') > 0)
        .map(m => ({
          rawMaterialId: m.rawMaterialId || undefined,
          name: m.name.trim(),
          qtyPerOutputUnit: parseFloat(m.qty),
          unit: m.unit || 'KG',
        })),
      description: s.description || undefined,
      isOptional: s.isOptional,
      dependencies: depList.filter(d => d.toStepIndex === i).map(d => ({
        fromStepNumber: list[d.fromStepIndex].stepNumber,
        type: d.type,
        lagMins: d.lagMins,
      })),
    }));

  const scopePayload = (h: ProcHeader) => ({
    scopeType: h.scopeType,
    skuId: h.scopeType === 'PRODUCT' ? h.skuId : undefined,
    categoryId: h.scopeType === 'CATEGORY' ? h.categoryId : undefined,
    baseWeightId: h.scopeType === 'BASE_WEIGHT' ? h.baseWeightId : undefined,
    skuIds: h.scopeType === 'PRODUCT_LIST' ? h.skuIds : undefined,
  });

  const handleCreate = () => {
    const totalSec = steps.reduce((s, st) => s + (parseFloat(st.cycleTimeSec || '0') || 0), 0);
    createMutation.mutate({
      ...scopePayload(newProcess),
      version: newProcess.version,
      name: newProcess.name,
      description: newProcess.description || undefined,
      totalCycleTimeMins: totalSec ? totalSec / 60 : undefined,
      steps: stepsPayload(steps, deps),
    });
  };

  const handleEdit = () => {
    if (!editProc) return;
    const totalSec = editSteps.reduce((s, st) => s + (parseFloat(st.cycleTimeSec || '0') || 0), 0);
    updateMutation.mutate({
      id: editProc.id,
      dto: {
        ...scopePayload(editProcess),
        name: editProcess.name,
        description: editProcess.description || undefined,
        totalCycleTimeMins: totalSec ? totalSec / 60 : undefined,
        steps: stepsPayload(editSteps, editDeps),
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Manufacturing Processes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define operation routing for each product — step-by-step with cycle times, work centers and PDM dependencies
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1.5" />New Process
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
        <Info size={15} className="mt-0.5 text-primary shrink-0" />
        <span>
          The diagram below uses <strong className="text-foreground">PDM (Precedence Diagram Method)</strong> notation.
          Steps in the same column run <strong className="text-foreground">in parallel</strong> (SS dependency).
          Arrows are color-coded: <span className="text-blue-400 font-mono font-bold">FS</span> sequential,{' '}
          <span className="text-violet-400 font-mono font-bold">SS</span> parallel,{' '}
          <span className="text-emerald-400 font-mono font-bold">FF</span> finish-together,{' '}
          <span className="text-orange-400 font-mono font-bold">SF</span> rare constraint.
        </span>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by product or process name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
      </div>

      {/* Process list */}
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground p-8 text-center">Loading processes...</div>
        ) : filteredProcesses.length === 0 ? (
          <div className="border rounded-xl p-12 text-center text-sm text-muted-foreground">
            <Workflow size={32} className="mx-auto mb-3 opacity-20" />
            No manufacturing processes defined yet.
          </div>
        ) : filteredProcesses.map(proc => (
          <ProcessCard
            key={proc.id}
            process={proc}
            isExpanded={expandedId === proc.id}
            onToggle={() => setExpandedId(expandedId === proc.id ? null : proc.id)}
            onApprove={() => approveMutation.mutate(proc.id)}
            onEdit={() => openEdit(proc)}
            onDelete={() => setDeleteTarget(proc)}
            onRevert={() => setRevertTarget(proc)}
          />
        ))}
      </div>

      <TablePagination page={page} total={total} limit={20} onPageChange={setPage} />

      {/* Create dialog */}
      <AnimatePresence>
        {createOpen && (
          <ProcessForm
            title="Create Manufacturing Process"
            skus={skus}
            newProcess={newProcess}
            setNewProcess={setNewProcess}
            steps={steps}
            setSteps={setSteps}
            deps={deps}
            setDeps={setDeps}
            onSubmit={handleCreate}
            onCancel={() => { setCreateOpen(false); resetCreate(); }}
            isPending={createMutation.isPending}
            submitLabel="Create Process"
          />
        )}
      </AnimatePresence>

      {/* Edit dialog */}
      <AnimatePresence>
        {editProc && (
          <ProcessForm
            title={`Edit: ${editProc.name}`}
            skus={skus}
            newProcess={editProcess}
            setNewProcess={setEditProcess}
            steps={editSteps}
            setSteps={setEditSteps}
            deps={editDeps}
            setDeps={setEditDeps}
            onSubmit={handleEdit}
            onCancel={() => setEditProc(null)}
            isPending={updateMutation.isPending}
            submitLabel="Save Changes"
            lockSku
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border rounded-xl shadow-2xl w-full max-w-sm p-6"
            >
              <h3 className="font-semibold mb-2">Delete Process?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>{deleteTarget.name}</strong> (v{deleteTarget.version}) and all its routing steps will be permanently deleted.
                Approved processes cannot be deleted.
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Revert to Draft confirm */}
      <AnimatePresence>
        {revertTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border rounded-xl shadow-2xl w-full max-w-sm p-6"
            >
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw size={16} className="text-amber-400" />
                <h3 className="font-semibold">Revert to Draft?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>{revertTarget.name}</strong> (v{revertTarget.version}) will lose its approval status and become a draft again.
                It will no longer be the active process for this product until re-approved.
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setRevertTarget(null)}>Cancel</Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => revertMutation.mutate(revertTarget.id)}
                  disabled={revertMutation.isPending}
                >
                  {revertMutation.isPending ? 'Reverting...' : 'Revert to Draft'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Process Card ──────────────────────────────────────────────

function ProcessCard({ process, isExpanded, onToggle, onApprove, onEdit, onDelete, onRevert }: {
  process: ManufacturingProcess;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRevert: () => void;
}) {
  const totalCycleSec = process.routingSteps.reduce(
    (s, r) => s + (r.cycleTimeSec ?? (r.cycleTimeMins != null ? r.cycleTimeMins * 60 : 0)), 0);
  const totalSetup = process.routingSteps.reduce((s, r) => s + (r.setupTimeMins ?? 0), 0);
  const hasParallel = process.routingSteps.some(s =>
    s.predecessors?.some(p => p.type === 'START_TO_START' || p.type === 'FINISH_TO_FINISH'),
  );

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onToggle}>
        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
          <Workflow size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{process.sku?.itemNumber ?? processScopeLabel(process)}</span>
            {process.sku && <span className="text-xs text-muted-foreground">— {process.sku.name}</span>}
            {process.scopeType && process.scopeType !== 'PRODUCT' && (
              <Badge variant="outline" className="text-[10px] h-4 text-sky-400 border-sky-500/30">
                {process.scopeType === 'CATEGORY' ? 'Category scope' : process.scopeType === 'BASE_WEIGHT' ? 'Weight scope' : 'Product list'}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] h-4">v{process.version}</Badge>
            {process.approvedAt ? (
              <Badge className="text-[10px] h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <CheckCircle2 size={8} className="mr-1" />Approved
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] h-4 text-amber-500 border-amber-500/30">Draft</Badge>
            )}
            {hasParallel && (
              <Badge variant="outline" className="text-[10px] h-4 text-violet-400 border-violet-500/30">Parallel steps</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
            <span>{process.routingSteps.length} steps</span>
            {totalCycleSec > 0 && <span><Clock size={10} className="inline mr-0.5" />{totalCycleSec.toFixed(0)} sec cycle</span>}
            {totalSetup > 0 && <span>{totalSetup.toFixed(0)} min setup</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {!process.approvedAt && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onApprove}>
              <FileCheck2 size={12} className="mr-1" />Approve
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil size={13} className="mr-2" />Edit
              </DropdownMenuItem>
              {process.approvedAt && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onRevert} className="text-amber-400 focus:text-amber-400">
                    <RotateCcw size={13} className="mr-2" />Revert to Draft
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={!process.approvedAt ? onDelete : undefined}
                disabled={!!process.approvedAt}
                className={!process.approvedAt ? 'text-destructive focus:text-destructive' : 'text-muted-foreground'}
              >
                <Trash2 size={13} className="mr-2" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t p-4">
              <PdmDiagram steps={process.routingSteps} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
