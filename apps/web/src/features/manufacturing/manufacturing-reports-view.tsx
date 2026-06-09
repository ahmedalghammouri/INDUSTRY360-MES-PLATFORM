'use client';

import { motion } from 'framer-motion';
import {
  BarChart3,
  Factory,
  Gauge,
  AlertTriangle,
  Layers,
  Clock,
  ChevronRight,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api.client';
import { cn, formatPercent } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardKPIs {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  totalOutput: number;
  activeAlarms: number;
  oeeTrend?: number;
  availabilityTrend?: number;
  outputTrend?: number;
  alarmTrend?: number;
}

// ── Report card config ───────────────────────────────────────────────────────

const REPORT_CARDS = [
  {
    title: 'Production Performance',
    href: '/reports/production',
    icon: Factory,
    description: 'WO completion rates and output trends',
    iconColor: 'text-brand-400',
    iconBg: 'bg-brand-500/15',
  },
  {
    title: 'OEE Analysis',
    href: '/manufacturing/oee',
    icon: Gauge,
    description: 'Equipment effectiveness breakdown',
    iconColor: 'text-green-400',
    iconBg: 'bg-green-500/15',
  },
  {
    title: 'Downtime Analysis',
    href: '/production/downtime',
    icon: AlertTriangle,
    description: 'Downtime events by cause and duration',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
  },
  {
    title: 'Scrap and Waste',
    href: '/production/scrap-log',
    icon: Trash2,
    description: 'Scrap events by category and operator',
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/15',
  },
  {
    title: 'Job Order History',
    href: '/production/job-orders',
    icon: Layers,
    description: 'Dispatch list history and completion',
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/15',
  },
  {
    title: 'Shift Performance',
    href: '/manufacturing/kpi',
    icon: Clock,
    description: 'Per-shift output, quality, efficiency',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15',
  },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function ManufacturingReportsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.get<DashboardKPIs>('/dashboard/kpis'),
    staleTime: 60_000,
  });

  const kpis = data as unknown as DashboardKPIs | undefined;

  const pills = [
    {
      label: 'OEE',
      value: isLoading ? '—' : formatPercent(kpis?.oee ?? null),
      color: 'text-brand-400',
      bg: 'bg-brand-500/15 border-brand-500/30',
    },
    {
      label: 'Availability',
      value: isLoading ? '—' : formatPercent(kpis?.availability ?? null),
      color: 'text-green-400',
      bg: 'bg-green-500/15 border-green-500/30',
    },
    {
      label: 'Units Today',
      value: isLoading ? '—' : (kpis?.totalOutput ?? 0).toLocaleString(),
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/15 border-cyan-500/30',
    },
    {
      label: 'Active Alarms',
      value: isLoading ? '—' : (kpis?.activeAlarms ?? 0).toString(),
      color: (kpis?.activeAlarms ?? 0) > 0 ? 'text-red-400' : 'text-muted-foreground',
      bg:
        (kpis?.activeAlarms ?? 0) > 0
          ? 'bg-red-500/15 border-red-500/30'
          : 'bg-muted/30 border-border',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Manufacturing Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Operational insight across production, quality, and equipment
          </p>
        </div>
      </motion.div>

      {/* KPI pills row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap gap-2"
      >
        {pills.map((pill) => (
          <div
            key={pill.label}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium',
              pill.bg,
            )}
          >
            <TrendingUp className={cn('w-3.5 h-3.5', pill.color)} />
            <span className="text-muted-foreground text-xs">{pill.label}</span>
            {isLoading ? (
              <div className="shimmer h-3.5 w-10 rounded-full" />
            ) : (
              <span className={cn('font-semibold tabular-nums', pill.color)}>{pill.value}</span>
            )}
          </div>
        ))}
      </motion.div>

      {/* Report cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORT_CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.06 }}
              className="glass-card rounded-xl p-5 flex flex-col gap-4 group hover:ring-1 hover:ring-white/10 transition-all"
            >
              {/* Card header */}
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    card.iconBg,
                  )}
                >
                  <Icon className={cn('w-5 h-5', card.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-sm leading-snug">{card.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>

              {/* View Report button */}
              <div className="mt-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between text-xs group-hover:border-white/20 transition-colors"
                  asChild
                >
                  <Link href={card.href}>
                    <span>View Report</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
