'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Play, Pause, CheckSquare, RefreshCw, Factory, Timer,
  Cpu, Layers, Package, Box, Boxes, User, Check, X,
  AlertCircle, ClipboardList, ArrowDownCircle, GitBranch,
  GitMerge, Shuffle, ChevronRight, BarChart2, TrendingUp,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api.client';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type JOStatus = 'SCHEDULED' | 'READY' | 'EXECUTING' | 'PAUSED' | 'COMPLETE' | 'CANCELLED';
type DepType  = 'FINISH_TO_START' | 'START_TO_START' | 'START_TO_FINISH' | 'FINISH_TO_FINISH' | null;

interface Operator { id: string; name: string; nameAr?: string }
interface ShopFloorJO {
  id: string;
  sequenceOrder: number;
  operationName: string;
  status: JOStatus;
  depType: DepType;
  plannedQtyOut?: number;
  outputUnit?: string;
  actualQtyGood: number;
  actualQtyRejected: number;
  scrapReason?: string;
  operatorId?: string;
  operator?: Operator;
  actualStart?: string;
  actualEnd?: string;
  workOrder?: {
    id: string;
    orderNumber: string;
    sku?: { name: string; code: string };
    productionOrder?: { orderNumber: string };
  };
  machine?: { name: string; code: string };
  workCenter?: { name: string; code: string };
  predecessor?: { id: string; operationName: string; status: JOStatus };
  joQuality?: number;
  joPerformance?: number;
  joAvailability?: number;
  joOEE?: number;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const JO_STATUS: Record<JOStatus, { label: string; color: string; dot: string; border: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'text-slate-400  bg-slate-400/10  border-slate-400/30',  dot: 'bg-slate-400',   border: 'border-l-slate-500/40'  },
  READY:     { label: 'Ready',     color: 'text-blue-400   bg-blue-400/10   border-blue-400/30',   dot: 'bg-blue-400',    border: 'border-l-blue-500'      },
  EXECUTING: { label: 'Executing', color: 'text-green-400  bg-green-400/10  border-green-400/30',  dot: 'bg-green-400',   border: 'border-l-green-500'     },
  PAUSED:    { label: 'Paused',    color: 'text-amber-400  bg-amber-400/10  border-amber-400/30',  dot: 'bg-amber-400',   border: 'border-l-amber-500'     },
  COMPLETE:  { label: 'Complete',  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', dot: 'bg-emerald-400', border: 'border-l-emerald-500' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-400    bg-red-400/10    border-red-400/30',    dot: 'bg-red-400',     border: 'border-l-red-500/40'    },
};

const DEP_BADGE: Record<string, { short: string; color: string }> = {
  FINISH_TO_START:  { short: 'FS', color: 'text-slate-400  bg-slate-400/10  border-slate-400/20'  },
  START_TO_START:   { short: 'SS', color: 'text-cyan-400   bg-cyan-400/10   border-cyan-400/20'   },
  START_TO_FINISH:  { short: 'SF', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  FINISH_TO_FINISH: { short: 'FF', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
};

const UNIT_BADGE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PIECE:  { label: 'PCS', color: 'text-sky-400    bg-sky-400/10    border-sky-400/20',    icon: <Package className="w-3 h-3" /> },
  CARTON: { label: 'CTN', color: 'text-amber-400  bg-amber-400/10  border-amber-400/20',  icon: <Box     className="w-3 h-3" /> },
  PALLET: { label: 'PLT', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: <Boxes   className="w-3 h-3" /> },
};

const VALID_NEXT: Record<JOStatus, JOStatus[]> = {
  SCHEDULED: ['CANCELLED'],
  READY:     ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['PAUSED', 'COMPLETE', 'CANCELLED'],
  PAUSED:    ['EXECUTING', 'CANCELLED'],
  COMPLETE:  [],
  CANCELLED: [],
};

const STATUS_FILTERS = [
  { value: 'ACTIVE',     label: 'Active' },
  { value: 'ALL',        label: 'All' },
  { value: 'READY',      label: 'Ready' },
  { value: 'EXECUTING',  label: 'Executing' },
  { value: 'PAUSED',     label: 'Paused' },
  { value: 'COMPLETE',   label: 'Complete' },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function fmtElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: JOStatus }) {
  const c = JO_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.color}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot} ${status === 'EXECUTING' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
}

