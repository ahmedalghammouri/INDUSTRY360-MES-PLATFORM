'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CalendarDays, ChevronLeft, ChevronRight,
  Clock, Package, AlertTriangle, CheckCircle2, Circle,
  RefreshCw, PauseCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';

type WOStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';

interface WorkOrder {
  id: string;
  orderNumber: string;
  status: WOStatus;
  priority: string;
  plannedQty: number;
  producedQty: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  sku: { name: string; code: string } | null;
  machine: { name: string } | null;
}

const STATUS_CONFIG: Record<WOStatus, { label: string; color: string; icon: any }> = {
  PLANNED:     { label: 'Planned',    color: 'text-slate-400',  icon: Circle        },
  IN_PROGRESS: { label: 'Running',    color: 'text-brand-400',  icon: RefreshCw     },
  COMPLETED:   { label: 'Completed',  color: 'text-green-400',  icon: CheckCircle2  },
  ON_HOLD:     { label: 'On Hold',    color: 'text-amber-400',  icon: PauseCircle   },
  CANCELLED:   { label: 'Cancelled',  color: 'text-red-400',    icon: AlertTriangle },
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getProgress(wo: WorkOrder): number {
  if (wo.status === 'COMPLETED') return 100;
  if (wo.status === 'PLANNED' || wo.status === 'CANCELLED') return 0;
  if (wo.plannedQty > 0 && wo.producedQty > 0) {
    return Math.min(100, Math.round((wo.producedQty / wo.plannedQty) * 100));
  }
  return wo.status === 'IN_PROGRESS' ? 5 : 0;
}

export function ProductionSchedulingView() {
  const [statusFilter, setStatusFilter] = useState<WOStatus | 'all'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['production', 'work-orders', 'schedule'],
    queryFn: () => api.get('/production/work-orders', { params: { limit: 100 } }),
    staleTime: 30_000,
  });

  const workOrders: WorkOrder[] = (data as any)?.data ?? (data as any) ?? [];

  const filtered = statusFilter === 'all'
    ? workOrders
    : workOrders.filter(wo => wo.status === statusFilter);

  const summary = [
    { label: 'Planned',     value: workOrders.filter(w => w.status === 'PLANNED').length,     color: 'text-slate-300', sub: 'scheduled'   },
    { label: 'Running',     value: workOrders.filter(w => w.status === 'IN_PROGRESS').length,  color: 'text-brand-400', sub: 'in progress'  },
    { label: 'Completed',   value: workOrders.filter(w => w.status === 'COMPLETED').length,    color: 'text-green-400', sub: 'done'         },
    { label: 'On Hold',     value: workOrders.filter(w => w.status === 'ON_HOLD').length,      color: 'text-amber-400', sub: 'paused'       },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Scheduling</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Plan, track, and manage work order scheduling across all lines
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {summary.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl p-4"
          >
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Week navigator (visual only) */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Work Orders Overview</span>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs">Today</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] as WOStatus[]).map(s => {
            const cfg = STATUS_CONFIG[s];
            const count = workOrders.filter(w => w.status === s).length;
            return (
              <div key={s} className="flex items-center gap-1.5 text-xs">
                <div className={cn('w-2 h-2 rounded-full', {
                  'bg-slate-400': s === 'PLANNED',
                  'bg-brand-400': s === 'IN_PROGRESS',
                  'bg-green-400': s === 'COMPLETED',
                  'bg-amber-400': s === 'ON_HOLD',
                  'bg-red-400': s === 'CANCELLED',
                })} />
                <span className="text-muted-foreground">{cfg.label}</span>
                <span className="font-bold">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] as const).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All Orders' : STATUS_CONFIG[s].label}
          </Button>
        ))}
      </div>

      {/* Schedule table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Work Order', 'Product', 'Machine / Line', 'Planned Start', 'Planned End', 'Qty', 'Progress', 'Status'].map((h) => (
                <th key={h} className="text-left p-4 text-muted-foreground font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/30">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="p-4"><div className="shimmer h-4 rounded w-20" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground">No work orders found</td>
              </tr>
            ) : (
              filtered.map((wo, i) => {
                const cfg = STATUS_CONFIG[wo.status];
                const StatusIcon = cfg.icon;
                const progress = getProgress(wo);
                return (
                  <motion.tr
                    key={wo.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/30 hover:bg-white/5 cursor-pointer"
                  >
                    <td className="p-4 font-mono text-xs text-brand-400">{wo.orderNumber}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <div className="truncate max-w-[160px] text-xs">{wo.sku?.name ?? '—'}</div>
                          {wo.sku?.code && <div className="text-[10px] text-muted-foreground">{wo.sku.code}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-xs">{wo.machine?.name ?? '—'}</Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDate(wo.plannedStart)} {formatTime(wo.plannedStart)}
                      </div>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      {formatDate(wo.plannedEnd)} {formatTime(wo.plannedEnd)}
                    </td>
                    <td className="p-4 text-xs">{wo.plannedQty.toLocaleString()}</td>
                    <td className="p-4 w-36">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', {
                              'bg-green-500': wo.status === 'COMPLETED',
                              'bg-brand-500': wo.status === 'IN_PROGRESS',
                              'bg-amber-500': wo.status === 'ON_HOLD',
                              'bg-slate-500': wo.status === 'PLANNED' || wo.status === 'CANCELLED',
                            })}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 shrink-0">{progress}%</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className={cn('flex items-center gap-1.5 text-xs', cfg.color)}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
