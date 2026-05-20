'use client';

import React, { useState } from 'react';
import { Plus, Download, Search, Wifi, WifiOff, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KPICard } from '@/components/widgets/kpi-card';
import { api } from '@/services/api.client';
import { formatDate } from '@/lib/utils';

export function IotDevicesView() {
  const [search, setSearch] = useState('');

  const { data: devices, isLoading } = useQuery({
    queryKey: ['iot', 'devices', { search }],
    queryFn: () => api.get('/iot/devices', { params: { search } }),
    staleTime: 15_000,
  });

  const { data: kpis } = useQuery({
    queryKey: ['iot', 'devices-kpis'],
    queryFn: () => api.get('/iot/devices/kpis'),
    refetchInterval: 30_000,
  });

  const deviceList = devices?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">IoT Devices</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage connected devices and sensors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Download size={13} />
            Export
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs">
            <Plus size={13} />
            Add Device
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Total Devices" value={kpis?.total ?? 0} isLoading={isLoading} />
          <KPICard title="Online" value={kpis?.online ?? 0} colorMode="success" isLoading={isLoading} />
          <KPICard title="Offline" value={kpis?.offline ?? 0} colorMode="error" isLoading={isLoading} />
          <KPICard title="Warnings" value={kpis?.warnings ?? 0} colorMode="warning" isLoading={isLoading} />
        </div>

        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Connected Devices</h3>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 w-48 text-xs"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <TableHead className="text-[11px] font-semibold">Device ID</TableHead>
                  <TableHead className="text-[11px] font-semibold">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold">Type</TableHead>
                  <TableHead className="text-[11px] font-semibold">Protocol</TableHead>
                  <TableHead className="text-[11px] font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold">Last Seen</TableHead>
                  <TableHead className="text-[11px] font-semibold">Tags</TableHead>
                  <TableHead className="text-[11px] font-semibold">Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="shimmer h-3.5 rounded w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : deviceList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      No devices found
                    </TableCell>
                  </TableRow>
                ) : (
                  deviceList.map((device: any) => (
                    <TableRow key={device.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                      <TableCell className="font-mono text-xs font-semibold text-primary">{device.deviceId}</TableCell>
                      <TableCell className="text-xs font-medium">{device.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{device.type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{device.protocol}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={device.status === 'ONLINE' ? 'default' : 'destructive'}
                          className="text-[10px] h-5 gap-1"
                        >
                          {device.status === 'ONLINE' ? <Wifi size={10} /> : <WifiOff size={10} />}
                          {device.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(device.lastSeen)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{device.tagCount} tags</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{device.location}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
