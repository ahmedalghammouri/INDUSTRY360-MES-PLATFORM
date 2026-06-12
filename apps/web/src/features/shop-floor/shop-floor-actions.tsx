'use client';

/**
 * Shop-floor operator actions — shared between the job-order cards and the
 * live dashboard:
 *   • MaintenanceRequestDialog → POST /maintenance/work-orders (linked to machine + production WO)
 *   • MachineStateDialog       → PATCH /production/downtime/machines/:id/state
 *       (state timeline + downtime event + pauses/resumes the job order)
 *   • AlarmDialog              → POST /alarms (tagged to machine + job order)
 * All integrated with the existing data models — no mock data.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench, AlertTriangle, BellRing, Play, Pause } from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import {
  CauseTreeSelect, type ReasonNode, type CauseSelection,
} from '@/features/production/production-downtime-view';

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────

export interface JOActionTarget {
  jobOrderId: string;
  workOrderId?: string;
  machineId?: string;
  machineName?: string;
  operationName?: string;
}

const inputCls =
  'w-full px-3 py-2 text-sm bg-background/80 border border-border rounded-lg focus:outline-none focus:border-brand-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. Maintenance request
// ─────────────────────────────────────────────────────────────

const MAINT_TYPES = ['CORRECTIVE', 'EMERGENCY', 'INSPECTION', 'PREVENTIVE'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export function MaintenanceRequestDialog({
  open, onOpenChange, target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: JOActionTarget | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState<string>('CORRECTIVE');
  const [priority, setPriority] = useState<string>('HIGH');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const mut = useMutation({
    mutationFn: () =>
      api.post('/maintenance/work-orders', {
        type,
        priority,
        machineId: target?.machineId,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(target?.workOrderId ? { productionWOId: target.workOrderId } : {}),
        notes: target?.operationName ? `Requested from shop floor — operation "${target.operationName}"` : undefined,
      }),
    onSuccess: (r: any) => {
      toast({ title: 'Maintenance requested', description: r?.woNumber ? `Work order ${r.woNumber} created` : undefined });
      qc.invalidateQueries({ queryKey: ['jo-live'] });
      onOpenChange(false);
      setTitle(''); setDescription('');
    },
    onError: (e: any) => toast({
      variant: 'destructive', title: 'Request failed', description: e?.response?.data?.message,
    }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" /> Request Maintenance
          </DialogTitle>
          <DialogDescription>
            {target?.machineName ? `Machine: ${target.machineName}` : 'Creates a maintenance work order linked to this machine and production order.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                {MAINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Feeder belt slipping — needs adjustment"
              className={inputCls}
            />
          </Field>
          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Symptoms, what was observed, urgency…"
              className={inputCls}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={mut.isPending || title.trim().length < 5 || !target?.machineId}
            onClick={() => mut.mutate()}
          >
            <Wrench className="w-4 h-4 mr-2" />
            {mut.isPending ? 'Submitting…' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Machine state / downtime
// ─────────────────────────────────────────────────────────────

const MACHINE_STATES: Array<{ value: string; label: string; tone: string; down: boolean }> = [
  { value: 'RUNNING',     label: 'Running',          tone: 'text-green-400',  down: false },
  { value: 'IDLE',        label: 'Idle',             tone: 'text-slate-400',  down: false },
  { value: 'BREAKDOWN',   label: 'Breakdown',        tone: 'text-red-400',    down: true },
  { value: 'PLANNED_STOP',label: 'Planned Stop',     tone: 'text-blue-400',   down: true },
  { value: 'SETUP',       label: 'Setup',            tone: 'text-amber-400',  down: true },
  { value: 'CHANGEOVER',  label: 'Changeover',       tone: 'text-amber-400',  down: true },
  { value: 'STARVED',     label: 'Starved (no material)', tone: 'text-orange-400', down: true },
  { value: 'BLOCKED',     label: 'Blocked (downstream)',  tone: 'text-purple-400', down: true },
  { value: 'MAINTENANCE', label: 'Maintenance',      tone: 'text-cyan-400',   down: true },
];

export function MachineStateDialog({
  open, onOpenChange, target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: JOActionTarget | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [state, setState] = useState('BREAKDOWN');
  const [causeId, setCauseId] = useState('');
  const [cause, setCause] = useState<CauseSelection | null>(null);
  const [reason, setReason] = useState('');

  const isDown = MACHINE_STATES.find((s) => s.value === state)?.down ?? false;

  // 3-level NCC reason tree (Category → Sub-category → Specific Reason)
  const { data: reasonTree = [] } = useQuery<ReasonNode[]>({
    queryKey: ['downtime-reason-tree'],
    queryFn: () => api.get('/production/downtime/reasons/tree'),
    enabled: open,
    staleTime: 300_000,
  });

  const mut = useMutation({
    mutationFn: () =>
      api.patch(`/production/downtime/machines/${target?.machineId}/state`, {
        state,
        ...(causeId ? { downtimeCauseId: causeId } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        jobOrderId: target?.jobOrderId,
        workOrderId: target?.workOrderId,
      }),
    onSuccess: (r: any) => {
      const joMsg = r?.jobOrder ? ` · Job order → ${r.jobOrder.status}` : '';
      toast({ title: `Machine → ${state}${joMsg}` });
      qc.invalidateQueries({ queryKey: ['shop-floor-jobs'] });
      qc.invalidateQueries({ queryKey: ['jo-live'] });
      onOpenChange(false);
      setReason(''); setCauseId(''); setCause(null);
    },
    onError: (e: any) => toast({
      variant: 'destructive', title: 'State change failed', description: e?.response?.data?.message,
    }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" /> Machine State / Stop Reason
          </DialogTitle>
          <DialogDescription>
            {target?.machineName ? `Machine: ${target.machineName} — ` : ''}
            Updates the machine state timeline, opens/closes the downtime event and
            {isDown ? ' pauses' : ' resumes'} the job order.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="New state">
            <div className="grid grid-cols-3 gap-2">
              {MACHINE_STATES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setState(s.value)}
                  className={`px-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    state === s.value
                      ? 'border-brand-400 bg-brand-500/15 ' + s.tone
                      : 'border-border bg-muted/40 text-muted-foreground hover:border-brand-400/40'
                  }`}
                >
                  {s.value === 'RUNNING' ? <Play className="w-3 h-3 inline mr-1" /> :
                   s.down ? <Pause className="w-3 h-3 inline mr-1" /> : null}
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
          {isDown && (
            <Field label="Stop reason (downtime cause)">
              <CauseTreeSelect
                reasonTree={reasonTree}
                value={causeId}
                machineId={target?.machineId || undefined}
                onChange={(id, sel) => { setCauseId(id); setCause(sel); }}
              />
              {cause && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-muted-foreground">Category:</span>
                  <Badge variant="outline" className="text-[10px] h-4">{cause.category}</Badge>
                  {cause.isPlanned && <Badge variant="outline" className="text-[10px] h-4 text-blue-400 border-blue-500/30">Planned Stop</Badge>}
                </div>
              )}
            </Field>
          )}
          <Field label={isDown ? 'Details / root cause' : 'Note (optional)'}>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder={isDown ? 'Describe what happened…' : 'e.g. Jam cleared, restarting'}
              className={inputCls}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={mut.isPending || !target?.machineId}
            onClick={() => mut.mutate()}
            variant={isDown ? 'destructive' : 'default'}
          >
            {mut.isPending ? 'Applying…' : `Set ${state}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Raise alarm
// ─────────────────────────────────────────────────────────────

const SEVERITIES: Array<{ value: string; label: string; cls: string }> = [
  { value: 'CRITICAL', label: 'Critical', cls: 'border-red-500/60 text-red-400 bg-red-500/10' },
  { value: 'HIGH',     label: 'High',     cls: 'border-orange-500/60 text-orange-400 bg-orange-500/10' },
  { value: 'MEDIUM',   label: 'Medium',   cls: 'border-amber-500/60 text-amber-400 bg-amber-500/10' },
  { value: 'LOW',      label: 'Low',      cls: 'border-blue-500/60 text-blue-400 bg-blue-500/10' },
  { value: 'INFO',     label: 'Info',     cls: 'border-slate-500/60 text-slate-400 bg-slate-500/10' },
];

export function AlarmDialog({
  open, onOpenChange, target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: JOActionTarget | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [severity, setSeverity] = useState('HIGH');
  const [category, setCategory] = useState('PROCESS');
  const [description, setDescription] = useState('');

  const mut = useMutation({
    mutationFn: () =>
      api.post('/alarms', {
        machineId: target?.machineId,
        jobOrderId: target?.jobOrderId,
        workOrderId: target?.workOrderId,
        severity,
        category,
        description: description.trim(),
      }),
    onSuccess: () => {
      toast({ title: 'Alarm raised', description: `${severity} · ${description.slice(0, 60)}` });
      qc.invalidateQueries({ queryKey: ['jo-live'] });
      qc.invalidateQueries({ queryKey: ['alarms'] });
      onOpenChange(false);
      setDescription('');
    },
    onError: (e: any) => toast({
      variant: 'destructive', title: 'Failed to raise alarm', description: e?.response?.data?.message,
    }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-red-400" /> Raise Alarm
          </DialogTitle>
          <DialogDescription>
            {target?.machineName ? `Machine: ${target.machineName} — ` : ''}
            Notifies supervisors; appears in the live dashboard and alarm log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Severity">
            <div className="flex gap-2 flex-wrap">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSeverity(s.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    severity === s.value ? s.cls + ' ring-1 ring-current' : 'border-border text-muted-foreground bg-muted/40'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {['PROCESS', 'EQUIPMENT', 'SAFETY', 'QUALITY', 'OPERATOR'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is happening?"
              className={inputCls}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={mut.isPending || description.trim().length < 3}
            onClick={() => mut.mutate()}
          >
            <BellRing className="w-4 h-4 mr-2" />
            {mut.isPending ? 'Raising…' : 'Raise Alarm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
