'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight,
  Clock, Package, AlertTriangle, CheckCircle2, Circle,
  Filter, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Status = 'scheduled' | 'running' | 'completed' | 'delayed';

interface ScheduleItem {
  id: string;
  orderNumber: string;
  product: string;
  line: string;
  start: string;
  end: string;
  qty: number;
  progress: number;
  status: Status;
  shift: string;
}

const SCHEDULE: ScheduleItem[] = [
  { id: '1', orderNumber: 'WO-2026-0481', product: 'Valve Assembly A1',   line: 'Line A', start: '06:00', end: '10:00', qty: 480,  progress: 100, status: 'completed', shift: 'Morning'   },
  { id: '2', orderNumber: 'WO-2026-0482', product: 'Pump Housing B3',     line: 'Line B', start: '06:00', end: '14:00', qty: 720,  progress: 64,  status: 'running',   shift: 'Morning'   },
  { id: '3', orderNumber: 'WO-2026-0483', product: 'Gear Set C2',         line: 'Line C', start: '08:00', end: '12:00', qty: 360,  progress: 100, status: 'completed', shift: 'Morning'   },
  { id: '4', orderNumber: 'WO-2026-0484', product: 'Motor Bracket D1',    line: 'Line D', start: '10:00', end: '16:00', qty: 540,  progress: 30,  status: 'running',   shift: 'Afternoon' },
  { id: '5', orderNumber: 'WO-2026-0485', product: 'Coupling Flange A3',  line: 'Line A', start: '11:00', end: '15:00', qty: 320,  progress: 0,   status: 'scheduled', shift: 'Afternoon' },
  { id: '6', orderNumber: 'WO-2026-0486', product: 'Bearing Housing E2',  line: 'Line E', start: '06:00', end: '10:00', qty: 280,  progress: 100, status: 'delayed',   shift: 'Morning'   },
  { id: '7', orderNumber: 'WO-2026-0487', product: 'Shaft Assembly B1',   line: 'Line B', start: '15:00', end: '22:00', qty: 600,  progress: 0,   status: 'scheduled', shift: 'Afternoon' },
  { id: '8', orderNumber: 'WO-2026-0488', product: 'Impeller Set C4',     line: 'Line C', start: '14:00', end: '22:00', qty: 480,  progress: 0,   status: 'scheduled', shift: 'Afternoon' },
];

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  completed: { label: 'Completed',  color: 'text-green-400',  icon: CheckCircle2  },
  running:   { label: 'Running',    color: 'text-brand-400',  icon: RefreshCw     },
  scheduled: { label: 'Scheduled',  color: 'text-slate-400',  icon: Circle        },
  delayed:   { label: 'Delayed',    color: 'text-red-400',    icon: AlertTriangle },
};

const DAYS = ['Mon 12', 'Tue 13', 'Wed 14', 'Thu 15', 'Fri 16', 'Sat 17', 'Sun 18'];
const LINES = ['Line A', 'Line B', 'Line C', 'Line D', 'Line E'];

const SUMMARY = [
  { label: 'Scheduled Today', value: '8',    sub: 'work orders',    color: 'text-slate-300' },
  { label: 'Running',         value: '2',    sub: 'in progress',    color: 'text-brand-400' },
  { label: 'Completed',       value: '3',    sub: 'on time',        color: 'text-green-400' },
  { label: 'Delayed',         value: '1',    sub: 'need attention',  color: 'text-red-400'   },
];

export function ProductionSchedulingView() {
  const [selectedDay, setSelectedDay] = useState(4); // Fri 16 = today
  const [filter, setFilter] = useState<Status | 'all'>('all');

  const filtered = SCHEDULE.filter((s) => filter === 'all' || s.status === filter);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Scheduling</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Plan, track, and manage work order scheduling across all lines
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-1" />Filter</Button>
          <Button size="sm"><Plus className="w-4 h-4 mr-1" />Schedule Order</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {SUMMARY.map((s, i) => (
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

      {/* Week navigator */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Week of May 12 – 18, 2026</span>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs">Today</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((day, i) => (
            <button
              key={day}
              onClick={() => setSelectedDay(i)}
              className={`rounded-lg p-2 text-center transition-colors ${
                i === selectedDay
                  ? 'bg-brand-600 text-white'
                  : 'hover:bg-white/5 text-muted-foreground'
              }`}
            >
              <div className="text-[10px] uppercase">{day.split(' ')[0]}</div>
              <div className="text-lg font-bold">{day.split(' ')[1]}</div>
              <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${
                i === 4 ? 'bg-brand-400' : i < 4 ? 'bg-green-400' : 'bg-transparent'
              }`} />
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'running', 'scheduled', 'completed', 'delayed'] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(s)}
            className="capitalize"
          >
            {s === 'all' ? 'All Orders' : s}
          </Button>
        ))}
      </div>

      {/* Schedule table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Work Order', 'Product', 'Line', 'Shift', 'Time Window', 'Qty', 'Progress', 'Status'].map((h) => (
                <th key={h} className="text-left p-4 text-muted-foreground font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, i) => {
              const cfg = STATUS_CONFIG[item.status];
              const StatusIcon = cfg.icon;
              return (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/30 hover:bg-white/5 cursor-pointer"
                >
                  <td className="p-4 font-mono text-xs text-brand-400">{item.orderNumber}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[160px]">{item.product}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className="text-xs">{item.line}</Badge>
                  </td>
                  <td className="p-4 text-muted-foreground text-xs">{item.shift}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {item.start} – {item.end}
                    </div>
                  </td>
                  <td className="p-4">{item.qty.toLocaleString()}</td>
                  <td className="p-4 w-36">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.status === 'delayed' ? 'bg-red-500' :
                            item.status === 'completed' ? 'bg-green-500' : 'bg-brand-500'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 shrink-0">{item.progress}%</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className={`flex items-center gap-1.5 text-xs ${cfg.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
