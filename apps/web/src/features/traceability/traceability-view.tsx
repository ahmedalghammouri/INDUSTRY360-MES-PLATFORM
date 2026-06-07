'use client';

import React, { useState } from 'react';
import {
  Wrench, Factory, Package, Layers3, Cpu, Settings, Tag,
  Activity, Calendar, ChevronRight, Search, Filter, ChevronDown,
  ArrowRight, User, FileText,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/services/api.client';
import { cn, timeAgo, formatDateTime } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

interface TraceEvent {
  id: string;
  entityType: string;
  entityId: string;
  entityCode: string | null;
  eventType: string;
  fromValue: string | null;
  toValue: string | null;
  quantity: number | null;
  eventData: Record<string, unknown> | null;
  performedAt: string;
  notes: string | null;
  relatedType: string | null;
  relatedId: string | null;
  performedBy: { name: string } | null;
  factory: { name: string; code: string } | null;
}

interface TraceResponse {
  data: TraceEvent[];
  total: number;
  page: number;
}

interface TraceStats {
  total: number;
  today: number;
  thisWeek: number;
  [key: string]: unknown;
}

// ── Constants ────────────────────────────────────────────────

type EntityType = 'MAINT_WO' | 'PROD_WO' | 'BATCH' | 'SPARE_PART' | 'RAW_MATERIAL' | 'MACHINE' | 'PRODUCT';

const ENTITY_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  dot: string;
  badge: string;
  iconCls: string;
}> = {
  MAINT_WO:     { label: 'Maintenance WO',  icon: Wrench,  dot: 'bg-amber-500',  badge: 'text-amber-400 border-amber-400/30 bg-amber-400/10',   iconCls: 'text-amber-400'  },
  PROD_WO:      { label: 'Production WO',   icon: Factory, dot: 'bg-blue-500',   badge: 'text-blue-400 border-blue-400/30 bg-blue-400/10',       iconCls: 'text-blue-400'   },
  BATCH:        { label: 'Batch',           icon: Layers3, dot: 'bg-green-500',  badge: 'text-green-400 border-green-400/30 bg-green-400/10',    iconCls: 'text-green-400'  },
  SPARE_PART:   { label: 'Spare Part',      icon: Package, dot: 'bg-purple-500', badge: 'text-purple-400 border-purple-400/30 bg-purple-400/10', iconCls: 'text-purple-400' },
  RAW_MATERIAL: { label: 'Raw Material',    icon: Layers3, dot: 'bg-cyan-500',   badge: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',       iconCls: 'text-cyan-400'   },
  MACHINE:      { label: 'Machine',         icon: Settings,dot: 'bg-orange-500', badge: 'text-orange-400 border-orange-400/30 bg-orange-400/10', iconCls: 'text-orange-400' },
  PRODUCT:      { label: 'Product',         icon: Tag,     dot: 'bg-pink-500',   badge: 'text-pink-400 border-pink-400/30 bg-pink-400/10',       iconCls: 'text-pink-400'   },
};

const FALLBACK_ENTITY = {
  label: 'Entity',
  icon: Cpu,
  dot: 'bg-muted',
  badge: 'text-muted-foreground border-border',
  iconCls: 'text-muted-foreground',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  CREATED:             'Created',
  STATUS_CHANGED:      'Status Changed',
  PARTS_REQUESTED:     'Parts Requested',
  PARTS_ISSUED:        'Parts Issued',
  PARTS_CANCELLED:     'Parts Cancelled',
  STOCK_ADJUSTED:      'Stock Adjusted',
  STOCK_RECEIVED:      'Stock Received',
  COMPLETED:           'Completed',
  CANCELLED:           'Cancelled',
  STARTED:             'Started',
  UPDATED:             'Updated',
  DELETED:             'Deleted',
  ASSIGNED:            'Assigned',
  INSPECTION_PASSED:   'Inspection Passed',
  INSPECTION_FAILED:   'Inspection Failed',
  BATCH_RELEASED:      'Batch Released',
  BATCH_REJECTED:      'Batch Rejected',
  QUALITY_HOLD:        'Quality Hold',
};

const ENTITY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '__all__', label: 'All Entity Types' },
  ...Object.entries(ENTITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
];

// ── Helpers ──────────────────────────────────────────────────

