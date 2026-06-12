'use client';

/**
 * Log Downtime Event dialog — reuses the exact field components/styles of the
 * Downtime Management "Log Downtime Event" form: Reason Code (icon Select),
 * Specific Cause (3-level CauseTreeSelect tree picker), Start Time, Notes.
 * Records a stoppage via POST /production/downtime/events; the machine is locked
 * to the job order's machine. Used on the shop floor / live dashboard.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Tag, AlignLeft } from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import {
  CauseTreeSelect, REASON_CODE_CFG,
  type ReasonNode, type CauseSelection,
} from '@/features/production/production-downtime-view';
import type { JOActionTarget } from './shop-floor-actions';

export function LogDowntimeDialog({
  open, onOpenChange, target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: JOActionTarget | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reasonCode, setReasonCode] = useState('UNPLANNED_BREAKDOWN');
  const [causeId, setCauseId] = useState('');
  const [cause, setCause] = useState<CauseSelection | null>(null);
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');

  const { data: reasonTree = [] } = useQuery<ReasonNode[]>({
    queryKey: ['downtime-reason-tree'],
    queryFn: () => api.get('/production/downtime/reasons/tree'),
    enabled: open,
    staleTime: 300_000,
  });

  const onCause = (id: string, sel: CauseSelection | null) => {
    setCauseId(id);
    setCause(sel);
    if (sel) {
      // mirror the main form: align reason code with the cause's planned flag
      if (sel.isPlanned && reasonCode === 'UNPLANNED_BREAKDOWN') setReasonCode('PLANNED_MAINTENANCE');
    }
  };

  const mut = useMutation({
    mutationFn: () =>
      api.post('/production/downtime/events', {
        machineId: target?.machineId,
        workOrderId: target?.workOrderId,
        ...(causeId ? { causeId } : {}),
        reasonCode,
        ...(cause ? { category: cause.category } : {}),
        ...(startTime ? { startTime: new Date(startTime).toISOString() } : {}),
        ...(notes.trim() ? { description: notes.trim() } : {}),
      }),
    onSuccess: () => {
      toast({ title: 'Downtime logged', description: cause?.l3Name ?? REASON_CODE_CFG[reasonCode as keyof typeof REASON_CODE_CFG]?.label });
      qc.invalidateQueries({ queryKey: ['jo-live'] });
      qc.invalidateQueries({ queryKey: ['shop-floor-jobs'] });
      qc.invalidateQueries({ queryKey: ['downtime'] });
      onOpenChange(false);
      setCauseId(''); setCause(null); setNotes(''); setStartTime('');
    },
    onError: (e: any) => toast({
      variant: 'destructive', title: 'Failed to log downtime', description: e?.response?.data?.message,
    }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" /> Log Downtime Event
          </DialogTitle>
          <DialogDescription>
            {target?.machineName ? `Machine: ${target.machineName} — ` : ''}Record a machine stoppage with its root cause.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* Reason Code — icon Select (same as main form) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Reason Code</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REASON_CODE_CFG).map(([k, v]) => {
                  const Icon = v.icon;
                  return (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <Icon size={12} className={v.color} />
                        <span>{v.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Specific Cause — 3-level tree picker (same as main form) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Specific Cause</Label>
              <span className="text-[10px] text-muted-foreground">Category → Sub-category → Specific Reason</span>
            </div>
            <CauseTreeSelect
              reasonTree={reasonTree}
              value={causeId}
              machineId={target?.machineId || undefined}
              onChange={onCause}
            />
            {cause && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Tag size={10} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Category auto-set to:</span>
                <Badge variant="outline" className="text-[10px] h-4">{cause.category}</Badge>
                {cause.isPlanned && <Badge variant="outline" className="text-[10px] h-4 text-blue-400 border-blue-500/30">Planned Stop</Badge>}
              </div>
            )}
          </div>

          {/* Start Time */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Start Time (leave blank = now)</Label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-10 text-sm"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">
              <AlignLeft size={12} className="inline mr-1 text-muted-foreground" />
              Additional Notes
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what happened, any immediate actions taken…"
              className="h-10"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={mut.isPending || !target?.machineId} onClick={() => mut.mutate()}>
            <AlertTriangle className="w-4 h-4 mr-2" />
            {mut.isPending ? 'Logging…' : 'Log Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