function UnitTag({ unit }: { unit?: string }) {
  if (!unit) return null;
  const cfg = UNIT_BADGE[unit];
  if (!cfg) return <span className="text-xs text-muted-foreground">{unit}</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function DepTag({ type }: { type: DepType }) {
  if (!type) return null;
  const d = DEP_BADGE[type];
  if (!d) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold tracking-wider ${d.color}`}>
      {d.short}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Live elapsed timer hook
// ─────────────────────────────────────────────────────────────

function useElapsed(jo: ShopFloorJO) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (jo.status !== 'EXECUTING') {
      if (jo.actualStart && jo.actualEnd) {
        setElapsed(Math.floor(
          (new Date(jo.actualEnd).getTime() - new Date(jo.actualStart).getTime()) / 1000,
        ));
      } else if (jo.status === 'PAUSED' && jo.actualStart) {
        setElapsed(Math.floor((Date.now() - new Date(jo.actualStart).getTime()) / 1000));
      }
      return;
    }
    const start = jo.actualStart ? new Date(jo.actualStart).getTime() : Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [jo.status, jo.actualStart, jo.actualEnd]);

  return elapsed;
}

// ─────────────────────────────────────────────────────────────
// Shop Floor Card
// ─────────────────────────────────────────────────────────────

function ShopFloorCard({
  jo, users, pending,
  onTransition, onCount, onAssignOperator,
}: {
  jo: ShopFloorJO;
  users: Operator[];
  pending: boolean;
  onTransition: (id: string, status: JOStatus, qty?: number) => void;
  onCount: (id: string, good: number, scrap: number, reason: string, category?: string) => void;
  onAssignOperator: (id: string, operatorId: string | null) => void;
}) {
  const [goodQty,      setGoodQty]      = useState(String(jo.actualQtyGood || ''));
  const [scrapQty,     setScrapQty]     = useState(String(jo.actualQtyRejected || ''));
  const [scrapReason,  setScrapReason]  = useState(jo.scrapReason || '');
  const [scrapCategory, setScrapCategory] = useState('OTHER');
  const [showAssign, setShowAssign]  = useState(false);
  const elapsed = useElapsed(jo);

  // sync inputs when jo updates (e.g. after save)
  useEffect(() => {
    setGoodQty(String(jo.actualQtyGood || ''));
    setScrapQty(String(jo.actualQtyRejected || ''));
    setScrapReason(jo.scrapReason || '');
  }, [jo.actualQtyGood, jo.actualQtyRejected, jo.scrapReason]);

  const progress = (jo.plannedQtyOut ?? 0) > 0
    ? Math.min(100, Math.round((jo.actualQtyGood / (jo.plannedQtyOut ?? 1)) * 100))
    : 0;

  const next     = VALID_NEXT[jo.status] ?? [];
  const canLog   = ['EXECUTING', 'PAUSED'].includes(jo.status);
  const statusCfg = JO_STATUS[jo.status];

  return (
    <div className={`glass-card rounded-2xl overflow-hidden flex flex-col border-l-4 ${statusCfg.border}`}>

      {/* ── Card header ── */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <DepTag type={jo.depType} />
            <span className="text-xs text-muted-foreground font-mono">#{jo.sequenceOrder}</span>
            {jo.workOrder && (
              <span className="text-xs text-brand-400/70 font-mono">{jo.workOrder.orderNumber}</span>
            )}
          </div>
          <h3 className="text-xl font-bold tracking-wide truncate">{jo.operationName}</h3>
          <div className="flex items-center gap-2 flex-wrap mt-1 text-sm text-muted-foreground">
            {(jo.machine || jo.workCenter) && (
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" />
                {jo.machine?.name ?? jo.workCenter?.name}
              </span>
            )}
            {jo.workOrder?.sku && (
              <span className="flex items-center gap-1 text-xs">
                <ChevronRight className="w-3 h-3" />
                {jo.workOrder.sku.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusPill status={jo.status} />
          {(jo.status === 'EXECUTING' || (jo.status === 'PAUSED' && elapsed > 0)) && (
            <span className={`flex items-center gap-1 font-mono text-sm font-semibold
              ${jo.status === 'EXECUTING' ? 'text-green-400' : 'text-amber-400'}`}>
              <Timer className="w-3.5 h-3.5" />
              {fmtElapsed(elapsed)}
            </span>
          )}
        </div>
      </div>

      {/* ── OEE mini row ── */}
      {(jo.joOEE != null || jo.joQuality != null) && (
        <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
          {jo.joQuality != null && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border text-green-400 bg-green-400/10 border-green-400/30 tabular-nums">
              Q: {jo.joQuality.toFixed(1)}%
            </span>
          )}
          {jo.joPerformance != null && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border text-blue-400 bg-blue-400/10 border-blue-400/30 tabular-nums">
              P: {jo.joPerformance.toFixed(1)}%
            </span>
          )}
          {jo.joAvailability != null && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border text-yellow-400 bg-yellow-400/10 border-yellow-400/30 tabular-nums">
              A: {jo.joAvailability.toFixed(1)}%
            </span>
          )}
          {jo.joOEE != null && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${
              jo.joOEE >= 85
                ? 'text-green-400 bg-green-400/10 border-green-400/30'
                : jo.joOEE >= 60
                ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
                : 'text-red-400 bg-red-400/10 border-red-400/30'
            }`}>
              OEE: {jo.joOEE.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* ── Progress bar ── */}
      {(jo.plannedQtyOut ?? 0) > 0 && (
        <div className="px-5 pb-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Target <span className="text-foreground font-semibold">{jo.plannedQtyOut}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">
                {jo.actualQtyGood}
                {jo.actualQtyRejected > 0 && (
                  <span className="text-red-400/80 text-xs ml-1">+{jo.actualQtyRejected}✗</span>
                )}
                <span className="text-muted-foreground font-normal"> / {jo.plannedQtyOut}</span>
              </span>
              <UnitTag unit={jo.outputUnit} />
              <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{progress}%</span>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500
                ${jo.status === 'COMPLETE' ? 'bg-emerald-500' : jo.status === 'EXECUTING' ? 'bg-green-500' : 'bg-brand-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Operator row ── */}
      <div className="px-5 py-2.5 border-t border-border/20 flex items-center gap-2">
        <User className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        {showAssign ? (
          <div className="flex items-center gap-2 flex-1">
            <select
              autoFocus
              defaultValue={jo.operatorId ?? ''}
              onChange={(e) => {
                onAssignOperator(jo.id, e.target.value || null);
                setShowAssign(false);
              }}
              onBlur={() => setShowAssign(false)}
              className="flex-1 text-sm bg-background/80 border border-brand-400/40 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400"
            >
              <option value="">— Unassign operator —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button onClick={() => setShowAssign(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : jo.operator ? (
          <button
            onClick={() => setShowAssign(true)}
            className="text-sm text-foreground hover:text-brand-400 transition-colors flex-1 text-left"
          >
            {jo.operator.name}
            <span className="text-xs text-muted-foreground/50 ml-2">(tap to change)</span>
          </button>
        ) : (
          <button
            onClick={() => setShowAssign(true)}
            className="text-sm text-muted-foreground/50 hover:text-brand-400 transition-colors flex-1 text-left italic"
          >
            Tap to assign operator
          </button>
        )}
      </div>

      {/* ── Count inputs (EXECUTING or PAUSED) ── */}
      {canLog && (
        <div className="px-5 py-4 border-t border-border/20 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" />Production Count
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Good */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-green-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />Good
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={goodQty}
                onChange={(e) => setGoodQty(e.target.value)}
                placeholder="0"
                className="w-full h-14 text-2xl font-bold text-center tabular-nums bg-green-500/5 border border-green-500/20 rounded-xl focus:outline-none focus:border-green-400 text-green-400 placeholder:text-green-400/20"
              />
            </div>
            {/* Scrap */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-red-400 flex items-center gap-1">
                <X className="w-3.5 h-3.5" />Scrap
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={scrapQty}
                onChange={(e) => setScrapQty(e.target.value)}
                placeholder="0"
                className="w-full h-14 text-2xl font-bold text-center tabular-nums bg-red-500/5 border border-red-500/20 rounded-xl focus:outline-none focus:border-red-400 text-red-400 placeholder:text-red-400/20"
              />
            </div>
          </div>
          {parseFloat(scrapQty) > 0 && (
            <div className="space-y-2">
              <select
                value={scrapCategory}
                onChange={(e) => setScrapCategory(e.target.value)}
                className="w-full h-12 px-3 text-sm bg-red-500/5 border border-red-500/20 rounded-xl focus:outline-none focus:border-red-400 text-red-300"
              >
                {['QUALITY','SETUP','DAMAGE','OVERRUN','MATERIAL','MACHINE','OPERATOR','OTHER'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Scrap / rejection reason…"
                value={scrapReason}
                onChange={(e) => setScrapReason(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-red-500/5 border border-red-500/20 rounded-xl focus:outline-none focus:border-red-400 placeholder:text-muted-foreground/40"
              />
            </div>
          )}
          <button
            disabled={pending}
            onClick={() => onCount(
              jo.id,
              parseFloat(goodQty) || 0,
              parseFloat(scrapQty) || 0,
              scrapReason,
              scrapCategory,
            )}
            className="w-full h-12 rounded-xl bg-brand-500/20 hover:bg-brand-500/30 border border-brand-400/40 text-brand-400 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            Save Count
          </button>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="px-5 py-4 border-t border-border/20 flex gap-3 mt-auto">
        {jo.status === 'READY' && (
          <button
            disabled={pending}
            onClick={() => onTransition(jo.id, 'EXECUTING')}
            className="flex-1 h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 transition-colors shadow-lg shadow-green-500/20"
          >
            <Play className="w-5 h-5 fill-current" />START
          </button>
        )}

        {jo.status === 'EXECUTING' && (
          <>
            <button
              disabled={pending}
              onClick={() => onTransition(jo.id, 'PAUSED')}
              className="h-14 px-6 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
            >
              <Pause className="w-5 h-5" />
            </button>
            <button
              disabled={pending}
              onClick={() => onTransition(
                jo.id, 'COMPLETE',
                parseFloat(goodQty) || jo.actualQtyGood || jo.plannedQtyOut || 0,
              )}
              className="flex-1 h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <CheckSquare className="w-5 h-5" />COMPLETE
            </button>
          </>
        )}

        {jo.status === 'PAUSED' && (
          <>
            <button
              disabled={pending}
              onClick={() => onTransition(jo.id, 'EXECUTING')}
              className="flex-1 h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 transition-colors shadow-lg shadow-blue-500/20"
            >
              <Play className="w-5 h-5 fill-current" />RESUME
            </button>
            <button
              disabled={pending}
              onClick={() => onTransition(
                jo.id, 'COMPLETE',
                parseFloat(goodQty) || jo.actualQtyGood || jo.plannedQtyOut || 0,
              )}
              className="flex-1 h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <CheckSquare className="w-5 h-5" />COMPLETE
            </button>
          </>
        )}

        {jo.status === 'COMPLETE' && (
          <div className="flex-1 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-base flex items-center justify-center gap-2">
            <CheckSquare className="w-5 h-5" />Completed — {jo.actualQtyGood} {jo.outputUnit ?? ''}
          </div>
        )}

        {jo.status === 'SCHEDULED' && (
          <div className="flex-1 h-14 rounded-xl bg-muted/50 border border-border/30 text-muted-foreground font-medium text-sm flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Waiting for predecessor: {jo.predecessor?.operationName ?? '—'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI bar
// ─────────────────────────────────────────────────────────────

function KpiBar({ jobs }: { jobs: ShopFloorJO[] }) {
  const executing = jobs.filter((j) => j.status === 'EXECUTING').length;
  const ready     = jobs.filter((j) => j.status === 'READY').length;
  const paused    = jobs.filter((j) => j.status === 'PAUSED').length;
  const complete  = jobs.filter((j) => j.status === 'COMPLETE').length;

  const totalGood  = jobs.reduce((s, j) => s + j.actualQtyGood, 0);
  const totalScrap = jobs.reduce((s, j) => s + j.actualQtyRejected, 0);

  return (
    <div className="flex items-center gap-4 flex-wrap text-sm">
      {executing > 0 && (
        <span className="flex items-center gap-1.5 text-green-400 font-semibold">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {executing} Executing
        </span>
      )}
      {ready > 0 && (
        <span className="flex items-center gap-1.5 text-blue-400">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          {ready} Ready
        </span>
      )}
      {paused > 0 && (
        <span className="flex items-center gap-1.5 text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {paused} Paused
        </span>
      )}
      {complete > 0 && (
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          {complete} Done
        </span>
      )}
      {(totalGood + totalScrap) > 0 && (
        <>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-green-400 font-mono">{totalGood} ✓</span>
          {totalScrap > 0 && <span className="text-red-400 font-mono">{totalScrap} ✗</span>}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────

export function ShopFloorView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const QK = ['shop-floor-jobs', statusFilter] as const;

  const { data: rawData, isLoading, dataUpdatedAt } = useQuery({
    queryKey: QK,
    queryFn: () => api.get('/production/job-orders'),
    refetchInterval: 10_000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users', { params: { limit: 200 } }),
    staleTime: 300_000,
  });

  const allJobs: ShopFloorJO[] = (rawData as any) ?? [];
  const users: Operator[] = (((usersData as any)?.data) ?? []).map((u: any) => ({
    id: u.id, name: u.name, nameAr: u.nameAr,
  }));

  const filteredJobs = useMemo(() => {
    if (statusFilter === 'ACTIVE') {
      return allJobs.filter((j) => ['READY', 'EXECUTING', 'PAUSED'].includes(j.status));
    }
    if (statusFilter === 'ALL') return allJobs;
    return allJobs.filter((j) => j.status === statusFilter);
  }, [allJobs, statusFilter]);

  // Sort: EXECUTING first, then PAUSED, then READY, then others; within group by seq
  const sorted = useMemo(() => {
    const order: Record<string, number> = { EXECUTING: 0, PAUSED: 1, READY: 2, SCHEDULED: 3, COMPLETE: 4, CANCELLED: 5 };
    return [...filteredJobs].sort((a, b) => {
      const od = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      return od !== 0 ? od : a.sequenceOrder - b.sequenceOrder;
    });
  }, [filteredJobs]);

  const transitionMut = useMutation({
    mutationFn: ({ id, status, qty }: { id: string; status: JOStatus; qty?: number }) =>
      api.patch(`/production/job-orders/${id}/status`, {
        status,
        ...(qty !== undefined && { actualQtyGood: qty }),
      }),
    onSuccess: (_r, { status }) => {
      qc.invalidateQueries({ queryKey: ['shop-floor-jobs'] });
      qc.invalidateQueries({ queryKey: ['job-orders'] });
      toast({ title: `→ ${status}` });
    },
    onError: (e: any) => toast({
      variant: 'destructive',
      title: 'Transition failed',
      description: e?.response?.data?.message ?? 'Dependency constraint not met',
    }),
  });

  const countMut = useMutation({
    mutationFn: ({ id, good, scrap, reason, category }: { id: string; good: number; scrap: number; reason: string; category?: string }) =>
      api.patch(`/production/job-orders/${id}/output`, {
        actualQtyGood: good,
        actualQtyRejected: scrap,
        scrapReason: reason,
        scrapCategory: category ?? 'OTHER',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-floor-jobs'] });
      qc.invalidateQueries({ queryKey: ['job-orders'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      toast({ title: 'Count saved' });
    },
    onError: (e: any) => toast({
      variant: 'destructive',
      title: 'Failed to save count',
      description: e?.response?.data?.message,
    }),
  });

  const operatorMut = useMutation({
    mutationFn: ({ id, operatorId }: { id: string; operatorId: string | null }) =>
      api.patch(`/production/job-orders/${id}/operator`, { operatorId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-floor-jobs'] }),
    onError: (e: any) => toast({
      variant: 'destructive',
      title: 'Failed to assign operator',
      description: e?.response?.data?.message,
    }),
  });

  const isPending = transitionMut.isPending || countMut.isPending || operatorMut.isPending;

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-lg border-b border-border/60 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between flex-wrap gap-3">
          {/* Brand + title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center">
              <Factory className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">Shop Floor</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                ISA-95 Real-time Execution · Refresh: {lastRefresh}
              </p>
            </div>
          </div>

          {/* KPI + filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <KpiBar jobs={allJobs} />
          </div>

          {/* Filter tabs + refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  statusFilter === f.value
                    ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted/60'
                }`}
              >
                {f.label}
                {f.value === 'ACTIVE' && (
                  <span className="ml-1.5 opacity-60">
                    ({allJobs.filter((j) => ['READY', 'EXECUTING', 'PAUSED'].includes(j.status)).length})
                  </span>
                )}
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ['shop-floor-jobs'] })}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="flex-1 p-4 max-w-screen-2xl mx-auto w-full">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shimmer h-80 rounded-2xl" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 glass-card rounded-2xl">
            <ClipboardList className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-base font-semibold text-muted-foreground">No job orders to display</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {statusFilter === 'ACTIVE'
                ? 'No active jobs. Change the filter to see all.'
                : 'Generate job orders from Production Orders to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((jo) => (
              <ShopFloorCard
                key={jo.id}
                jo={jo}
                users={users}
                pending={isPending}
                onTransition={(id, status, qty) => transitionMut.mutate({ id, status, qty })}
                onCount={(id, good, scrap, reason, category) => countMut.mutate({ id, good, scrap, reason, category })}
                onAssignOperator={(id, operatorId) => operatorMut.mutate({ id, operatorId })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
