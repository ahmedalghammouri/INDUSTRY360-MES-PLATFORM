'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap, Gauge, DollarSign, Activity, Thermometer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';

interface EnergyOverview {
  meterCount: number;
  totalConsumptionMtd: number;
  totalCostMtd: number;
  totalConsumptionToday: number;
  byType: Record<string, number>;
  trend: { date: string; value: number }[];
}

interface EnergyMeter {
  id: string;
  meterNumber: string;
  name: string;
  type: string;
  unit: string;
  location: string | null;
  machine: { name: string; code: string } | null;
  area: { name: string } | null;
  lastReading: { value: number; unit: string; timestamp: string } | null;
  mtdConsumption: number;
  mtdCost: number;
}

const TYPE_COLORS: Record<string, string> = {
  ELECTRICAL: '#6366f1',
  NATURAL_GAS: '#f59e0b',
  COMPRESSED_AIR: '#06b6d4',
  WATER: '#3b82f6',
  STEAM: '#8b5cf6',
  CHILLED_WATER: '#10b981',
};

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  ELECTRICAL: Zap,
  NATURAL_GAS: Thermometer,
  COMPRESSED_AIR: Gauge,
  WATER: Activity,
  STEAM: Thermometer,
  CHILLED_WATER: Activity,
};

function dateRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function EnergyOverview() {
  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['energy', 'overview'],
    queryFn: () => api.get<EnergyOverview>('/energy/overview'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: metersData, isLoading: metersLoading } = useQuery({
    queryKey: ['energy', 'meters'],
    queryFn: () => api.get<EnergyMeter[]>('/energy/meters'),
    staleTime: 30_000,
  });

  const { from, to } = dateRange(30);
  const { data: consumptionData } = useQuery({
    queryKey: ['energy', 'consumption', '30d'],
    queryFn: () => api.get<{ chart: any[] }>('/energy/consumption', { params: { from, to } }),
    staleTime: 60_000,
  });

  const ov: EnergyOverview = (overview as any) ?? {
    meterCount: 0, totalConsumptionMtd: 0, totalCostMtd: 0, totalConsumptionToday: 0, byType: {}, trend: [],
  };
  const meters: EnergyMeter[] = Array.isArray(metersData) ? metersData : [];
  const chartData: any[] = (consumptionData as any)?.chart ?? ov.trend.map(t => ({ date: t.date, ELECTRICAL: t.value }));

  const energyTypes = Object.keys(ov.byType);

  const byTypeChart = useMemo(() =>
    Object.entries(ov.byType).map(([type, value]) => ({ type: type.replace(/_/g, ' '), value })),
    [ov.byType],
  );

  const kpis = [
    { label: 'Active Meters', value: ov.meterCount, icon: Gauge, color: 'text-brand-400', bg: 'bg-brand-500/20' },
    { label: 'Consumption MTD (kWh)', value: ov.totalConsumptionMtd.toLocaleString(), icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    { label: 'Cost MTD (SAR)', value: ov.totalCostMtd.toLocaleString(), icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/20' },
    { label: "Today's Consumption", value: ov.totalConsumptionToday.toLocaleString(), icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Energy Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time energy consumption and cost tracking</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/energy/meters">Manage Meters</Link>
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-4 flex items-center gap-4"
            >
              {ovLoading ? (
                <div className="shimmer h-12 w-full rounded" />
              ) : (
                <>
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', kpi.bg)}>
                    <Icon className={cn('w-5 h-5', kpi.color)} />
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">{kpi.label}</div>
                    <div className="text-xl font-bold mt-0.5">{kpi.value}</div>
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Consumption Trend (30d)</h2>
            <Badge variant="outline" className="text-xs">kWh / day</Badge>
          </div>
          {chartData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                {energyTypes.length > 0 ? energyTypes.map(type => (
                  <Area
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stroke={TYPE_COLORS[type] ?? '#6366f1'}
                    fill="url(#energyGrad)"
                    strokeWidth={2}
                    dot={false}
                    name={type.replace(/_/g, ' ')}
                  />
                )) : (
                  <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#energyGrad)" strokeWidth={2} dot={false} />
                )}
                {energyTypes.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Consumption by Type (MTD)</h2>
            <Badge variant="outline" className="text-xs">kWh</Badge>
          </div>
          {byTypeChart.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byTypeChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="type" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={100} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                <Bar dataKey="value" fill="#6366f1" name="Consumption" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Meters table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h2 className="font-semibold text-sm">Energy Meters</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/60">
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Meter</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Type</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Location</th>
                <th className="text-right p-3 text-muted-foreground font-medium text-xs">Last Reading</th>
                <th className="text-right p-3 text-muted-foreground font-medium text-xs">MTD kWh</th>
                <th className="text-right p-3 text-muted-foreground font-medium text-xs">MTD Cost (SAR)</th>
              </tr>
            </thead>
            <tbody>
              {metersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="p-3"><div className="shimmer h-5 rounded" /></td></tr>
                ))
              ) : meters.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">No meters configured</td></tr>
              ) : (
                meters.map(m => {
                  const color = TYPE_COLORS[m.type] ?? '#94a3b8';
                  const Icon = TYPE_ICONS[m.type] ?? Zap;
                  return (
                    <tr key={m.id} className="border-b border-border/30 hover:bg-white/5">
                      <td className="p-3 text-xs">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-muted-foreground font-mono">{m.meterNumber}</div>
                      </td>
                      <td className="p-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3 h-3" style={{ color }} />
                          <span style={{ color }}>{m.type.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {m.machine?.name ?? m.area?.name ?? m.location ?? '—'}
                      </td>
                      <td className="p-3 text-xs text-right">
                        {m.lastReading
                          ? <span className="font-semibold">{m.lastReading.value} {m.lastReading.unit}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-xs text-right font-semibold">{m.mtdConsumption.toLocaleString()}</td>
                      <td className="p-3 text-xs text-right text-muted-foreground">{m.mtdCost.toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
