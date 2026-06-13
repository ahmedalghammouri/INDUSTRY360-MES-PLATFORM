'use client';

import { motion } from 'framer-motion';
import { Router, Wifi, WifiOff, RefreshCw, Cpu, Server, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { KPICard } from '@/components/widgets/kpi-card';
import { api } from '@/services/api.client';
import { cn, timeAgo, formatDateTime } from '@/lib/utils';

interface Gateway {
  id: string;
  name: string;
  hostname: string | null;
  version: string | null;
  status: string;
  online: boolean;
  deviceCount: number;
  lastHeartbeatAt: string | null;
  lastError: string | null;
}

export function IotGatewaysView() {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['iot', 'gateways', 'kpis'],
    queryFn: () => api.get<{ total: number; online: number; offline: number }>('/iot/gateways/kpis'),
    refetchInterval: 15_000,
  });

  const { data: gateways, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['iot', 'gateways'],
    queryFn: () => api.get<Gateway[]>('/iot/gateways'),
    refetchInterval: 15_000,
  });

  const list = Array.isArray(gateways) ? gateways : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Router size={18} className="text-primary" />
            Edge Gateways
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            On-prem Modbus acquisition gateways — live status &amp; heartbeat
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 h-8 text-xs">
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          <KPICard title="Gateways" value={kpis?.total ?? 0} isLoading={kpisLoading} icon={<Server size={16} />} />
          <KPICard title="Online" value={kpis?.online ?? 0} isLoading={kpisLoading} icon={<Wifi size={16} />} />
          <KPICard title="Offline" value={kpis?.offline ?? 0} colorMode="alarm" isLoading={kpisLoading} icon={<WifiOff size={16} />} />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 opacity-40 animate-spin" />
            <div className="text-sm">Loading gateways…</div>
          </div>
        ) : list.length === 0 ? (
          <div className="glass-card rounded-xl p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <Router className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div className="font-semibold text-foreground/70 text-base">No edge gateways registered</div>
            <div className="text-muted-foreground text-sm mt-1.5">
              Install the STAR-MES Edge Gateway on a plant PC; it registers itself here on first connect.
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="w-[90px]">Devices</TableHead>
                  <TableHead>Last heartbeat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((gw) => (
                  <motion.tr
                    key={gw.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn('border-b border-border/50 hover:bg-foreground/[0.03]', !gw.online && 'opacity-70')}
                  >
                    <TableCell>
                      <div className="font-medium text-sm">{gw.name}</div>
                      {gw.lastError && <div className="text-[11px] text-danger-400 mt-0.5">{gw.lastError}</div>}
                    </TableCell>
                    <TableCell>
                      {gw.online ? (
                        <Badge variant="outline" className="text-[10px] gap-1 text-success-400 border-success-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" /> Online
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 text-danger-400 border-danger-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-danger-400" /> Offline
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{gw.hostname ?? '—'}</span>
                    </TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{gw.version ?? '—'}</span></TableCell>
                    <TableCell>
                      <span className="text-xs flex items-center gap-1.5"><Cpu size={12} className="text-muted-foreground" />{gw.deviceCount}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5" title={gw.lastHeartbeatAt ? formatDateTime(gw.lastHeartbeatAt) : ''}>
                        <Clock size={12} />
                        {gw.lastHeartbeatAt ? `${timeAgo(gw.lastHeartbeatAt)} ago` : 'never'}
                      </span>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
