'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  LayoutGrid,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { TimeRangeFilter } from '@/components/ui/time-range-filter';
import { QUICK_ACTION_GROUPS } from '@/lib/quick-actions';
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

          {/* Smart time-range filter — same control used across Performance & KPIs */}
          <TimeRangeFilter />

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
          {/* Quick launch — every workspace, grouped by category with separators */}
          <motion.div variants={itemVariants}>
            <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-muted/20">
                <div className="flex items-center gap-2">
                  <LayoutGrid size={14} className="text-primary" />
                  <span className="text-xs font-semibold">Quick Launch</span>
                </div>
                <span className="text-[10px] text-muted-foreground hidden sm:block">
                  Tip: open the dock at the bottom from any page
                </span>
              </div>

              <div className="divide-y divide-border/40">
                {QUICK_ACTION_GROUPS.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <div key={group.category} className="px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <GroupIcon size={11} className={group.accent} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.category}
                        </span>
                        <span className={cn('h-px flex-1 ml-1 bg-gradient-to-r from-border/60 to-transparent')} />
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-2">
                        {group.actions.map((a) => {
                          const Icon = a.icon;
                          return (
                            <Link
                              key={a.href + a.label}
                              href={a.href}
                              target={a.newTab ? '_blank' : undefined}
                              rel={a.newTab ? 'noopener noreferrer' : undefined}
                              className="flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl border border-border/40 bg-card/60 hover:bg-muted/40 hover:border-primary/40 hover:-translate-y-0.5 transition-all group"
                            >
                              <Icon size={17} className={cn('transition-transform group-hover:scale-110', a.tone)} />
                              <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight">
                                {a.label}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
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
