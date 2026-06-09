'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers, Search, Play, Pause, CheckSquare, Circle,
  Clock, Cpu, ChevronRight, RefreshCw,
  AlertCircle, XCircle, Loader2, ClipboardList,
  Filter, ChevronLeft, GitMerge, ArrowDownCircle,
  GitBranch, Shuffle, Check, X, Package, Box, Boxes,
  User, BarChart2, Monitor, AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/services/api.client';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useSortedData } from '@/lib/use-sorted-data';
import { TablePagination } from '@/components/ui/table-pagination';

// ─────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────

type JOStatus = 'SCHEDULED' | 'READY' | 'EXECUTING' | 'PAUSED' | 'COMPLETE' | 'CANCELLED';
type DepType  = 'FINISH_TO_START' | 'START_TO_START' | 'START_TO_FINISH' | 'FINISH_TO_FINISH' | null;

interface Operator { id: string; name: string; nameAr?: string }

interface JobOrder {
  id: string;
  sequenceOrder: number;
  operationName: string;
  status: JOStatus;
  depType: DepType;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  plannedQtyIn?: number;
  plannedQtyOut?: number;
  outputUnit?: string;
  actualQtyGood: number;
  actualQtyRejected: number;
  scrapReason?: string;
  operatorId?: string;
  operator?: Operator;
  notes?: string;
  workOrder?: {
    id: string;
    orderNumber: string;
    sku?: { name: string; code: string };
    productionOrder?: { orderNumber: string };
  };
  machine?: { name: string; code: string };
  workCenter?: { name: string; code: string };
  predecessor?: {
    id: string;
    operationName: string;
    status: JOStatus;
    actualStart?: string;
  };
  joQuality?: number;
  joPerformance?: number;
  joAvailability?: number;
  joOEE?: number;
}

const JO_STATUS: Record<JOStatus, { label: string; color: string; dot: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'text-slate-400 bg-slate-400/10 border-slate-400/30', dot: 'bg-slate-400' },
  READY:     { label: 'Ready',     color: 'text-blue-400  bg-blue-400/10  border-blue-400/30',  dot: 'bg-blue-400' },
  EXECUTING: { label: 'Executing', color: 'text-green-400 bg-green-400/10 border-green-400/30', dot: 'bg-green-400' },
  PAUSED:    { label: 'Paused',    color: 'text-amber-400 bg-amber-400/10 border-amber-400/30', dot: 'bg-amber-400' },
  COMPLETE:  { label: 'Complete',  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', dot: 'bg-emerald-400' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-400   bg-red-400/10   border-red-400/30',   dot: 'bg-red-400' },
};

