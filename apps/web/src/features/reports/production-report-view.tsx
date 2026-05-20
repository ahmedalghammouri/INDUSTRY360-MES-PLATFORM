'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Download, Calendar, Filter,
  Activity, BarChart3, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const OEE_TREND = [
  { date: 'May 10', oee: 81.2, availability: 86.4, performance: 93.1, quality: 98.8 },
  { date: 'May 11', oee: 83.5, availability: 88.1, performance: 94.2, quality: 99.1 },
  { date: 'May 12', oee: 79.8, availability: 85.0, performance: 92.5, quality: 98.6 },
  { date: 'May 13', oee: 85.1, availability: 89.3, performance: 95.0, quality: 99.2 },
  { date: 'May 14', oee: 82.7, availability: 87.2, performance: 93.8, quality: 98.9 },
  { date: 'May 15', oee: 84.3, availability: 88.6, performance: 94.5, quality: 99.3 },
  { date: 'May 16', oee: 86.0, availability: 90.1, performance: 95.2, quality: 99.5 },
];

const OUTPUT_BY_LINE = [
  { line: 'Line A', actual: 1240, target: 1400, efficiency: 88.6 },
  { line: 'Line B', actual: 980,  target: 1200, efficiency: 81.7 },
  { line: 'Line C', actual: 1380, target: 1400, efficiency: 98.6 },
  { line: 'Line D', actual: 820,  target: 1000, efficiency: 82.0 },
  { line: 'Line E', actual: 1100, target: 1200, efficiency: 91.7 },
];

const SHIFT_SUMMARY = [
  { shift: 'Morning',   output: 1820, downtime: 22, defects: 8,  oee: 87.2 },
  { shift: 'Afternoon', output: 1640, downtime: 38, defects: 14, oee: 81.4 },
  { shift: 'Night',     output: 1360, downtime: 55, defects: 19, oee: 74.8 },
];

const KPI_CARDS = [
  { label: 'Avg OEE',         value: '84.3%', trend: +2.1, icon: Activity,     color: 'text-brand-400',  bg: 'bg-brand-500/20' },
  { label: 'Total Output',    value: '4,820', trend: +5.3, icon: BarChart3,    color: 'text-green-400',  bg: 'bg-green-500/20' },
  { label: 'Downtime (min)',  value: '115',   trend: -8.4, icon: Clock,        color: 'text-amber-400',  bg: 'bg-amber-500/20' },
  { label: 'First-Pass Yield',value: '98.6%', trend: +0.4, icon: CheckCircle2, color: 'text-cyan-400',   bg: 'bg-cyan-500/20'  },
];

type Range = '7d' | '30d' | '90d';

export function ProductionReportView() {
  const [range, setRange] = useState<Range>('7d');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            OEE trends, output analysis, and shift performance
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['7d', '30d', '90d'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  range === r ? 'bg-brand-600 text-white' : 'text-muted-foreground hover:bg-white/5'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-1" />Filter</Button>
          <Button size="sm"><Download className="w-4 h-4 mr-1" />Export</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi, i) => {
          const Icon = kpi.icon;
          const up = kpi.trend > 0;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-4 flex items-center gap-4"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                <Icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
                <div className="text-xl font-bold mt-0.5">{kpi.value}</div>
                <div className={`text-xs flex items-center gap-0.5 mt-0.5 ${up ? 'text-green-400' : 'text-red-400'}`}>
                  {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(kpi.trend)}% vs last period
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* OEE Trend */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">OEE Trend</h2>
            <Badge variant="outline" className="text-xs">Daily</Badge>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={OEE_TREND}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                formatter={(v: number) => [`${v}%`]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="oee"          stroke="#6366f1" strokeWidth={2} dot={false} name="OEE" />
              <Line type="monotone" dataKey="availability" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Availability" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="performance"  stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Performance" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Output by Line */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Output by Production Line</h2>
            <Badge variant="outline" className="text-xs">Today</Badge>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={OUTPUT_BY_LINE} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis dataKey="line" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={45} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              />
              <Bar dataKey="target" fill="rgba(99,102,241,0.2)" name="Target" radius={[0, 4, 4, 0]} />
              <Bar dataKey="actual" fill="#6366f1" name="Actual" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Shift Summary */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Shift Performance Summary</h2>
          <Button variant="ghost" size="sm"><Calendar className="w-4 h-4 mr-1" />Today</Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              {['Shift', 'Output (pcs)', 'Downtime (min)', 'Defects', 'OEE', 'Status'].map((h) => (
                <th key={h} className="text-left p-4 text-muted-foreground font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFT_SUMMARY.map((s) => (
              <tr key={s.shift} className="border-b border-border/30 hover:bg-white/5">
                <td className="p-4 font-medium">{s.shift}</td>
                <td className="p-4">{s.output.toLocaleString()}</td>
                <td className="p-4">
                  <span className={s.downtime > 40 ? 'text-red-400' : s.downtime > 25 ? 'text-amber-400' : 'text-green-400'}>
                    {s.downtime}
                  </span>
                </td>
                <td className="p-4">{s.defects}</td>
                <td className="p-4">
                  <span className={s.oee >= 85 ? 'text-green-400' : s.oee >= 75 ? 'text-amber-400' : 'text-red-400'}>
                    {s.oee}%
                  </span>
                </td>
                <td className="p-4">
                  <Badge variant={s.oee >= 85 ? 'default' : 'outline'} className="text-xs">
                    {s.oee >= 85 ? 'On Target' : s.oee >= 75 ? 'At Risk' : 'Below Target'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
