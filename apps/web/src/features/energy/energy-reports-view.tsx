'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Zap,
  TrendingUp,
  DollarSign,
  BarChart3,
  Activity,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';

interface EnergyMeter {
  id: string;
  name: string;
  type: string;
  unit: string;
  status?: string;
  lastReading?: { value: number; unit: string; timestamp: string } | null;
}

const REPORT_CARDS = [
  {
    title: 'Consumption Report',
    icon: Zap,
    description: 'Daily/weekly/monthly energy consumption trends',
  },
  {
    title: 'Peak Demand Analysis',
    icon: TrendingUp,
    description: 'Peak demand identification and load profiling',
  },
  {
    title: 'Cost Analysis',
    icon: DollarSign,
    description: 'Energy cost breakdown by area and equipment',
  },
] as const;

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EnergyReportsView() {
  const { data } = useQuery({
    queryKey: ['energy', 'meters'],
    queryFn: () =>
      api.get<EnergyMeter[]>('/energy/meters').catch(() => null),
    staleTime: 60_000,
  });

  const meters: EnergyMeter[] = Array.isArray(data) ? data : [];
  const hasMeters = meters.length > 0;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Energy Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Energy consumption monitoring and analytics
          </p>
        </div>
        {hasMeters && (
          <Badge variant="outline" className="ml-auto text-xs">
            {meters.length} {meters.length === 1 ? 'meter' : 'meters'} connected
          </Badge>
        )}
      </motion.div>

      {/* Empty state when no meter data */}
      {!hasMeters && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-10 flex flex-col items-center text-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
            <Zap className="w-8 h-8 text-yellow-400/50" />
          </div>
          <div>
            <div className="font-semibold text-base">No energy meters configured</div>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs">
              Add energy meters in the IIoT section to start monitoring consumption.
            </p>
          </div>
        </motion.div>
      )}

      {/* Report cards — 3-col grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Available Reports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REPORT_CARDS.map(({ title, icon: Icon, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass-card rounded-xl p-5 space-y-4 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-muted-foreground" />
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Coming Soon
                </Badge>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{title}</div>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
              <Button size="sm" variant="outline" disabled className="w-full h-8 text-xs">
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                View Report
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Connected meters table */}
      {hasMeters && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Connected Meters
          </h2>
          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Unit</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Last Reading</th>
                </tr>
              </thead>
              <tbody>
                {meters.map((meter, i) => {
                  const isActive = !meter.status || meter.status === 'ACTIVE';
                  return (
                    <tr
                      key={meter.id}
                      className={cn(
                        'border-b border-border/20 last:border-0 transition-colors hover:bg-muted/10',
                        i % 2 === 0 ? '' : 'bg-muted/5'
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{meter.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {meter.type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{meter.unit}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            isActive
                              ? 'text-green-400 border-green-500/40 bg-green-500/10'
                              : 'text-red-400 border-red-500/40 bg-red-500/10'
                          )}
                        >
                          <Activity className="w-2.5 h-2.5 mr-1" />
                          {isActive ? 'ACTIVE' : 'OFFLINE'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {meter.lastReading
                          ? `${meter.lastReading.value} ${meter.lastReading.unit} — ${formatTimestamp(meter.lastReading.timestamp)}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Navigation tip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Configure meters at</span>
        <Link
          href="/energy/meters"
          className="inline-flex items-center gap-0.5 text-primary hover:underline underline-offset-2"
        >
          Energy Meters
          <ChevronRight className="w-3 h-3" />
        </Link>
        <span>or add devices at</span>
        <Link
          href="/iot/devices"
          className="inline-flex items-center gap-0.5 text-primary hover:underline underline-offset-2"
        >
          IIoT Devices
          <ChevronRight className="w-3 h-3" />
        </Link>
      </motion.div>
    </div>
  );
}