const DEP_CONFIG: Record<string, { short: string; label: string; color: string; icon: React.ReactNode; description: string }> = {
  FINISH_TO_START:  { short: 'FS', label: 'Finish → Start',  color: 'text-slate-400 bg-slate-400/10 border-slate-400/20', icon: <ArrowDownCircle className="w-2.5 h-2.5" />, description: 'B starts after A finishes' },
  START_TO_START:   { short: 'SS', label: 'Start ‖ Start',   color: 'text-cyan-400  bg-cyan-400/10  border-cyan-400/20',   icon: <GitBranch     className="w-2.5 h-2.5" />, description: 'B starts when A starts (parallel)' },
  START_TO_FINISH:  { short: 'SF', label: 'Start → Finish',  color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', icon: <Shuffle      className="w-2.5 h-2.5" />, description: 'B must finish before A starts' },
  FINISH_TO_FINISH: { short: 'FF', label: 'Finish ‖ Finish', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: <GitMerge    className="w-2.5 h-2.5" />, description: 'B finishes when A finishes' },
};

const VALID_NEXT: Record<JOStatus, JOStatus[]> = {
  SCHEDULED: ['CANCELLED'],
  READY:     ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['PAUSED', 'COMPLETE', 'CANCELLED'],
  PAUSED:    ['EXECUTING', 'CANCELLED'],
  COMPLETE:  [],
  CANCELLED: [],
};

const PAGE_SIZE = 6; // 3 columns × 2 rows

const UNIT_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  PIECE:  { color: 'text-sky-400  bg-sky-400/10  border-sky-400/20',     icon: <Package className="w-2.5 h-2.5" />, label: 'PCS'    },
  CARTON: { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: <Box     className="w-2.5 h-2.5" />, label: 'CTN'    },
  PALLET: { color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: <Boxes  className="w-2.5 h-2.5" />, label: 'PLT'  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JOStatus }) {
  const c = JO_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function DepBadge({ type }: { type: DepType }) {
  if (!type) return null;
  const d = DEP_CONFIG[type];
  if (!d) return null;
  return (
    <span
      title={`${d.label}: ${d.description}`}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border tracking-wide ${d.color}`}
    >
      {d.icon}{d.short}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Single WO card (compact)
// ─────────────────────────────────────────────────────────────

function UnitBadge({ unit }: { unit: string | undefined }) {
  if (!unit) return null;
  const cfg = UNIT_CONFIG[unit];
  if (!cfg) return <span className="text-[9px] text-muted-foreground">{unit}</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border text-[9px] font-bold tracking-wide ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function WOCard({
  wo, jobs, onTransition, onCount, onAssignOperator, users, pending,
}: {
  wo: JobOrder['workOrder'];
  jobs: JobOrder[];
  onTransition: (id: string, status: JOStatus, qty?: number) => void;
  onCount: (id: string, good: number, scrap: number, reason: string, category?: string) => void;
  onAssignOperator: (id: string, operatorId: string | null) => void;
  users: Operator[];
  pending: boolean;
}) {
  const [completingId,   setCompletingId]   = useState<string | null>(null);
  const [completeQty,    setCompleteQty]    = useState<string>('');
  const [loggingId,      setLoggingId]      = useState<string | null>(null);
  const [logGood,        setLogGood]        = useState<string>('');
  const [logScrap,       setLogScrap]       = useState<string>('');
  const [logReason,      setLogReason]      = useState<string>('');
  const [logCategory,    setLogCategory]    = useState<string>('OTHER');
  const [assigningOpId,  setAssigningOpId]  = useState<string | null>(null);

  const sorted   = [...jobs].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const done     = jobs.filter((j) => j.status === 'COMPLETE').length;
  const running  = jobs.filter((j) => j.status === 'EXECUTING').length;
  const progress = jobs.length > 0 ? Math.round((done / jobs.length) * 100) : 0;

  const openLog = (jo: JobOrder) => {
    setLoggingId(jo.id);
    setLogGood(String(jo.actualQtyGood || ''));
    setLogScrap(String(jo.actualQtyRejected || ''));
    setLogReason(jo.scrapReason || '');
    setCompletingId(null);
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="w-3.5 h-3.5 text-brand-400 shrink-0" />
            <span className="font-semibold text-sm truncate">{wo?.orderNumber ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {running > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-green-400">
                <Play className="w-2.5 h-2.5 fill-current" />{running}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{done}/{jobs.length}</span>
            <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground w-6 text-right">{progress}%</span>
          </div>
        </div>
        {wo?.sku && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{wo.sku.name}</p>
        )}
        {wo?.productionOrder && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <ChevronRight className="w-2.5 h-2.5" />{wo.productionOrder.orderNumber}
          </p>
        )}
      </div>

      {/* Job order rows */}
      <div className="divide-y divide-border/20 flex-1">
        {sorted.map((jo, idx) => {
          const next      = VALID_NEXT[jo.status] ?? [];
          const isBlocked = jo.status === 'SCHEDULED';
          const isActive  = jo.status === 'EXECUTING';
          const canLog    = ['EXECUTING', 'PAUSED'].includes(jo.status);

          return (
            <div key={jo.id}>
              {/* Main row */}
              <div
                className={`px-4 py-2.5 flex items-center gap-2 transition-colors
                  ${isActive ? 'bg-green-500/5' : ''}
                  ${isBlocked ? 'opacity-60' : ''}
                `}
              >
                {/* Sequence + dep connector */}
                <div className="flex flex-col items-center w-8 shrink-0">
                  {idx > 0 && <DepBadge type={jo.depType} />}
                  <span className="text-[10px] font-mono text-brand-400 mt-0.5">{jo.sequenceOrder}</span>
                </div>

                {/* Operation + machine + qty + operator */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{jo.operationName}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {jo.machine ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Cpu className="w-2.5 h-2.5" />{jo.machine.name}
                      </span>
                    ) : jo.workCenter ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Layers className="w-2.5 h-2.5" />{jo.workCenter.name}
                      </span>
                    ) : null}
                    {isBlocked && jo.predecessor && (
                      <span className="text-[10px] text-amber-400/70 ml-1">
                        ⏳ {jo.predecessor.operationName}
                      </span>
                    )}
                  </div>

                  {/* Qty progress */}
                  {(jo.plannedQtyOut ?? 0) > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-14 h-0.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${jo.status === 'COMPLETE' ? 'bg-emerald-500' : 'bg-brand-500'}`}
                          style={{ width: `${Math.min(100, (jo.actualQtyGood / (jo.plannedQtyOut ?? 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
                        {jo.actualQtyGood}
                        {jo.actualQtyRejected > 0 && (
                          <span className="text-red-400/70"> +{jo.actualQtyRejected}✗</span>
                        )}
                        {' / '}{jo.plannedQtyOut}
                      </span>
                      <UnitBadge unit={jo.outputUnit} />
                      {jo.joOEE != null && (
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded border tabular-nums ${
                          jo.joOEE >= 85
                            ? 'text-green-400 bg-green-400/10 border-green-400/30'
                            : jo.joOEE >= 60
                            ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
                            : 'text-red-400 bg-red-400/10 border-red-400/30'
                        }`}>
                          OEE {Math.round(jo.joOEE)}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Operator chip */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <User className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
                    {assigningOpId === jo.id ? (
                      <select
                        autoFocus
                        defaultValue={jo.operatorId ?? ''}
                        onChange={(e) => {
                          onAssignOperator(jo.id, e.target.value || null);
                          setAssigningOpId(null);
                        }}
                        onBlur={() => setAssigningOpId(null)}
                        className="text-[10px] bg-background border border-brand-400/40 rounded px-1 py-0.5 focus:outline-none max-w-[140px]"
                      >
                        <option value="">— Unassign —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    ) : jo.operator ? (
                      <button
                        onClick={() => setAssigningOpId(jo.id)}
                        className="text-[10px] text-muted-foreground hover:text-brand-400 transition-colors truncate max-w-[120px]"
                        title="Click to change operator"
                      >
                        {jo.operator.name}
                      </button>
                    ) : (
                      <button
                        onClick={() => setAssigningOpId(jo.id)}
                        className="text-[10px] text-muted-foreground/40 hover:text-brand-400 transition-colors italic"
                      >
                        assign operator
                      </button>
                    )}
                  </div>
                </div>

                {/* Status */}
                <StatusBadge status={jo.status} />

                {/* Action buttons */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Log count button */}
                  {canLog && (
                    <button
                      onClick={() => loggingId === jo.id ? setLoggingId(null) : openLog(jo)}
                      title="Log good / scrap count"
                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors
                        ${loggingId === jo.id ? 'text-brand-400 bg-brand-400/15' : 'text-muted-foreground hover:text-brand-400 hover:bg-brand-400/10'}`}
                    >
                      <BarChart2 className="w-3 h-3" />
                    </button>
                  )}
                  {next.includes('EXECUTING') && (
                    <button
                      disabled={pending}
                      onClick={() => onTransition(jo.id, 'EXECUTING')}
                      title="Start"
                      className="w-5 h-5 rounded flex items-center justify-center text-green-400 hover:bg-green-400/15 disabled:opacity-40 transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  )}
                  {next.includes('PAUSED') && (
                    <button
                      disabled={pending}
                      onClick={() => onTransition(jo.id, 'PAUSED')}
                      title="Pause"
                      className="w-5 h-5 rounded flex items-center justify-center text-amber-400 hover:bg-amber-400/15 disabled:opacity-40 transition-colors"
                    >
                      <Pause className="w-3 h-3" />
                    </button>
                  )}
                  {/* Complete: inline qty input → confirm */}
                  {next.includes('COMPLETE') && completingId === jo.id ? (
                    <>
                      <input
                        type="number"
                        autoFocus
                        min={0}
                        value={completeQty}
                        placeholder={String(Math.round(jo.plannedQtyOut ?? 0) || '')}
                        onChange={(e) => setCompleteQty(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const qty = parseFloat(completeQty) || jo.plannedQtyOut || 0;
                            onTransition(jo.id, 'COMPLETE', qty);
                            setCompletingId(null); setCompleteQty('');
                          }
                          if (e.key === 'Escape') { setCompletingId(null); setCompleteQty(''); }
                        }}
                        className="w-14 h-5 text-[10px] bg-background/60 border border-border rounded px-1 text-center focus:outline-none focus:border-brand-400"
                      />
                      <button
                        disabled={pending}
                        onClick={() => {
                          const qty = parseFloat(completeQty) || jo.plannedQtyOut || 0;
                          onTransition(jo.id, 'COMPLETE', qty);
                          setCompletingId(null); setCompleteQty('');
                        }}
                        className="w-5 h-5 rounded flex items-center justify-center text-emerald-400 hover:bg-emerald-400/15 disabled:opacity-40"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setCompletingId(null); setCompleteQty(''); }}
                        className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:bg-slate-400/15"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : next.includes('COMPLETE') ? (
                    <button
                      disabled={pending}
                      onClick={() => {
                        setCompletingId(jo.id);
                        setCompleteQty(String(Math.round(jo.plannedQtyOut ?? jo.plannedQtyIn ?? 0) || ''));
                        setLoggingId(null);
                      }}
                      title={`Complete — enter actual output qty (${jo.outputUnit ?? ''})`}
                      className="w-5 h-5 rounded flex items-center justify-center text-emerald-400 hover:bg-emerald-400/15 disabled:opacity-40 transition-colors"
                    >
                      <CheckSquare className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Inline count log form */}
              {loggingId === jo.id && (
                <div className="px-4 py-3 bg-brand-500/5 border-t border-brand-400/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] text-green-400 font-medium flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" />Good count
                      </label>
                      <input
                        type="number" min={0}
                        value={logGood}
                        onChange={(e) => setLogGood(e.target.value)}
                        className="w-full h-7 text-xs bg-background/60 border border-green-500/30 rounded px-2 focus:outline-none focus:border-green-400 text-center tabular-nums"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] text-red-400 font-medium flex items-center gap-0.5">
                        <X className="w-2.5 h-2.5" />Scrap count
                      </label>
                      <input
                        type="number" min={0}
                        value={logScrap}
                        onChange={(e) => setLogScrap(e.target.value)}
                        className="w-full h-7 text-xs bg-background/60 border border-red-500/30 rounded px-2 focus:outline-none focus:border-red-400 text-center tabular-nums"
                      />
                    </div>
                  </div>
                  {parseFloat(logScrap) > 0 && (
                    <div className="space-y-1.5">
                      <select
                        value={logCategory}
                        onChange={(e) => setLogCategory(e.target.value)}
                        className="w-full h-7 text-xs bg-background/60 border border-border rounded px-2 focus:outline-none focus:border-red-400 text-muted-foreground"
                      >
                        {['QUALITY','SETUP','DAMAGE','OVERRUN','MATERIAL','MACHINE','OPERATOR','OTHER'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Scrap reason…"
                        value={logReason}
                        onChange={(e) => setLogReason(e.target.value)}
                        className="w-full h-7 text-xs bg-background/60 border border-border rounded px-2 focus:outline-none focus:border-brand-400 placeholder:text-muted-foreground/40"
                      />
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      disabled={pending}
                      onClick={() => {
                        onCount(jo.id, parseFloat(logGood) || 0, parseFloat(logScrap) || 0, logReason, logCategory);
                        setLoggingId(null);
                      }}
                      className="flex-1 h-7 text-xs font-medium rounded bg-brand-500/20 hover:bg-brand-500/30 border border-brand-400/30 text-brand-400 flex items-center justify-center gap-1 disabled:opacity-40 transition-colors"
                    >
                      <Check className="w-3 h-3" />Save
                    </button>
                    <button
                      onClick={() => setLoggingId(null)}
                      className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground rounded border border-border transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────

function Pagination({
  page, total, onChange,
}: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;

  const pages = Array.from({ length: total }, (_, i) => i + 1);
  const visible = pages.filter((p) => p === 1 || p === total || Math.abs(p - page) <= 1);

  let prev: number | null = null;
  const items: (number | '…')[] = [];
  for (const p of visible) {
    if (prev !== null && p - prev > 1) items.push('…');
    items.push(p);
    prev = p;
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {items.map((item, i) =>
        item === '…' ? (
          <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-muted-foreground text-xs">…</span>
        ) : (
          <button
            key={item}
            onClick={() => onChange(item as number)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors
              ${page === item
                ? 'bg-brand-500 text-white'
                : 'text-muted-foreground hover:bg-muted'
              }`}
          >
            {item}
          </button>
        ),
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === total}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Dep legend
// ─────────────────────────────────────────────────────────────

function DepLegend() {
  return (
    <div className="flex items-center gap-3 flex-wrap text-[10px]">
      <span className="text-muted-foreground">Dependency types:</span>
      {Object.entries(DEP_CONFIG).map(([, d]) => (
        <span
          key={d.short}
          title={`${d.label}: ${d.description}`}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border font-bold tracking-wide cursor-help ${d.color}`}
        >
          {d.icon}{d.short}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────

export function JobOrdersView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search,       setSearch]  = useState('');
  const [statusFilter, setStatus]  = useState<string>('ALL');
  const [page,         setPage]    = useState(1);

  // Sorting state — declared before useQuery so sortCol/sortDir are in queryKey
  const { sortedData: _sortedForKey, sortCol, sortDir, handleSort } = useSortedData(
    [] as JobOrder[],
    'createdAt',
    'desc',
  );

  // Reset to page 1 whenever sort, search, or status filter changes
  useEffect(() => { setPage(1); }, [sortCol, sortDir]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['job-orders', statusFilter, sortCol, sortDir],
    queryFn: () => api.get('/production/job-orders', {
      params: {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        sortBy: sortCol,
        sortOrder: sortDir,
      },
    }),
    refetchInterval: 15_000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users', { params: { limit: 200 } }),
    staleTime: 300_000,
  });
  const users: Operator[] = (((usersData as any)?.data) ?? []).map((u: any) => ({ id: u.id, name: u.name, nameAr: u.nameAr }));

  const jobOrdersRaw: JobOrder[] = (rawData as any) ?? [];
  const { sortedData: jobOrders } = useSortedData(jobOrdersRaw, 'createdAt', 'desc');

  const transitionMut = useMutation({
    mutationFn: ({ id, status, qty }: { id: string; status: JOStatus; qty?: number }) =>
      api.patch(`/production/job-orders/${id}/status`, {
        status,
        ...(qty !== undefined && { actualQtyGood: qty }),
      }),
    onSuccess: (_res, { status }) => {
      qc.invalidateQueries({ queryKey: ['job-orders'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      toast({ title: `Job order → ${JO_STATUS[status]?.label ?? status}` });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
    onError: (e: any) => toast({
      variant: 'destructive',
      title: 'Failed to assign operator',
      description: e?.response?.data?.message,
    }),
  });

  const isPending = transitionMut.isPending || countMut.isPending || operatorMut.isPending;

  // Filter
  const filtered = jobOrders.filter((jo) => {
    const q = search.toLowerCase();
    return !q
      || jo.operationName.toLowerCase().includes(q)
      || (jo.workOrder?.orderNumber ?? '').toLowerCase().includes(q)
      || (jo.workOrder?.sku?.name ?? '').toLowerCase().includes(q)
      || (jo.machine?.name ?? '').toLowerCase().includes(q);
  });

  // Group by Work Order
  const groups = filtered.reduce<Record<string, { wo: JobOrder['workOrder']; jobs: JobOrder[] }>>(
    (acc, jo) => {
      const key = jo.workOrder?.id ?? 'unknown';
      if (!acc[key]) acc[key] = { wo: jo.workOrder, jobs: [] };
      acc[key].jobs.push(jo);
      return acc;
    },
    {},
  );

  const entries    = Object.entries(groups);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paginated  = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPI
  const executing = jobOrders.filter((j) => j.status === 'EXECUTING').length;
  const ready     = jobOrders.filter((j) => j.status === 'READY').length;
  const complete  = jobOrders.filter((j) => j.status === 'COMPLETE').length;

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-400" />
            Dispatch List
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            ISA-95 Job Orders — shop floor execution tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/shop-floor', '_blank')}
            className="text-brand-400 border-brand-400/30 hover:bg-brand-400/10"
          >
            <Monitor className="w-3.5 h-3.5 mr-1.5" />Shop Floor
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="text-red-400 border-red-400/30 hover:bg-red-400/10"
          >
            <a href="/production/scrap-log">
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Scrap Log
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['job-orders'] })}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Executing', value: executing, color: 'text-green-400',   icon: <Play className="w-4 h-4 fill-current" /> },
          { label: 'Ready',     value: ready,     color: 'text-blue-400',    icon: <Clock className="w-4 h-4" /> },
          { label: 'Completed', value: complete,  color: 'text-emerald-400', icon: <CheckSquare className="w-4 h-4" /> },
        ].map((k) => (
          <div key={k.label} className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className={`${k.color} opacity-80`}>{k.icon}</div>
            <div>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search operation, machine, WO…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.entries(JO_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DepLegend />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer h-64 rounded-2xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No job orders found.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Generate a work order from a Production Order to create the dispatch list.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map(([woId, { wo, jobs }]) => (
              <WOCard
                key={woId}
                wo={wo}
                jobs={jobs}
                users={users}
                onTransition={(id, status, qty) => transitionMut.mutate({ id, status, qty })}
                onCount={(id, good, scrap, reason, category) => countMut.mutate({ id, good, scrap, reason, category })}
                onAssignOperator={(id, operatorId) => operatorMut.mutate({ id, operatorId })}
                pending={isPending}
              />
            ))}
          </div>

          {/* Summary + pagination */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{paginated.length}</span> of{' '}
              <span className="font-medium text-foreground">{entries.length}</span> work orders
              {' '}·{' '}
              <span className="font-medium text-foreground">{filtered.length}</span> job orders total
            </p>
            <TablePagination
              page={page}
              total={entries.length}
              limit={PAGE_SIZE}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}
