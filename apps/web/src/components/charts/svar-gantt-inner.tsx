'use client';

/**
 * Professional Gantt powered by SVAR React Gantt (@svar-ui/react-gantt).
 * Transforms the unified schedule (GanttItem[]) into SVAR tasks grouped under
 * summary rows, with Day/Week/Month scales, a "today" marker, dark/light theme,
 * drag/resize editing and per-category coloured bars.
 *
 * Loaded via next/dynamic (ssr:false) — SVAR touches the DOM at module load.
 */

import React, { useMemo } from 'react';
import { useTheme } from 'next-themes';
import { Gantt, Willow, WillowDark } from '@svar-ui/react-gantt';
import type { ITask } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/style.css';

import type { GanttItem, GanttZoom } from './gantt-chart';

export interface SvarGanttProps {
  items: GanttItem[];
  rangeFrom: string | Date;
  rangeTo: string | Date;
  groupBy?: 'type' | 'resource';
  zoom?: GanttZoom;
  typeLabels?: Record<string, string>;
  onItemClick?: (item: GanttItem) => void;
  /** Fired after a bar is dragged/resized — wire to a backend reschedule where supported. */
  onItemMove?: (item: GanttItem, start: Date, end: Date) => void;
  height?: number | string;
}

type ScaleCfg = { unit: 'hour' | 'day' | 'week' | 'month' | 'year'; step: number; format: string };

const SCALES: Record<GanttZoom, ScaleCfg[]> = {
  day: [
    { unit: 'day', step: 1, format: 'MMM d' },
    { unit: 'hour', step: 4, format: 'HH:mm' },
  ],
  week: [
    { unit: 'month', step: 1, format: 'MMMM yyyy' },
    { unit: 'day', step: 1, format: 'd' },
  ],
  month: [
    { unit: 'month', step: 1, format: 'MMM yyyy' },
    { unit: 'week', step: 1, format: 'MMM d' },
  ],
};
const CELL_W: Record<GanttZoom, number> = { day: 48, week: 40, month: 32 };

const DAY = 86_400_000;

/** Build SVAR tasks: one summary row per group + a child task per schedule item. */
function buildTasks(
  items: GanttItem[],
  groupBy: 'type' | 'resource',
  typeLabels: Record<string, string>,
): ITask[] {
  const order: string[] = [];
  const groupText = new Map<string, string>();
  for (const it of items) {
    const key = groupBy === 'resource' ? it.resourceId : it.type;
    if (!groupText.has(key)) {
      order.push(key);
      groupText.set(key, groupBy === 'resource' ? it.resourceName : (typeLabels[it.type] ?? it.type));
    }
  }

  const tasks: ITask[] = [];
  for (const key of order) {
    tasks.push({ id: `grp:${key}`, text: groupText.get(key) ?? key, type: 'summary', open: true });
  }
  for (const it of items) {
    const key = groupBy === 'resource' ? it.resourceId : it.type;
    const start = new Date(it.start);
    let end = new Date(it.end);
    if (+end <= +start) end = new Date(+start + DAY); // guard zero/negative spans
    tasks.push({
      id: it.id,
      text: it.title,
      start,
      end,
      parent: `grp:${key}`,
      progress: Math.round(it.progress ?? 0),
      type: 'task',
      _color: it.color,
      _item: it,
    } as ITask);
  }
  return tasks;
}

/** Coloured bar content — gives each category its own colour regardless of theme. */
const TaskBar: React.FC<{ data: ITask }> = ({ data }) => {
  if (data.type === 'summary') {
    return (
      <div className="flex h-full items-center px-2 text-[11px] font-semibold text-foreground/70">
        {data.text}
      </div>
    );
  }
  const color = (data as ITask & { _color?: string })._color ?? '#6366f1';
  return (
    <div
      className="flex h-full w-full items-center gap-1.5 overflow-hidden rounded-[4px] px-2"
      style={{ background: color, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)' }}
    >
      <span className="truncate text-[11px] font-medium text-white">{data.text}</span>
    </div>
  );
};

export default function SvarGanttInner({
  items,
  rangeFrom,
  rangeTo,
  groupBy = 'type',
  zoom = 'week',
  typeLabels = {},
  onItemClick,
  onItemMove,
  height = 620,
}: SvarGanttProps) {
  const { resolvedTheme } = useTheme();
  const Theme = resolvedTheme === 'light' ? Willow : WillowDark;

  const tasks = useMemo(() => buildTasks(items, groupBy, typeLabels), [items, groupBy, typeLabels]);

  // Bound the timeline to the window, extended to cover any spilling tasks.
  const { start, end } = useMemo(() => {
    let s = +new Date(rangeFrom);
    let e = +new Date(rangeTo);
    for (const it of items) {
      s = Math.min(s, +new Date(it.start));
      e = Math.max(e, +new Date(it.end));
    }
    return { start: new Date(s - DAY), end: new Date(e + DAY) };
  }, [items, rangeFrom, rangeTo]);

  const columns = useMemo(
    () => [{ id: 'text', header: groupBy === 'resource' ? 'Resource' : 'Category', flexgrow: 2, width: 240 }],
    [groupBy],
  );

  const markers = useMemo(
    () => [{ start: new Date(), text: 'Today', css: 'wx-marker-today' }],
    [],
  );

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const handleSelect = (ev: { id: string | number }) => {
    const item = byId.get(String(ev.id));
    if (item) onItemClick?.(item);
  };

  const handleUpdate = (ev: { id: string | number; task?: Partial<ITask> }) => {
    const item = byId.get(String(ev.id));
    if (item && ev.task?.start && ev.task?.end) {
      onItemMove?.(item, new Date(ev.task.start), new Date(ev.task.end));
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
        No scheduled items in this window.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card" style={{ height }}>
      <Theme>
        <Gantt
          tasks={tasks}
          links={[]}
          scales={SCALES[zoom]}
          columns={columns}
          cellWidth={CELL_W[zoom]}
          cellHeight={36}
          scaleHeight={36}
          start={start}
          end={end}
          markers={markers}
          taskTemplate={TaskBar}
          cellBorders="full"
          onSelectTask={handleSelect}
          onUpdateTask={handleUpdate}
        />
      </Theme>
    </div>
  );
}
