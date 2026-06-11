'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  LayoutGrid,
  Filter,
  Download,
  Plus,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Settings2,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  SlidersHorizontal, GitCommit, ClipboardList, Layers, Monitor,
  CalendarRange, CalendarClock, ShieldCheck, Wrench, GitMerge,
  Workflow, GitBranch, Sparkles, LineChart, Boxes,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KPICard } from '@/components/widgets/kpi-card';
import { OEEGauge } from '@/components/charts/oee-gauge';
import { ProductionTrendChart } from '@/components/charts/production-trend';
import { MachineStatusGrid } from '@/components/widgets/machine-status-grid';
import { AlarmList } from '@/components/widgets/alarm-list';
import { ProductionStatusBar } from '@/components/widgets/production-status-bar';
import { ShiftSummaryCard } from '@/components/widgets/shift-summary-card';
import { DowntimePareto } from '@/components/charts/downtime-pareto';
import { QualityTrendChart } from '@/components/charts/quality-trend';
import { useDashboardData } from './use-dashboard-data';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function DashboardView() {
  const { data, isLoading, refetch } = useDashboardData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateLabel, setDateLabel] = useState('');

  useEffect(() => {
    setDateLabel(format(new Date(), 'EEEE, MMMM d, yyyy'));
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Home</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dateLabel || ' '} · Real-time overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="realtime-badge">
            <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" />
            Live
          </div>

          <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleRefresh}>
            <RefreshCw size={13} className={cn(isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" asChild>
            <Link href="/dashboard-center">
              <LayoutGrid size={13} />
              Dashboard Center
            </Link>
          </Button>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="flex-1 overflow-auto p-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-5"
        >
          {/* Quick actions — one tap to the most-used screens */}
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
              {[
                { label: 'Control Panel',    href: '/manufacturing/control',          icon: SlidersHorizontal, tone: 'text-primary' },
                { label: 'New PO',           href: '/production/production-orders',   icon: GitCommit,         tone: 'text-sky-400' },
                { label: 'Work Orders',      href: '/production/orders',              icon: ClipboardList,     tone: 'text-indigo-400' },
                { label: 'Dispatch (JO)',    href: '/production/job-orders',          icon: Layers,            tone: 'text-violet-400' },
                { label: 'Shop Floor',       href: '/shop-floor',                     icon: Monitor,           tone: 'text-emerald-400' },
                { label: 'Schedule',         href: '/scheduling/production',          icon: CalendarRange,     tone: 'text-cyan-400' },
                { label: 'Downtime',         href: '/production/downtime',            icon: AlertTriangle,     tone: 'text-red-400' },
                { label: 'Planned DT',       href: '/scheduling/planned-downtime',    icon: CalendarClock,     tone: 'text-amber-400' },
                { label: 'Quality',          href: '/quality/inspections',            icon: ShieldCheck,       tone: 'text-green-400' },
                { label: 'Maintenance',      href: '/maintenance/work-orders',        icon: Wrench,            tone: 'text-orange-400' },
                { label: 'OEE Analytics',    href: '/production/oee',                 icon: LineChart,         tone: 'text-fuchsia-400' },
                { label: 'Energy',           href: '/energy',                         icon: Zap,               tone: 'text-yellow-400' },
                { label: 'Processes',        href: '/production/processes',           icon: Workflow,          tone: 'text-teal-400' },
                { label: 'BOM',              href: '/inventory/bom',                  icon: GitMerge,          tone: 'text-rose-400' },
                { label: 'Traceability',     href: '/traceability',                   icon: GitBranch,         tone: 'text-lime-400' },
                { label: 'Materials',        href: '/inventory/raw-materials',        icon: Boxes,             tone: 'text-blue-400' },
                { label: 'Reports',          href: '/reports',                        icon: TrendingUp,        tone: 'text-purple-400' },
                { label: 'AI Insights',      href: '/ai',                             icon: Sparkles,          tone: 'text-pink-400' },
              ].map(a => (
                <Link
                  key={a.href + a.label}
                  href={a.href}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border border-border/40 bg-card/60 hover:bg-muted/30 hover:border-primary/40 transition-all group"
                >
                  <a.icon size={17} className={cn('transition-transform group-hover:scale-110', a.tone)} />
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight px-1">
                    {a.label}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Production Status Bar */}
          <motion.div variants={itemVariants}>
            <ProductionStatusBar data={data?.productionStatus} isLoading={isLoading} />
          </motion.div>

          {/* KPI Row */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <KPICard
              title="Overall OEE"
              value={data?.kpis?.oee ?? 0}
              unit="%"
              trend={data?.kpis?.oeeTrend}
              target={85}
              colorMode="oee"
              isLoading={isLoading}
              icon={<Zap size={16} />}
            />
            <KPICard
              title="Availability"
              value={data?.kpis?.availability ?? 0}
              unit="%"
              trend={data?.kpis?.availabilityTrend}
              target={90}
              colorMode="oee"
              isLoading={isLoading}
              icon={<Activity size={16} />}
            />
            <KPICard
              title="Performance"
              value={data?.kpis?.performance ?? 0}
              unit="%"
              trend={data?.kpis?.performanceTrend}
              target={95}
              colorMode="oee"
              isLoading={isLoading}
              icon={<TrendingUp size={16} />}
            />
            <KPICard
              title="Quality Rate"
              value={data?.kpis?.quality ?? 0}
              unit="%"
              trend={data?.kpis?.qualityTrend}
              target={99}
              colorMode="oee"
              isLoading={isLoading}
              icon={<CheckCircle2 size={16} />}
            />
            <KPICard
              title="Total Output"
              value={data?.kpis?.totalOutput ?? 0}
              unit="units"
              trend={data?.kpis?.outputTrend}
              isLoading={isLoading}
              icon={<Activity size={16} />}
            />
            <KPICard
              title="Active Alarms"
              value={data?.kpis?.activeAlarms ?? 0}
              trend={data?.kpis?.alarmTrend}
              colorMode="alarm"
              isLoading={isLoading}
              icon={<AlertTriangle size={16} />}
            />
          </motion.div>

          {/* Main grid */}
          <div className="grid grid-cols-12 gap-4">
            {/* OEE Gauges */}
            <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4">
              <OEEGauge
                oee={data?.kpis?.oee ?? 0}
                availability={data?.kpis?.availability ?? 0}
                performance={data?.kpis?.performance ?? 0}
                quality={data?.kpis?.quality ?? 0}
                isLoading={isLoading}
              />
            </motion.div>

            {/* Production Trend */}
            <motion.div variants={itemVariants} className="col-span-12 lg:col-span-8">
              <ProductionTrendChart data={data?.productionTrend} isLoading={isLoading} />
            </motion.div>

            {/* Machine Status Grid */}
            <motion.div variants={itemVariants} className="col-span-12 lg:col-span-7">
              <MachineStatusGrid machines={data?.machines} isLoading={isLoading} />
            </motion.div>

            {/* Right column */}
            <div className="col-span-12 lg:col-span-5 space-y-4">
              {/* Shift Summary */}
              <motion.div variants={itemVariants}>
                <ShiftSummaryCard data={data?.shiftSummary} isLoading={isLoading} />
              </motion.div>

              {/* Active Alarms */}
              <motion.div variants={itemVariants}>
                <AlarmList alarms={data?.alarms} isLoading={isLoading} />
              </motion.div>
            </div>

            {/* Downtime Pareto */}
            <motion.div variants={itemVariants} className="col-span-12 lg:col-span-6">
              <DowntimePareto data={data?.downtimePareto} isLoading={isLoading} />
            </motion.div>

            {/* Quality Trend */}
            <motion.div variants={itemVariants} className="col-span-12 lg:col-span-6">
              <QualityTrendChart data={data?.qualityTrend} isLoading={isLoading} />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
