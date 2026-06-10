'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarRange, Layers, Boxes } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GanttZoom } from '@/components/charts/gantt-chart';
import { SvarGantt } from '@/components/charts/svar-gantt';
import { useUnifiedSchedule } from './use-schedule';

const WINDOW_DAYS: Record<GanttZoom, number> = { day: 4, week: 14, month: 35 };
const iso = (d: Date) => d.toISOString().slice(0, 10);

interface ScheduleViewProps {
  title?: string;
  subtitle?: string;
  defaultTypes?: string[];   // preset filter for domain views
  lockTypes?: boolean;       // hide the type chips (domain-locked view)
}

export function ScheduleView({
  title = 'General Schedule',
  subtitle = 'Unified Gantt across production, work orders, maintenance, planned downtime and shifts.',
  defaultTypes,
  lockTypes = false,
}: ScheduleViewProps) {
  const [zoom, setZoom] = useState<GanttZoom>('week');
  const [groupBy, setGroupBy] = useState<'type' | 'resource'>('type');
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  });
  const [activeTypes, setActiveTypes] = useState<Set<string> | null>(
    defaultTypes ? new Set(defaultTypes) : null,
  );

  const windowDays = WINDOW_DAYS[zoom];
  const dateFrom = iso(anchor);
  const dateTo = iso(new Date(anchor.getTime() + windowDays * 86_400_000));

  const { data, isLoading } = useUnifiedSchedule({ dateFrom, dateTo });

  const typeMeta = data?.typeMeta ?? [];
  const counts = data?.counts ?? {};

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    if (!activeTypes) return items;
    return items.filter((i) => activeTypes.has(i.type));
  }, [data, activeTypes]);

  const typeLabels = useMemo(
    () => Object.fromEntries(typeMeta.map((t) => [t.type, t.label])),
    [typeMeta],
  );

  const toggleType = (t: string) => {
    setActiveTypes((prev) => {
      const base = prev ?? new Set(typeMeta.map((m) => m.type));
      const next = new Set(base);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const shift = (dir: -1 | 1) =>
    setAnchor((a) => new Date(a.getTime() + dir * windowDays * 86_400_000));
  const today = () => {
    const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - 1);
    setAnchor(d);
  };

  const rangeLabel = `${new Date(dateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })} – ${new Date(dateTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* group by */}
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setGroupBy('type')}
              className={cn('px-2.5 py-1.5 text-xs flex items-center gap-1.5', groupBy === 'type' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50')}>
              <Layers size={13} /> Type
            </button>
            <button onClick={() => setGroupBy('resource')}
              className={cn('px-2.5 py-1.5 text-xs flex items-center gap-1.5 border-l border-border', groupBy === 'resource' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50')}>
              <Boxes size={13} /> Resource
            </button>
          </div>
          {/* zoom */}
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {(['day', 'week', 'month'] as GanttZoom[]).map((z) => (
              <button key={z} onClick={() => setZoom(z)}
                className={cn('px-2.5 py-1.5 text-xs capitalize', z !== 'day' && 'border-l border-border',
                  zoom === z ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50')}>
                {z}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* type filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {!lockTypes && typeMeta.map((t) => {
            const on = !activeTypes || activeTypes.has(t.type);
            return (
              <button key={t.type} onClick={() => toggleType(t.type)}
                className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors',
                  on ? 'border-transparent' : 'border-border opacity-50')}
                style={on ? { background: `${t.color}22`, color: t.color } : undefined}>
                <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                {t.label}
                <span className="opacity-70">{counts[t.type] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* date nav */}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8" onClick={today}>
            <CalendarRange size={14} className="mr-1.5" /> Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shift(-1)}><ChevronLeft size={16} /></Button>
          <span className="text-xs font-medium text-muted-foreground min-w-[180px] text-center tabular-nums">{rangeLabel}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shift(1)}><ChevronRight size={16} /></Button>
        </div>
      </div>

      {/* Gantt */}
      {isLoading ? (
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-7 rounded" />)}
        </div>
      ) : (
        <SvarGantt
          items={filteredItems}
          rangeFrom={dateFrom}
          rangeTo={dateTo}
          groupBy={groupBy}
          zoom={zoom}
          typeLabels={typeLabels}
        />
      )}
    </div>
  );
}
