'use client';

import React, { useState } from 'react';
import { Plus, Download, Filter, Search, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KPICard } from '@/components/widgets/kpi-card';
import { api } from '@/services/api.client';
import { formatDate } from '@/lib/utils';

export function MaintenancePreventiveView() {
  const [search, setSearch] = useState('');

  const { data: pmSchedules, isLoading } = useQuery({
    queryKey: ['maintenance', 'preventive', { search }],
    queryFn: () => api.get('/maintenance/preventive', { params: { search } }),
    staleTime: 30_000,
  });

  const { data: pmKPIs } = useQuery({
    queryKey: ['maintenance', 'preventive-kpis'],
    queryFn: () => api.get('/maintenance/preventive/kpis'),
    refetchInterval: 60_000,
  });

  const schedules = pmSchedules?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Preventive Maintenance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            PM schedules and maintenance planning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Download size={13} />
            Export
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs">
            <Plus size={13} />
            New PM Schedule
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Total Schedules" value={pmKPIs?.total ?? 0} isLoading={isLoading} />
          <KPICard title="Due This Week" value={pmKPIs?.dueThisWeek ?? 0} colorMode="warning" isLoading={isLoading} />
          <KPICard title="Overdue" value={pmKPIs?.overdue ?? 0} colorMode="error" isLoading={isLoading} />
          <KPICard title="Completed" value={pmKPIs?.completed ?? 0} colorMode="success" isLoading={isLoading} />
        </div>

        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">PM Schedules</h3>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search schedules..."
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
                  <TableHead className="text-[11px] font-semibold">Equipment</TableHead>
                  <TableHead className="text-[11px] font-semibold">Task</TableHead>
                  <TableHead className="text-[11px] font-semibold">Frequency</TableHead>
                  <TableHead className="text-[11px] font-semibold">Last Done</TableHead>
                  <TableHead className="text-[11px] font-semibold">Next Due</TableHead>
                  <TableHead className="text-[11px] font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold">Assigned To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="shimmer h-3.5 rounded w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                      No PM schedules found
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((schedule: any) => (
                    <TableRow key={schedule.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                      <TableCell className="text-xs font-medium">{schedule.equipment}</TableCell>
                      <TableCell className="text-xs">{schedule.task}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{schedule.frequency}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(schedule.lastDone)}</TableCell>
                      <TableCell className="text-xs font-medium">{formatDate(schedule.nextDue)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={schedule.status === 'OVERDUE' ? 'destructive' : schedule.status === 'DUE' ? 'outline' : 'secondary'}
                          className="text-[10px] h-5"
                        >
                          {schedule.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{schedule.assignedTo}</TableCell>
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
