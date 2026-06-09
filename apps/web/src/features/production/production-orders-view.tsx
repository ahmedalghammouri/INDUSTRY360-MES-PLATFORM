'use client';

import React, { useState } from 'react';
import {
  Plus, Search, ChevronRight, ArrowRight, AlertCircle,
  CheckCircle2, Clock, Package, Cpu, SendHorizonal,
  ClipboardList, RefreshCw, PauseCircle, XCircle, Trash2,
  Pencil, Play, MoreHorizontal, Zap, Eye, ChevronDown,
  BarChart3, User, TrendingUp, Info, Layers, GitBranch,
  CheckSquare, Circle, Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type POStatus = 'PLANNED' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
type WOStatus = 'PLANNED' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface WorkOrderRef {
  id: string; orderNumber: string; status: WOStatus;
  plannedQty: number; actualQty: number; goodQty: number;
  machine?: { name: string }; operator?: { name: string };
  plannedStart: string | null; plannedEnd: string | null;
}

interface ProductionOrder {
  id: string; orderNumber: string; sapOrderNumber?: string;
  status: POStatus; priority: Priority;
  targetQty: number; completedQty: number; unit: string;
  customer?: string; plannedStart: string; plannedEnd: string;
  actualStart?: string; actualEnd?: string; notes?: string;
  sku?: { id: string; name: string; code: string; itemNumber: string };
  workOrders: WorkOrderRef[];
  createdAt: string;
}

type JOStatus = 'SCHEDULED' | 'READY' | 'EXECUTING' | 'PAUSED' | 'COMPLETE' | 'CANCELLED';

interface JobOrder {
  id: string;
  sequenceOrder: number;
  operationName: string;
  status: JOStatus;
  machine?: { name: string; code: string };
  workCenter?: { name: string; code: string };
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  plannedQtyIn?: number | null;
  plannedQtyOut?: number | null;
  outputUnit?: string | null;
  actualQtyGood: number;
  actualQtyRejected: number;
  handoverQty: number;
  idealCycleTimeSec?: number | null;
  notes?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Status / Priority config
// ─────────────────────────────────────────────────────────────

const PO_STATUS: Record<POStatus, { label: string; color: string; bg: string; icon: any }> = {
  PLANNED:     { label: 'Planned',     color: 'text-slate-400',  bg: 'bg-slate-500/15',  icon: Clock        },
  RELEASED:    { label: 'Released',    color: 'text-blue-400',   bg: 'bg-blue-500/15',   icon: SendHorizonal },
  IN_PROGRESS: { label: 'In Progress', color: 'text-brand-400',  bg: 'bg-brand-500/15',  icon: RefreshCw    },
  COMPLETED:   { label: 'Completed',   color: 'text-green-400',  bg: 'bg-green-500/15',  icon: CheckCircle2 },
  ON_HOLD:     { label: 'On Hold',     color: 'text-amber-400',  bg: 'bg-amber-500/15',  icon: PauseCircle  },
  CANCELLED:   { label: 'Cancelled',   color: 'text-red-400',    bg: 'bg-red-500/15',    icon: XCircle      },
};

const WO_STATUS: Record<WOStatus, { label: string; color: string; bar: string }> = {
  PLANNED:     { label: 'Planned',     color: 'text-slate-400', bar: 'bg-slate-500'  },
  RELEASED:    { label: 'Released',    color: 'text-blue-400',  bar: 'bg-blue-500'   },
  IN_PROGRESS: { label: 'Running',     color: 'text-brand-400', bar: 'bg-brand-500'  },
  COMPLETED:   { label: 'Completed',   color: 'text-green-400', bar: 'bg-green-500'  },
  ON_HOLD:     { label: 'On Hold',     color: 'text-amber-400', bar: 'bg-amber-500'  },
  CANCELLED:   { label: 'Cancelled',   color: 'text-red-400',   bar: 'bg-red-500'    },
};

const PRI_CLS: Record<Priority, string> = {
  CRITICAL: 'border-red-500 text-red-400',
  HIGH:     'border-orange-500 text-orange-400',
  MEDIUM:   'border-yellow-500 text-yellow-400',
  LOW:      'border-slate-500 text-slate-400',
};

const JO_STATUS: Record<JOStatus, { label: string; color: string; bg: string; dot: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'text-slate-400',  bg: 'bg-slate-500/15',  dot: 'bg-slate-500'  },
  READY:     { label: 'Ready',     color: 'text-blue-400',   bg: 'bg-blue-500/15',   dot: 'bg-blue-500'   },
  EXECUTING: { label: 'Running',   color: 'text-brand-400',  bg: 'bg-brand-500/15',  dot: 'bg-brand-500'  },
  PAUSED:    { label: 'Paused',    color: 'text-amber-400',  bg: 'bg-amber-500/15',  dot: 'bg-amber-500'  },
  COMPLETE:  { label: 'Complete',  color: 'text-green-400',  bg: 'bg-green-500/15',  dot: 'bg-green-500'  },
  CANCELLED: { label: 'Cancelled', color: 'text-red-400',    bg: 'bg-red-500/15',    dot: 'bg-red-500'    },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function fmt(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 16);
}

function poProgress(po: ProductionOrder) {
  if (po.status === 'COMPLETED') return 100;
  if (po.status === 'PLANNED' || po.status === 'CANCELLED') return 0;
  const qty = po.workOrders.reduce((s, w) => s + (w.goodQty || w.actualQty || 0), 0);
  if (po.targetQty > 0 && qty > 0) return Math.min(99, Math.round((qty / po.targetQty) * 100));
  return po.status === 'IN_PROGRESS' ? 5 : 0;
}

function woProgress(wo: WorkOrderRef) {
  if (wo.status === 'COMPLETED') return 100;
  const done = wo.goodQty || wo.actualQty || 0;
  if (wo.plannedQty > 0 && done > 0) return Math.min(99, Math.round((done / wo.plannedQty) * 100));
  return wo.status === 'IN_PROGRESS' ? 5 : 0;
}

// ─────────────────────────────────────────────────────────────
// PO Form (Create + Edit)
// ─────────────────────────────────────────────────────────────

interface POFormDialogProps {
  open: boolean; onClose: () => void;
  initial?: ProductionOrder | null;
}

function POFormDialog({ open, onClose, initial }: POFormDialogProps) {
  const isEdit = !!initial;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    orderNumber:    initial?.orderNumber ?? '',
    sapOrderNumber: initial?.sapOrderNumber ?? '',
    skuId:          initial?.sku?.id ?? '',
    targetQty:      String(initial?.targetQty ?? ''),
    unit:           initial?.unit ?? 'CARTON',
    priority:       initial?.priority ?? 'MEDIUM',
    plannedStart:   toLocalInput(initial?.plannedStart),
    plannedEnd:     toLocalInput(initial?.plannedEnd),
    customer:       initial?.customer ?? '',
    notes:          initial?.notes ?? '',
  });

  React.useEffect(() => {
    if (open) setForm({
      orderNumber:    initial?.orderNumber ?? '',
      sapOrderNumber: initial?.sapOrderNumber ?? '',
      skuId:          initial?.sku?.id ?? '',
      targetQty:      String(initial?.targetQty ?? ''),
      unit:           initial?.unit ?? 'CARTON',
      priority:       initial?.priority ?? 'MEDIUM',
      plannedStart:   toLocalInput(initial?.plannedStart),
      plannedEnd:     toLocalInput(initial?.plannedEnd),
      customer:       initial?.customer ?? '',
      notes:          initial?.notes ?? '',
    });
  }, [open, initial]);

  const { data: skusData } = useQuery({
    queryKey: ['skus-for-po'],
    queryFn: () => api.get('/inventory/products', { params: { limit: 200 } }),
    enabled: open, staleTime: 60_000,
  });
  const skus: any[] = (skusData as any)?.data ?? (skusData as any) ?? [];

  const mut = useMutation({
    mutationFn: (dto: any) => isEdit
      ? api.patch(`/production/production-orders/${initial!.id}`, dto)
      : api.post('/production/production-orders', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-orders'] });
      toast({ title: isEdit ? 'PO updated' : 'PO created', description: form.orderNumber });
      onClose();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message ?? 'Failed' }),
  });

  function handleSubmit() {
    if (!form.orderNumber || !form.skuId || !form.targetQty || !form.plannedStart || !form.plannedEnd) {
      toast({ variant: 'destructive', title: 'Required fields missing' }); return;
    }
    const dto: any = {
      targetQty: parseInt(form.targetQty, 10),
      unit: form.unit, priority: form.priority,
      plannedStart: new Date(form.plannedStart).toISOString(),
      plannedEnd:   new Date(form.plannedEnd).toISOString(),
      customer:     form.customer || undefined,
      notes:        form.notes || undefined,
    };
    if (!isEdit) {
      dto.orderNumber    = form.orderNumber;
      dto.sapOrderNumber = form.sapOrderNumber || undefined;
      dto.skuId          = form.skuId;
    }
    mut.mutate(dto);
  }

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand-400" />
            {isEdit ? `Edit ${initial?.orderNumber}` : 'New Production Order'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {!isEdit && (
            <>
              <div className="space-y-1.5">
                <Label>PO Number *</Label>
                <Input placeholder="PO-NCC-1055" value={form.orderNumber} onChange={e => set('orderNumber', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>SAP / ERP Reference</Label>
                <Input placeholder="SAP-4500012345" value={form.sapOrderNumber} onChange={e => set('sapOrderNumber', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Product (SKU) *</Label>
                <Select value={form.skuId} onValueChange={v => set('skuId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
                  <SelectContent>
                    {skus.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="font-mono text-xs text-muted-foreground mr-2">{s.itemNumber}</span>{s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {isEdit && (
            <div className="col-span-2 p-3 glass-card rounded-lg">
              <p className="text-xs text-muted-foreground">Product</p>
              <p className="text-sm font-medium mt-0.5">{initial?.sku?.name}</p>
              <p className="text-xs font-mono text-muted-foreground">{initial?.sku?.itemNumber}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Target Qty *</Label>
            <Input type="number" min={1} placeholder="1000" value={form.targetQty} onChange={e => set('targetQty', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={form.unit} onValueChange={v => set('unit', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['CARTON', 'BOX', 'PALLET', 'KG', 'PIECE'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Priority *</Label>
            <Select value={form.priority} onValueChange={v => set('priority', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Input placeholder="e.g. Al-Othaim Markets" value={form.customer} onChange={e => set('customer', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Planned Start *</Label>
            <Input type="datetime-local" value={form.plannedStart} onChange={e => set('plannedStart', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Planned End *</Label>
            <Input type="datetime-local" value={form.plannedEnd} onChange={e => set('plannedEnd', e.target.value)} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Optional notes…" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mut.isPending}>
            {mut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Production Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Confirm-with-reason dialog (hold / cancel)
// ─────────────────────────────────────────────────────────────

interface ReasonDialogProps {
  open: boolean; onClose: () => void;
  title: string; description: string; confirmLabel: string; confirmVariant?: 'default' | 'destructive';
  onConfirm: (reason: string) => void; loading?: boolean;
}

function ReasonDialog({ open, onClose, title, description, confirmLabel, confirmVariant = 'default', onConfirm, loading }: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  React.useEffect(() => { if (!open) setReason(''); }, [open]);
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label className="mb-1.5 block">Reason *</Label>
          <Textarea
            rows={3} placeholder="Enter reason…"
            value={reason} onChange={e => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={confirmVariant} onClick={() => onConfirm(reason)} disabled={loading || reason.trim().length < 3}>
            {loading ? 'Processing…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Simple confirm dialog (complete / delete / resume)
// ─────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean; onClose: () => void;
  title: string; description: string; confirmLabel: string; confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void; loading?: boolean;
}

function ConfirmDialog({ open, onClose, title, description, confirmLabel, confirmVariant = 'default', onConfirm, loading }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Create WO from PO Dialog (manual)
// ─────────────────────────────────────────────────────────────

interface CreateWODialogProps { po: ProductionOrder; open: boolean; onClose: () => void; }

function CreateWODialog({ po, open, onClose }: CreateWODialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    plannedQty: String(po.targetQty), priority: po.priority,
    plannedStart: '', plannedEnd: '', notes: '',
  });

  const mut = useMutation({
    mutationFn: (dto: any) => api.post(`/production/production-orders/${po.id}/work-orders`, dto),
    onSuccess: (wo: any) => {
      qc.invalidateQueries({ queryKey: ['production-orders'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      toast({ title: 'Work order created', description: `${wo?.orderNumber ?? 'WO'} → ${po.orderNumber}` });
      onClose();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message ?? 'Failed' }),
  });

  function handleSubmit() {
    if (!form.plannedQty || !form.plannedStart || !form.plannedEnd) {
      toast({ variant: 'destructive', title: 'Required fields missing' }); return;
    }
    mut.mutate({
      plannedQty: parseInt(form.plannedQty, 10),
      priority: form.priority,
      plannedStart: new Date(form.plannedStart).toISOString(),
      plannedEnd:   new Date(form.plannedEnd).toISOString(),
      notes: form.notes || undefined,
    });
  }

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manual Work Order — {po.orderNumber}</DialogTitle>
          <DialogDescription>{po.sku?.name} · Target: {po.targetQty.toLocaleString()} {po.unit}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Planned Qty *</Label>
            <Input type="number" min={1} value={form.plannedQty} onChange={e => set('plannedQty', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => set('priority', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Planned Start *</Label>
            <Input type="datetime-local" value={form.plannedStart} onChange={e => set('plannedStart', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Planned End *</Label>
            <Input type="datetime-local" value={form.plannedEnd} onChange={e => set('plannedEnd', e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Optional…" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mut.isPending}>{mut.isPending ? 'Creating…' : 'Create Work Order'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Auto-Generate WOs Dialog
// ─────────────────────────────────────────────────────────────

interface AutoGenDialogProps { po: ProductionOrder; open: boolean; onClose: () => void; }

function AutoGenDialog({ po, open, onClose }: AutoGenDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [plannedStart, setStart] = useState(toLocalInput(po.plannedStart));
  const [plannedEnd,   setEnd]   = useState(toLocalInput(po.plannedEnd));

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['po-autogen-preview', po.id],
    queryFn: () => api.get(`/production/production-orders/${po.id}/auto-generate-preview`),
    enabled: open,
    staleTime: 0,
  });
  const prev = preview as any;

  const genMut = useMutation({
    mutationFn: () => api.post(`/production/production-orders/${po.id}/auto-generate-work-orders`, {
      plannedStart: new Date(plannedStart).toISOString(),
      plannedEnd:   new Date(plannedEnd).toISOString(),
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['production-orders'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      qc.invalidateQueries({ queryKey: ['job-orders'] });
      const joCount = res?.jobOrdersCreated ?? 0;
      toast({
        title: `Work order created + ${joCount} job order${joCount !== 1 ? 's' : ''} dispatched`,
        description: `Linked to ${po.orderNumber}`,
      });
      onClose();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message ?? 'Failed' }),
  });

  const joSteps: any[] = prev?.jobOrdersToCreate ?? prev?.workOrdersToCreate ?? [];
  const isDispatchMode = prev?.mode === 'dispatch' || joSteps.length > 1;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Auto-Generate Work Order
          </DialogTitle>
          <DialogDescription>
            {po.orderNumber} · {po.sku?.name} · {po.targetQty.toLocaleString()} {po.unit}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Production Start *</Label>
              <Input type="datetime-local" value={plannedStart} onChange={e => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Production End *</Label>
              <Input type="datetime-local" value={plannedEnd} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>

          {/* Preview */}
          {previewLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="shimmer h-10 rounded-lg" />)}
            </div>
          ) : prev ? (
            <div className="space-y-3">
              {/* ISA-95 model explanation + recipe/process badges */}
              <div className="flex items-center gap-3 flex-wrap text-xs">
                {isDispatchMode && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-card border border-purple-500/20">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-purple-300 font-medium">
                      ISA-95: 1 Work Order → {joSteps.length} Job Orders
                    </span>
                  </div>
                )}
                {prev.recipe && (() => {
                  const approved = prev.recipe.status === 'APPROVED';
                  return (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-card border ${approved ? 'border-green-500/20' : 'border-amber-500/20'}`}>
                      {approved
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                      <span className={`font-medium ${approved ? 'text-green-300' : 'text-amber-300'}`}>
                        Recipe: {prev.recipe.code} v{prev.recipe.version}
                        {!approved && <span className="ml-1 opacity-70">({prev.recipe.status})</span>}
                      </span>
                    </div>
                  );
                })()}
                {prev.process && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-card border border-blue-500/20">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-blue-300 font-medium">{prev.process.name}</span>
                    {prev.process.totalCycleTimeMins && (
                      <span className="text-muted-foreground">({prev.process.totalCycleTimeMins} min)</span>
                    )}
                  </div>
                )}
                {!prev.recipe && !prev.process && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-card border border-amber-500/20">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300">No recipe found — using fallback</span>
                  </div>
                )}
              </div>

              {/* Warning */}
              {prev.warning && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {prev.warning}
                </div>
              )}

              {/* Dispatch list preview */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {isDispatchMode ? `Dispatch List — ${joSteps.length} Job Order${joSteps.length !== 1 ? 's' : ''}` : `Work Order Steps (${joSteps.length})`}
                  </span>
                  {isDispatchMode && (
                    <span className="text-xs text-muted-foreground">SCHEDULED → READY on execution</span>
                  )}
                </div>
                {joSteps.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No routing steps found. Assign machines to routing steps first.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        {['#', 'Operation', 'Machine / Cell', 'Qty', 'Est. Duration'].map(h => (
                          <th key={h} className="text-left p-3 text-xs text-muted-foreground font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {joSteps.map((step: any, i: number) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="p-3 text-xs font-mono text-brand-400">{step.stepNumber}</td>
                          <td className="p-3 text-xs font-medium">{step.operationName}</td>
                          <td className="p-3">
                            <div className="flex flex-col gap-0.5">
                              {step.machine ? (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Cpu className="w-3 h-3 text-muted-foreground" />
                                  {step.machine.name}
                                </div>
                              ) : (
                                <span className="text-xs text-amber-400">No machine</span>
                              )}
                              {step.workCenter && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Layers className="w-2.5 h-2.5" />
                                  {step.workCenter.name}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-xs">
                            {(step.plannedQtyOut ?? step.plannedQty ?? po.targetQty).toLocaleString()}
                            {' '}<span className="text-muted-foreground font-medium">{step.outputUnit ?? po.unit}</span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {step.estimatedDurationMins ? `${Math.round(step.estimatedDurationMins)} min` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {prev.existingWOCount > 0 && (
                <p className="text-xs text-amber-400/80">
                  ⚠ This PO already has <span className="font-medium">{prev.existingWOCount}</span> work order(s).
                </p>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => genMut.mutate()}
            disabled={genMut.isPending || !prev?.canGenerate || !plannedStart || !plannedEnd}
            className="gap-2"
          >
            <Zap className="w-3.5 h-3.5" />
            {genMut.isPending
              ? 'Generating…'
              : isDispatchMode
                ? `Generate 1 Work Order + ${joSteps.length} Job Orders`
                : `Generate Work Order`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// PO Action Menu (inline in table row and detail sheet)
// ─────────────────────────────────────────────────────────────

interface POActionsProps {
  po: ProductionOrder;
  onEdit: () => void;
  onDelete: () => void;
  onRelease: () => void;
  onHold: () => void;
  onResume: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onCreateWO: () => void;
  onAutoGen: () => void;
}

function POActionMenu({ po, onEdit, onDelete, onRelease, onHold, onResume, onComplete, onCancel, onCreateWO, onAutoGen }: POActionsProps) {
  const s = po.status;
  const canEdit    = !['COMPLETED', 'CANCELLED'].includes(s);
  const canDelete  = ['PLANNED', 'CANCELLED'].includes(s);
  const canRelease = s === 'PLANNED';
  const canHold    = ['RELEASED', 'IN_PROGRESS'].includes(s);
  const canResume  = s === 'ON_HOLD';
  const canComplete = s === 'IN_PROGRESS';
  const canCancel  = !['COMPLETED', 'CANCELLED'].includes(s);
  const canAddWO   = ['RELEASED', 'IN_PROGRESS'].includes(s);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {canEdit     && <DropdownMenuItem onClick={onEdit}><Pencil className="w-3.5 h-3.5 mr-2" />Edit PO</DropdownMenuItem>}
        {canRelease  && <DropdownMenuItem onClick={onRelease}><SendHorizonal className="w-3.5 h-3.5 mr-2 text-blue-400" />Release</DropdownMenuItem>}
        {canHold     && <DropdownMenuItem onClick={onHold}><PauseCircle className="w-3.5 h-3.5 mr-2 text-amber-400" />Put on Hold</DropdownMenuItem>}
        {canResume   && <DropdownMenuItem onClick={onResume}><Play className="w-3.5 h-3.5 mr-2 text-green-400" />Resume</DropdownMenuItem>}
        {canComplete && <DropdownMenuItem onClick={onComplete}><CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-400" />Mark Completed</DropdownMenuItem>}
        {canAddWO    && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreateWO}><Plus className="w-3.5 h-3.5 mr-2" />Add WO Manually</DropdownMenuItem>
            <DropdownMenuItem onClick={onAutoGen}><Zap className="w-3.5 h-3.5 mr-2 text-yellow-400" />Auto-Generate WOs</DropdownMenuItem>
          </>
        )}
        {(canCancel || canDelete) && <DropdownMenuSeparator />}
        {canCancel   && <DropdownMenuItem onClick={onCancel} className="text-orange-400 focus:text-orange-400"><XCircle className="w-3.5 h-3.5 mr-2" />Cancel PO</DropdownMenuItem>}
        {canDelete   && <DropdownMenuItem onClick={onDelete} className="text-red-400 focus:text-red-400"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────
// WOs list with expandable dispatch list per WO
// ─────────────────────────────────────────────────────────────

interface WOsWithDispatchProps {
  po: ProductionOrder;
  actions: Omit<POActionsProps, 'po'>;
}

function WOsWithDispatch({ po, actions }: WOsWithDispatchProps) {
  const [expandedWO, setExpandedWO] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold">Work Orders ({po.workOrders.length})</p>
        {['RELEASED', 'IN_PROGRESS'].includes(po.status) && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={actions.onCreateWO}>
              <Plus className="w-3 h-3 mr-1" /> Manual
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10" onClick={actions.onAutoGen}>
              <Zap className="w-3 h-3 mr-1" /> Auto-Generate
            </Button>
          </div>
        )}
      </div>

      {po.workOrders.length === 0 ? (
        <div className="glass-card rounded-lg p-4 text-center text-sm text-muted-foreground">
          <ClipboardList className="w-6 h-6 mx-auto mb-2 opacity-40" />
          {po.status === 'PLANNED' ? 'Release this PO first to create work orders.' : 'No work orders yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {po.workOrders.map(wo => {
            const wcfg = WO_STATUS[wo.status] ?? { label: wo.status, color: 'text-muted-foreground', bar: 'bg-slate-500' };
            const pct = woProgress(wo);
            const isExpanded = expandedWO === wo.id;

            return (
              <div key={wo.id} className={cn(
                'glass-card rounded-lg border transition-colors',
                isExpanded ? 'border-brand-500/30' : 'border-white/5',
              )}>
                {/* WO header row */}
                <button
                  className="w-full text-left p-3"
                  onClick={() => setExpandedWO(isExpanded ? null : wo.id)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={cn(
                        'w-3 h-3 text-muted-foreground transition-transform shrink-0',
                        isExpanded && 'rotate-180',
                      )} />
                      <span className="font-mono text-xs text-blue-300">{wo.orderNumber}</span>
                    </div>
                    <span className={cn('text-[10px] font-medium', wcfg.color)}>{wcfg.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-1.5 pl-5">
                    <span>{wo.plannedQty.toLocaleString()} units</span>
                    <span className="flex items-center gap-1 text-brand-400/60">
                      <Layers className="w-3 h-3" />Dispatch List
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-5">
                    <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className={cn('h-full rounded-full', wcfg.bar)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-7 shrink-0">{pct}%</span>
                  </div>
                </button>

                {/* Expandable dispatch list */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-white/5 pt-2">
                    <DispatchListPanel
                      woId={wo.id}
                      woStatus={wo.status}
                      plannedStart={wo.plannedStart}
                      plannedEnd={wo.plannedEnd}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PO Detail Sheet
// ─────────────────────────────────────────────────────────────

interface PODetailSheetProps {
  po: ProductionOrder | null; open: boolean; onClose: () => void;
  actions: Omit<POActionsProps, 'po'>;
}

function PODetailSheet({ po, open, onClose, actions }: PODetailSheetProps) {
  if (!po) return null;
  const cfg = PO_STATUS[po.status];
  const StatusIcon = cfg.icon;
  const progress = poProgress(po);

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-mono">{po.orderNumber}</p>
              {po.sapOrderNumber && <p className="text-[10px] text-muted-foreground">SAP: {po.sapOrderNumber}</p>}
            </div>
            <div className="flex items-center gap-2">
              <div className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full', cfg.bg, cfg.color)}>
                <StatusIcon className="w-3.5 h-3.5" /> {cfg.label}
              </div>
              <POActionMenu po={po} {...actions} />
            </div>
          </div>
          <SheetTitle className="text-lg">{po.sku?.name ?? 'Unknown Product'}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn('text-xs', PRI_CLS[po.priority])}>{po.priority}</Badge>
            {po.customer && <Badge variant="secondary" className="text-xs">{po.customer}</Badge>}
            <Badge variant="outline" className="text-xs font-mono">{po.sku?.itemNumber}</Badge>
          </div>
        </SheetHeader>

        <div className="py-4 space-y-4">
          {/* Progress */}
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Overall Progress</span>
              <span className="text-sm font-bold">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', {
                'bg-green-500': po.status === 'COMPLETED',
                'bg-brand-500': po.status === 'IN_PROGRESS',
                'bg-blue-500': po.status === 'RELEASED',
                'bg-amber-500': po.status === 'ON_HOLD',
                'bg-slate-500': ['PLANNED','CANCELLED'].includes(po.status),
              })} style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{po.completedQty.toLocaleString()} / {po.targetQty.toLocaleString()} {po.unit}</span>
              <span>{po.workOrders.filter(w => w.status !== 'CANCELLED').length} WO(s)</span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: 'Planned Start', value: fmt(po.plannedStart) },
              { label: 'Planned End',   value: fmt(po.plannedEnd) },
              ...(po.actualStart ? [{ label: 'Actual Start', value: fmt(po.actualStart) }] : []),
              ...(po.actualEnd   ? [{ label: 'Actual End',   value: fmt(po.actualEnd)   }] : []),
            ].map(d => (
              <div key={d.label} className="glass-card rounded-lg p-3">
                <div className="text-muted-foreground mb-1">{d.label}</div>
                <div className="font-medium">{d.value}</div>
              </div>
            ))}
          </div>

          {/* ISA-95 flow */}
          <div className="glass-card rounded-lg p-3 border border-brand-500/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">ISA-95 Flow</p>
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-mono text-[10px]">PO {po.orderNumber}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              {po.workOrders.length > 0 ? po.workOrders.map(w => (
                <span key={w.id} className={cn('px-2 py-0.5 rounded font-mono text-[10px]', {
                  'bg-green-500/20 text-green-300': w.status === 'COMPLETED',
                  'bg-brand-500/20 text-brand-300': w.status === 'IN_PROGRESS',
                  'bg-blue-500/20 text-blue-300': w.status === 'RELEASED',
                  'bg-slate-500/20 text-slate-300': w.status === 'PLANNED',
                  'bg-amber-500/20 text-amber-300': w.status === 'ON_HOLD',
                  'bg-red-500/20 text-red-300': w.status === 'CANCELLED',
                })}>{w.orderNumber}</span>
              )) : <span className="text-muted-foreground italic text-[10px]">No work orders yet</span>}
            </div>
          </div>

          {/* Status action buttons */}
          <div className="flex flex-wrap gap-2 p-3 glass-card rounded-lg border border-white/5">
            <p className="w-full text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status Actions</p>
            {po.status === 'PLANNED' && (
              <Button size="sm" variant="outline" className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10" onClick={actions.onRelease}>
                <SendHorizonal className="w-3.5 h-3.5 mr-1.5" /> Release to Shop Floor
              </Button>
            )}
            {['RELEASED', 'IN_PROGRESS'].includes(po.status) && (
              <Button size="sm" variant="outline" className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={actions.onHold}>
                <PauseCircle className="w-3.5 h-3.5 mr-1.5" /> Put on Hold
              </Button>
            )}
            {po.status === 'ON_HOLD' && (
              <Button size="sm" variant="outline" className="text-green-400 border-green-500/30 hover:bg-green-500/10" onClick={actions.onResume}>
                <Play className="w-3.5 h-3.5 mr-1.5" /> Resume
              </Button>
            )}
            {po.status === 'IN_PROGRESS' && (
              <Button size="sm" variant="outline" className="text-green-400 border-green-500/30 hover:bg-green-500/10" onClick={actions.onComplete}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Completed
              </Button>
            )}
            {!['COMPLETED', 'CANCELLED'].includes(po.status) && (
              <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={actions.onCancel}>
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Cancel PO
              </Button>
            )}
          </div>

          {/* WOs section */}
          <WOsWithDispatch po={po} actions={actions} />

          {po.notes && (
            <div className="text-xs text-muted-foreground p-3 glass-card rounded-lg">
              <span className="font-medium text-foreground">Notes: </span>{po.notes}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// Dispatch List Panel (Job Orders for a single Work Order)
// ─────────────────────────────────────────────────────────────

interface DispatchListPanelProps {
  woId: string;
  woStatus: WOStatus;
  plannedStart?: string | null;
  plannedEnd?: string | null;
}

function DispatchListPanel({ woId, woStatus, plannedStart, plannedEnd }: DispatchListPanelProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<JobOrder[]>({
    queryKey: ['job-orders', woId],
    queryFn: () => api.get(`/production/work-orders/${woId}/job-orders`) as any,
    staleTime: 30_000,
  });
  const jobs: JobOrder[] = (data as any) ?? [];

  const genMut = useMutation({
    mutationFn: () => api.post(`/production/work-orders/${woId}/job-orders/generate`, {
      plannedStart: plannedStart ? new Date(plannedStart).toISOString() : undefined,
      plannedEnd:   plannedEnd   ? new Date(plannedEnd).toISOString()   : undefined,
      clearExisting: jobs.length > 0,
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['job-orders', woId] });
      toast({ title: `${res?.created ?? 0} job orders generated` });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message ?? 'Failed' }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/production/job-orders/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-orders', woId] }); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="shimmer h-9 rounded-lg" />)}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-white/3 border border-white/8 text-center">
        <GitBranch className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground opacity-40" />
        <p className="text-xs text-muted-foreground mb-2">No dispatch list yet.</p>
        {['RELEASED', 'IN_PROGRESS', 'PLANNED'].includes(woStatus) && (
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10"
            onClick={() => genMut.mutate()}
            disabled={genMut.isPending}
          >
            {genMut.isPending
              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating…</>
              : <><Zap className="w-3 h-3 mr-1" />Generate from Routing</>}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Dispatch List ({jobs.length} operations)
        </span>
        <Button
          size="sm" variant="ghost"
          className="h-6 text-[10px] text-yellow-400 hover:bg-yellow-500/10 px-2"
          onClick={() => genMut.mutate()}
          disabled={genMut.isPending}
        >
          {genMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </Button>
      </div>

      {/* Chain: each JO as a card */}
      <div className="relative pl-4">
        {/* Vertical connector line */}
        <div className="absolute left-1.5 top-2 bottom-2 w-px bg-white/8" />

        {jobs.map((jo, idx) => {
          const cfg = JO_STATUS[jo.status] ?? JO_STATUS.SCHEDULED;
          const canStart    = jo.status === 'READY';
          const canComplete = jo.status === 'EXECUTING';
          const canPause    = jo.status === 'EXECUTING';
          const canResume   = jo.status === 'PAUSED';

          return (
            <div key={jo.id} className="relative mb-1.5 last:mb-0">
              {/* Connector dot */}
              <div className={cn(
                'absolute -left-3 top-3.5 w-2 h-2 rounded-full border border-background',
                cfg.dot,
              )} />

              <div className={cn(
                'rounded-lg px-3 py-2 border transition-colors',
                jo.status === 'EXECUTING' ? 'border-brand-500/40 bg-brand-500/8' : 'border-white/6 bg-white/3',
              )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {String(jo.sequenceOrder).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-medium truncate">{jo.operationName}</span>
                    {jo.machine && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        <Cpu className="w-2.5 h-2.5" />{jo.machine.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded', cfg.bg, cfg.color)}>
                      {cfg.label}
                    </span>
                    {canStart && (
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-green-400 hover:bg-green-500/15"
                        onClick={() => statusMut.mutate({ id: jo.id, status: 'EXECUTING' })}>
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                    {canPause && (
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-amber-400 hover:bg-amber-500/15"
                        onClick={() => statusMut.mutate({ id: jo.id, status: 'PAUSED' })}>
                        <PauseCircle className="w-3 h-3" />
                      </Button>
                    )}
                    {canResume && (
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-blue-400 hover:bg-blue-500/15"
                        onClick={() => statusMut.mutate({ id: jo.id, status: 'EXECUTING' })}>
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                    {canComplete && (
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-green-400 hover:bg-green-500/15"
                        onClick={() => statusMut.mutate({ id: jo.id, status: 'COMPLETE' })}>
                        <CheckSquare className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sub-row: qty + cycle time */}
                {(jo.plannedQtyOut || jo.idealCycleTimeSec) && (
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    {jo.plannedQtyOut && (
                      <span>Plan: {jo.plannedQtyOut.toLocaleString()} <span className="font-medium text-foreground/70">{jo.outputUnit ?? 'units'}</span></span>
                    )}
                    {jo.actualQtyGood > 0 && (
                      <span className="text-green-400">✓ {jo.actualQtyGood.toLocaleString()} {jo.outputUnit ?? ''}</span>
                    )}
                    {jo.idealCycleTimeSec && (
                      <span>ICT: {jo.idealCycleTimeSec.toFixed(1)}s</span>
                    )}
                  </div>
                )}
              </div>

              {/* Arrow connector between steps */}
              {idx < jobs.length - 1 && (
                <div className="flex items-center justify-center h-2 -mt-0.5 mb-0.5">
                  <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Table Row
// ─────────────────────────────────────────────────────────────

interface PORowProps { po: ProductionOrder; idx: number; onSelect: () => void; actions: Omit<POActionsProps, 'po'>; }

function PORow({ po, idx, onSelect, actions }: PORowProps) {
  const cfg = PO_STATUS[po.status];
  const StatusIcon = cfg.icon;
  const progress = poProgress(po);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      onClick={onSelect}
      className="border-b border-border/30 hover:bg-white/5 cursor-pointer transition-colors"
    >
      <td className="p-3">
        <div className="font-mono text-xs text-brand-400">{po.orderNumber}</div>
        {po.sapOrderNumber && <div className="text-[10px] text-muted-foreground">{po.sapOrderNumber}</div>}
      </td>
      <td className="p-3">
        <div className="text-xs font-medium max-w-[180px] truncate">{po.sku?.name ?? '—'}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{po.sku?.itemNumber}</div>
      </td>
      <td className="p-3">
        <Badge variant="outline" className={cn('text-[10px]', PRI_CLS[po.priority])}>{po.priority}</Badge>
      </td>
      <td className="p-3 text-xs text-muted-foreground max-w-[120px] truncate">{po.customer ?? '—'}</td>
      <td className="p-3">
        <span className="text-xs">{po.targetQty.toLocaleString()}</span>
        <span className="text-[10px] text-muted-foreground ml-1">{po.unit}</span>
      </td>
      <td className="p-3 w-28">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className={cn('h-full rounded-full', {
              'bg-green-500': po.status === 'COMPLETED',
              'bg-brand-500': po.status === 'IN_PROGRESS',
              'bg-blue-500': po.status === 'RELEASED',
              'bg-amber-500': po.status === 'ON_HOLD',
              'bg-slate-500': ['PLANNED','CANCELLED'].includes(po.status),
            })} style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground w-7 shrink-0">{progress}%</span>
        </div>
      </td>
      <td className="p-3">
        <div className={cn('flex items-center gap-1.5 text-xs', cfg.color)}>
          <StatusIcon className="w-3.5 h-3.5" />{cfg.label}
        </div>
      </td>
      <td className="p-3 text-xs text-muted-foreground">{fmt(po.plannedStart)}</td>
      <td className="p-3 text-xs text-muted-foreground">{fmt(po.plannedEnd)}</td>
      <td className="p-3 text-xs text-muted-foreground">{po.workOrders.length}</td>
      <td className="p-3" onClick={e => e.stopPropagation()}>
        <POActionMenu po={po} {...actions} />
      </td>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────
// Main View
// ─────────────────────────────────────────────────────────────

export function ProductionOrdersView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog states
  const [createOpen, setCreateOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<ProductionOrder | null>(null);
  const [detailPO,   setDetailPO]       = useState<ProductionOrder | null>(null);
  const [detailOpen, setDetailOpen]     = useState(false);
  const [createWOFor, setCreateWOFor]   = useState<ProductionOrder | null>(null);
  const [autoGenFor,  setAutoGenFor]    = useState<ProductionOrder | null>(null);
  const [holdFor,     setHoldFor]       = useState<ProductionOrder | null>(null);
  const [cancelFor,   setCancelFor]     = useState<ProductionOrder | null>(null);
  const [deleteFor,   setDeleteFor]     = useState<ProductionOrder | null>(null);
  const [completeFor, setCompleteFor]   = useState<ProductionOrder | null>(null);
  const [resumeFor,   setResumeFor]     = useState<ProductionOrder | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['production-orders', search, statusFilter],
    queryFn: () => api.get('/production/production-orders', {
      params: { search: search || undefined, status: statusFilter === 'all' ? undefined : statusFilter, limit: 100 },
    }),
    staleTime: 30_000,
  });
  const orders: ProductionOrder[] = (data as any)?.data ?? (data as any) ?? [];

  // ── Mutations ──────────────────────────────────────────────

  const releaseMut = useMutation({
    mutationFn: (id: string) => api.patch(`/production/production-orders/${id}/release`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); toast({ title: 'PO Released' }); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message }),
  });

  const holdMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.patch(`/production/production-orders/${id}/hold`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); toast({ title: 'PO on Hold' }); setHoldFor(null); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message }),
  });

  const resumeMut = useMutation({
    mutationFn: (id: string) => api.patch(`/production/production-orders/${id}/resume`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); toast({ title: 'PO Resumed' }); setResumeFor(null); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message }),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => api.patch(`/production/production-orders/${id}/complete`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); toast({ title: 'PO Completed' }); setCompleteFor(null); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message }),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.patch(`/production/production-orders/${id}/cancel`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); toast({ title: 'PO Cancelled' }); setCancelFor(null); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/production/production-orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); toast({ title: 'PO Deleted' }); setDeleteFor(null); setDetailOpen(false); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message }),
  });

  // ── Helper to build actions object for a PO ────────────────

  function actionsFor(po: ProductionOrder): Omit<POActionsProps, 'po'> {
    return {
      onEdit:     () => setEditTarget(po),
      onDelete:   () => setDeleteFor(po),
      onRelease:  () => releaseMut.mutate(po.id),
      onHold:     () => setHoldFor(po),
      onResume:   () => setResumeFor(po),
      onComplete: () => setCompleteFor(po),
      onCancel:   () => setCancelFor(po),
      onCreateWO: () => setCreateWOFor(po),
      onAutoGen:  () => setAutoGenFor(po),
    };
  }

  function openDetail(po: ProductionOrder) { setDetailPO(po); setDetailOpen(true); }

  // KPI counts
  const planned   = orders.filter(p => p.status === 'PLANNED').length;
  const released  = orders.filter(p => p.status === 'RELEASED').length;
  const running   = orders.filter(p => p.status === 'IN_PROGRESS').length;
  const completed = orders.filter(p => p.status === 'COMPLETED').length;

  const kpis = [
    { label: 'Planned',     value: planned,   color: 'text-slate-300',  icon: Clock        },
    { label: 'Released',    value: released,  color: 'text-blue-400',   icon: SendHorizonal },
    { label: 'In Progress', value: running,   color: 'text-brand-400',  icon: RefreshCw    },
    { label: 'Completed',   value: completed, color: 'text-green-400',  icon: CheckCircle2 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Production Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">ISA-95 Level 4 — ERP/Scheduling → Shop Floor execution</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh</Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />New Production Order</Button>
        </div>
      </div>

      {/* ISA-95 flow banner */}
      <div className="glass-card rounded-xl p-4 border border-brand-500/20">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2.5">ISA-95 Manufacturing Data Flow</p>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {[
            { label: 'ERP / SAP', sub: 'Create PO', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
            { label: 'Scheduling', sub: 'Release PO', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
            { label: 'MES', sub: 'Create WO(s)', color: 'bg-brand-500/20 text-brand-300 border-brand-500/30' },
            { label: 'Shop Floor', sub: 'Execute WO', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
            { label: 'Quality', sub: 'Inspection', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
            { label: 'Reporting', sub: 'Back to ERP', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
          ].map((step, i) => (
            <React.Fragment key={step.label}>
              <div className={cn('px-3 py-1.5 rounded-lg border text-center', step.color)}>
                <div className="font-semibold text-[11px]">{step.label}</div>
                <div className="text-[9px] opacity-70">{step.sub}</div>
              </div>
              {i < 5 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <Icon className={cn('w-4 h-4', k.color)} />
              </div>
              <div className={cn('text-3xl font-bold', k.color)}>{k.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search PO, product, customer…" className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all','PLANNED','RELEASED','IN_PROGRESS','COMPLETED','ON_HOLD','CANCELLED'] as const).map(s => (
            <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : PO_STATUS[s as POStatus]?.label ?? s}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['PO Number', 'Product', 'Priority', 'Customer', 'Target Qty', 'Progress', 'Status', 'Planned Start', 'Planned End', 'WOs', ''].map(h => (
                <th key={h} className="text-left p-3 text-muted-foreground font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: 11 }).map((_, j) => <td key={j} className="p-3"><div className="shimmer h-4 rounded w-20" /></td>)}
                  </tr>
                ))
              : orders.length === 0
              ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center">
                    <ClipboardList className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-40" />
                    <p className="text-muted-foreground text-sm">No production orders found</p>
                    <Button size="sm" className="mt-3" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />Create First PO</Button>
                  </td>
                </tr>
              )
              : orders.map((po, i) => (
                  <PORow key={po.id} po={po} idx={i} onSelect={() => openDetail(po)} actions={actionsFor(po)} />
                ))}
          </tbody>
        </table>
      </div>

      {/* ── Dialogs ── */}

      {/* Create */}
      <POFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Edit */}
      <POFormDialog open={!!editTarget} onClose={() => setEditTarget(null)} initial={editTarget} />

      {/* Detail Sheet */}
      <PODetailSheet
        po={detailPO} open={detailOpen}
        onClose={() => setDetailOpen(false)}
        actions={detailPO ? actionsFor(detailPO) : {
          onEdit: () => {}, onDelete: () => {}, onRelease: () => {},
          onHold: () => {}, onResume: () => {}, onComplete: () => {},
          onCancel: () => {}, onCreateWO: () => {}, onAutoGen: () => {},
        }}
      />

      {/* Manual WO */}
      {createWOFor && <CreateWODialog po={createWOFor} open={!!createWOFor} onClose={() => setCreateWOFor(null)} />}

      {/* Auto-generate WOs */}
      {autoGenFor && <AutoGenDialog po={autoGenFor} open={!!autoGenFor} onClose={() => setAutoGenFor(null)} />}

      {/* Hold */}
      <ReasonDialog
        open={!!holdFor} onClose={() => setHoldFor(null)}
        title={`Put ${holdFor?.orderNumber} on Hold`}
        description="Provide a reason for holding this production order."
        confirmLabel="Put on Hold" confirmVariant="default"
        onConfirm={reason => holdMut.mutate({ id: holdFor!.id, reason })}
        loading={holdMut.isPending}
      />

      {/* Cancel */}
      <ReasonDialog
        open={!!cancelFor} onClose={() => setCancelFor(null)}
        title={`Cancel ${cancelFor?.orderNumber}`}
        description="This will cancel the production order. Work orders must not be in progress."
        confirmLabel="Cancel PO" confirmVariant="destructive"
        onConfirm={reason => cancelMut.mutate({ id: cancelFor!.id, reason })}
        loading={cancelMut.isPending}
      />

      {/* Complete */}
      <ConfirmDialog
        open={!!completeFor} onClose={() => setCompleteFor(null)}
        title={`Complete ${completeFor?.orderNumber}?`}
        description="This will mark the production order as COMPLETED and set the actual end time."
        confirmLabel="Mark Completed" confirmVariant="default"
        onConfirm={() => completeMut.mutate(completeFor!.id)}
        loading={completeMut.isPending}
      />

      {/* Resume */}
      <ConfirmDialog
        open={!!resumeFor} onClose={() => setResumeFor(null)}
        title={`Resume ${resumeFor?.orderNumber}?`}
        description="This will resume the production order from ON_HOLD."
        confirmLabel="Resume" confirmVariant="default"
        onConfirm={() => resumeMut.mutate(resumeFor!.id)}
        loading={resumeMut.isPending}
      />

      {/* Delete */}
      <ConfirmDialog
        open={!!deleteFor} onClose={() => setDeleteFor(null)}
        title={`Delete ${deleteFor?.orderNumber}?`}
        description="This will permanently remove this production order. Only PLANNED or CANCELLED orders without active work orders can be deleted."
        confirmLabel="Delete" confirmVariant="destructive"
        onConfirm={() => deleteMut.mutate(deleteFor!.id)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