function humanizeEventType(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Component ────────────────────────────────────────────────

export function TraceabilityView() {
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [eventSearch, setEventSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // ── Queries ─────────────────────────────────────────────────

  const { data: statsData } = useQuery({
    queryKey: ['traceability', 'stats'],
    queryFn: () => api.get<TraceStats>('/traceability/stats'),
    staleTime: 60_000,
  });

  const stats = statsData as unknown as TraceStats | undefined;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['traceability', 'events', { entityTypeFilter, eventSearch, dateFrom, dateTo, page }],
    queryFn: () =>
      api.get<TraceResponse>('/traceability', {
        params: {
          entityType: entityTypeFilter || undefined,
          eventType: eventSearch || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          limit: 30,
        },
      }),
    staleTime: 15_000,
  });

  const response = data as unknown as TraceResponse | undefined;
  const events: TraceEvent[] = response?.data ?? [];
  const total: number = response?.total ?? 0;
  const hasMore = events.length === 30 && page * 30 < total;

  // ── Reset page when filters change ──────────────────────────

  const applyFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Traceability & Event Log</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Full audit trail of every operation across production, maintenance, inventory, and quality
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Total Events',
              value: stats?.total,
              icon: Activity,
              color: 'text-brand-400',
              sub: 'all time',
            },
            {
              label: 'Events Today',
              value: stats?.today,
              icon: Calendar,
              color: 'text-green-400',
              sub: 'since midnight',
            },
            {
              label: 'This Week',
              value: stats?.thisWeek,
              icon: ChevronRight,
              color: 'text-blue-400',
              sub: 'last 7 days',
            },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="glass-card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon size={14} className={color} />
              </div>
              <p className={cn('text-2xl font-bold', color)}>
                {value !== undefined ? value.toLocaleString() : <span className="shimmer inline-block h-6 w-16 rounded" />}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="glass-card p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-muted-foreground shrink-0" />

            {/* Entity type */}
            <Select
              value={entityTypeFilter || '__all__'}
              onValueChange={v => applyFilter(() => setEntityTypeFilter(v === '__all__' ? '' : v))}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Event type search */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Event type…"
                value={eventSearch}
                onChange={e => applyFilter(() => setEventSearch(e.target.value))}
                className="h-8 pl-7 w-40 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">From</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => applyFilter(() => setDateFrom(e.target.value))}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">To</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => applyFilter(() => setDateTo(e.target.value))}
                className="h-8 w-36 text-xs"
              />
            </div>

            {(entityTypeFilter || eventSearch || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setEntityTypeFilter('');
                  setEventSearch('');
                  setDateFrom('');
                  setDateTo('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card p-4 flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted/50 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="shimmer h-3.5 rounded w-32" />
                  <div className="shimmer h-3 rounded w-64" />
                  <div className="shimmer h-3 rounded w-48" />
                </div>
              </div>
            ))
          ) : events.length === 0 ? (
            <div className="glass-card p-12 text-center text-muted-foreground">
              <Activity size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No events found</p>
              <p className="text-xs mt-1">
                {entityTypeFilter || eventSearch || dateFrom || dateTo
                  ? 'Try adjusting or clearing your filters'
                  : 'Events will appear here as operations are performed'
                }
              </p>
            </div>
          ) : (
            <>
              {events.map(event => {
                const cfg = ENTITY_CONFIG[event.entityType] ?? FALLBACK_ENTITY;
                const EntityIcon = cfg.icon;
                const isStatusChange = event.eventType === 'STATUS_CHANGED' || (event.fromValue && event.toValue);

                return (
                  <div
                    key={event.id}
                    className="glass-card p-4 flex gap-3 hover:bg-muted/10 transition-colors"
                  >
                    {/* Colored circle icon */}
                    <div className={cn(
                      'w-9 h-9 rounded-full shrink-0 flex items-center justify-center',
                      cfg.dot.replace('bg-', 'bg-') + '/15',
                    )}>
                      <EntityIcon size={16} className={cfg.iconCls} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Top row: badges + timestamp */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                          cfg.badge,
                        )}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          {humanizeEventType(event.eventType)}
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          {timeAgo(event.performedAt)}
                        </span>
                      </div>

                      {/* Entity code + status change */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {event.entityCode && (
                          <span className="font-mono text-xs font-semibold">{event.entityCode}</span>
                        )}
                        {isStatusChange && event.fromValue && event.toValue && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="text-foreground/60">{event.fromValue}</span>
                            <ArrowRight size={10} className="text-muted-foreground/60" />
                            <span className="text-foreground font-medium">{event.toValue}</span>
                          </span>
                        )}
                        {!isStatusChange && event.toValue && !event.fromValue && (
                          <span className="text-xs text-muted-foreground">
                            → <span className="text-foreground">{event.toValue}</span>
                          </span>
                        )}
                        {event.quantity !== null && (
                          <span className="text-xs text-muted-foreground">
                            Qty: <span className="font-semibold text-foreground">{event.quantity}</span>
                          </span>
                        )}
                      </div>

                      {/* Meta: performer, factory, timestamp */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {event.performedBy && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <User size={9} />
                            {event.performedBy.name}
                          </span>
                        )}
                        {event.factory && (
                          <span className="text-[10px] text-muted-foreground">
                            {event.factory.name}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatDateTime(event.performedAt)}
                        </span>
                      </div>

                      {/* Notes */}
                      {event.notes && (
                        <div className="flex items-start gap-1 text-[10px] text-muted-foreground italic">
                          <FileText size={9} className="mt-0.5 shrink-0" />
                          {event.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setPage(p => p + 1)}
                    disabled={isFetching}
                  >
                    <ChevronDown size={12} />
                    {isFetching ? 'Loading…' : 'Load More'}
                  </Button>
                </div>
              )}

              {!hasMore && events.length > 0 && (
                <p className="text-center text-[11px] text-muted-foreground/50 py-2">
                  Showing all {total.toLocaleString()} events
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
