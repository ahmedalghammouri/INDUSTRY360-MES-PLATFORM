'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus, Download, Filter, Search, Play, Pause,
  CheckCircle, Pencil, Trash2, XCircle, ChevronDown,
  Factory, Cpu, User, Clock, BarChart3, Package,
  ClipboardCheck, CheckCircle2, AlertCircle, Layers,
  CheckSquare, Circle, GitBranch,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FormDialog } from '@/components/ui/form-dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { TableRowActions } from '@/components/ui/table-row-actions';
import { api } from '@/services/api.client';
import { cn, formatDate, formatPercent } from '@/lib/utils';
import { TablePagination } from '@/components/ui/table-pagination';
import { SortableHeader } from '@/components/ui/sortable-header';
import { useSortedData } from '@/lib/use-sorted-data';

const STATUS_COLORS: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  PLANNED: 'secondary', RELEASED: 'secondary', IN_PROGRESS: 'default',
  COMPLETED: 'default', ON_HOLD: 'outline', CANCELLED: 'destructive',
};
const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planned', RELEASED: 'Released', IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed', ON_HOLD: 'On Hold', CANCELLED: 'Cancelled',
};
const PRIORITY_CLS: Record<string, string> = {
  CRITICAL: 'border-red-500 text-red-400', HIGH: 'border-orange-500 text-orange-400',
  MEDIUM: 'border-yellow-500 text-yellow-400', LOW: 'border-slate-500 text-slate-400',
};

interface WorkOrder {
  id: string; orderNumber: string; status: string; priority: string;
  productName: string; productCode: string; machine: string; machineCode: string;
  line: string; operator: string; supervisor: string;
  plannedQty: number; actualQty: number; goodQty: number; scrapQty: number; reworkQty?: number;
  progress: number; oee?: number; availability?: number; performance?: number; quality?: number;
  plannedStart: string; plannedEnd: string; actualStart?: string; actualEnd?: string;
}

interface WorkOrderDetail extends WorkOrder {
  sku?: { name: string; code: string; itemNumber?: string };
  machine_obj?: { name: string; code: string; area?: { name: string }; line?: { name: string } };
  operator_obj?: { name: string; email: string };
  supervisor_obj?: { name: string; email: string };
  productionOrder?: { orderNumber: string; sapOrderNumber?: string };
  batchRecords?: { id: string; batchNumber: string; status: string }[];
  downtimeMinutes?: number; notes?: string;
}

const EMPTY_FORM = {
  skuId: '__none__', operatorId: '__none__',
  plannedQty: '', plannedStart: '', plannedEnd: '', priority: 'MEDIUM', notes: '',
};

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="industrial-card rounded-lg p-3 text-center">
      <div className={cn('text-xl font-bold tabular-nums', color)}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/20 last:border-0">
      <span className="text-[11px] text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs font-medium flex-1">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

const INSP_RESULT: Record<string, { label: string; cls: string; Icon: any }> = {
  PASS:        { label: 'Pass',        cls: 'text-green-400', Icon: CheckCircle2 },
  FAIL:        { label: 'Fail',        cls: 'text-red-400',   Icon: XCircle      },
  CONDITIONAL: { label: 'Conditional', cls: 'text-amber-400', Icon: AlertCircle  },
};

function WorkOrderQualityPanel({ workOrderId, machineId }: { workOrderId: string; machineId?: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ type: 'IN_PROCESS', planId: '__none__', totalQty: '', passQty: '', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['quality', 'wo-inspections', workOrderId],
    queryFn: () => api.get(`/quality/work-orders/${workOrderId}/inspections`),
    staleTime: 30_000,
  });

  const { data: plansData } = useQuery({
    queryKey: ['quality', 'plans', 'selector'],
    queryFn: () => api.get('/quality/plans', { params: { isActive: 'true', limit: 100 } }),
    staleTime: 300_000,
    enabled: addOpen,
  });

  const createInspMutation = useMutation({
    mutationFn: (dto: any) => api.post('/quality/inspections', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'wo-inspections', workOrderId] });
      toast({ title: 'Inspection recorded' });
      setAddOpen(false);
      setAddForm({ type: 'IN_PROCESS', planId: '__none__', totalQty: '', passQty: '', notes: '' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to save inspection', variant: 'destructive' }),
  });

  const plans: any[] = (plansData as any) ?? [];
  const inspections: any[] = (data as any) ?? [];
  const passCount = inspections.filter(i => i.result === 'PASS').length;
  const failCount = inspections.filter(i => i.result === 'FAIL').length;
  const overallPass = inspections.length > 0 && failCount === 0;

  const totalNum = parseInt(addForm.totalQty || '0', 10);
  const passNum = parseInt(addForm.passQty || '0', 10);
  const failNum = Math.max(0, totalNum - passNum);
  const passRate = totalNum > 0 ? Math.round((passNum / totalNum) * 100) : 0;
  const predictedResult = passRate >= 95 ? 'PASS' : passRate >= 80 ? 'CONDITIONAL' : 'FAIL';
  const resultCls = predictedResult === 'PASS' ? 'text-green-400' : predictedResult === 'CONDITIONAL' ? 'text-amber-400' : 'text-red-400';
  const isAddValid = totalNum > 0 && passNum >= 0 && passNum <= totalNum;

  const handleAddInsp = () => {
    if (!isAddValid) return;
    const dto: any = {
      type: addForm.type,
      workOrderId,
      totalQty: totalNum,
      passQty: passNum,
      failQty: failNum,
      notes: addForm.notes || undefined,
    };
    if (machineId) dto.machineId = machineId;
    if (addForm.planId !== '__none__') dto.planId = addForm.planId;
    createInspMutation.mutate(dto);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ClipboardCheck size={12} className="text-primary" />
          Quality Inspections (ISA-95)
        </p>
        <div className="flex items-center gap-2">
          {inspections.length > 0 && (
            <Badge
              variant="outline"
              className={cn('text-[10px] h-4', overallPass ? 'text-green-400 border-green-500/30' : failCount > 0 ? 'text-red-400 border-red-500/30' : 'text-amber-400 border-amber-500/30')}
            >
              {passCount}/{inspections.length} Pass
            </Badge>
          )}
          <Button size="sm" variant="outline" className="h-5 text-[10px] px-2 gap-1" onClick={() => setAddOpen(true)}>
            <Plus size={10} />Add
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="shimmer h-10 rounded-lg" />
      ) : inspections.length === 0 ? (
        <div className="industrial-card rounded-lg px-3 py-2 text-xs text-muted-foreground text-center">
          No inspections yet —{' '}
          <button className="text-primary underline underline-offset-2" onClick={() => setAddOpen(true)}>add one</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {inspections.map((ins: any) => {
            const r = INSP_RESULT[ins.result] ?? INSP_RESULT.CONDITIONAL;
            const RIcon = r.Icon;
            return (
              <div key={ins.id} className="industrial-card rounded-lg px-3 py-2 flex items-center gap-3">
                <RIcon size={13} className={r.cls} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-primary">{ins.inspectionNumber}</span>
                    <Badge variant="outline" className="text-[9px] h-4">{ins.type}</Badge>
                    {ins.plan && <span className="text-[10px] text-muted-foreground truncate">{ins.plan.name}</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Pass: {ins.passQty} · Fail: {ins.failQty} · Total: {ins.totalQty}
                    {ins.inspector && ` · ${ins.inspector.name}`}
                  </div>
                </div>
                <span className={cn('text-[10px] font-semibold', r.cls)}>{r.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Inspection Dialog ── */}
      <Dialog open={addOpen} onOpenChange={o => !o && setAddOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck size={14} className="text-primary" />
              Add Quality Inspection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs">Inspection Type *</Label>
              <Select value={addForm.type} onValueChange={v => setAddForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['INCOMING', 'IN_PROCESS', 'FINAL', 'PATROL', 'AUDIT'].map(t => (
                    <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Quality Plan <span className="text-muted-foreground">(optional)</span></Label>
              <Select value={addForm.planId} onValueChange={v => setAddForm(f => ({ ...f, planId: v }))}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="— Select plan —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No plan —</SelectItem>
                  {plans.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} <span className="text-muted-foreground">({p.code})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Total Qty Inspected *</Label>
                <Input
                  type="number" min={1}
                  value={addForm.totalQty}
                  onChange={e => setAddForm(f => ({ ...f, totalQty: e.target.value }))}
                  className="mt-1 h-8 text-xs"
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <Label className="text-xs">Passed Qty *</Label>
                <Input
                  type="number" min={0}
                  value={addForm.passQty}
                  onChange={e => setAddForm(f => ({ ...f, passQty: e.target.value }))}
                  className="mt-1 h-8 text-xs"
                  placeholder="e.g. 9"
                />
              </div>
            </div>
            {addForm.totalQty && addForm.passQty && (
              <div className="industrial-card rounded-md px-3 py-2 text-[10px] flex items-center gap-3">
                <span className="text-muted-foreground">Failed: <span className="font-semibold text-foreground">{failNum}</span></span>
                <span className="text-muted-foreground">Pass rate: <span className="font-semibold text-foreground">{passRate}%</span></span>
                <span className="text-muted-foreground">→ Result: <span className={cn('font-bold', resultCls)}>{predictedResult}</span></span>
              </div>
            )}
            <div>
              <Label className="text-xs">Notes</Label>
              <Input
                value={addForm.notes}
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes…"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={!isAddValid || createInspMutation.isPending} onClick={handleAddInsp}>
              {createInspMutation.isPending ? 'Saving…' : 'Record Inspection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ProductionWorkOrdersView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editWO, setEditWO] = useState<WorkOrder | null>(null);
  const [editForm, setEditForm] = useState({ plannedQty: '', priority: 'MEDIUM', notes: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [holdDialog, setHoldDialog] = useState<{ woId: string; orderNumber: string } | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [completeDialog, setCompleteDialog] = useState<{ woId: string; orderNumber: string; plannedQty: number } | null>(null);
  const [completeForm, setCompleteForm] = useState({ actualQty: '', goodQty: '' });
  const [cancelDialog, setCancelDialog] = useState<{ woId: string; orderNumber: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; orderNumber: string } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [sortCol, setSortCol] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const handleSort = (col: string) => {
    if (col === sortCol) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const { data: workOrdersData, isLoading } = useQuery({
    queryKey: ['production', 'work-orders', { search, status: statusFilter, page, sortCol, sortDir }],
    queryFn: () => api.get('/production/work-orders', {
      params: { search: search || undefined, status: statusFilter || undefined, limit: 20, page, sortBy: sortCol, sortOrder: sortDir },
    }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const orders: WorkOrder[] = (workOrdersData as any)?.data ?? [];
  const total: number = (workOrdersData as any)?.total ?? 0;

  const { sortedData: sortedOrders } = useSortedData(orders, 'createdAt', 'desc');

  const { data: woDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['production', 'work-orders', viewId],
    queryFn: () => api.get(`/production/work-orders/${viewId}`),
    enabled: !!viewId,
    staleTime: 15_000,
    refetchInterval: viewId ? 15_000 : false,
  });
  const detail = woDetail as WorkOrderDetail | undefined;

  const { data: skusData } = useQuery({
    queryKey: ['inventory', 'products', 'wo-form'],
    queryFn: () => api.get('/inventory/products', { params: { limit: 200 } }),
    staleTime: 300_000, enabled: formOpen,
  });
  const { data: usersData } = useQuery({
    queryKey: ['users', 'wo-form'],
    queryFn: () => api.get('/users', { params: { limit: 100 } }),
    staleTime: 300_000, enabled: formOpen,
  });

  const skus: any[] = (skusData as any)?.data ?? (skusData as any) ?? [];
  const users: any[] = (usersData as any)?.data ?? (usersData as any) ?? [];

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/production/work-orders', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] });
      toast({ title: 'Work order created' });
      setFormOpen(false); setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/production/work-orders/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] });
      toast({ title: 'Work order updated' }); setEditWO(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/production/work-orders/${id}/start`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] }); toast({ title: 'Work order started' }); },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/production/work-orders/${id}/release`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] }); toast({ title: 'Work order resumed' }); },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const holdMutation = useMutation({
    mutationFn: ({ woId, reason }: { woId: string; reason: string }) => api.patch(`/production/work-orders/${woId}/hold`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] });
      setHoldDialog(null); setHoldReason(''); toast({ title: 'Work order placed on hold' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const completeMutation = useMutation({
    mutationFn: ({ woId, dto }: { woId: string; dto: any }) => api.patch(`/production/work-orders/${woId}/complete`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] });
      setCompleteDialog(null); setCompleteForm({ actualQty: '', goodQty: '' });
      toast({ title: 'Work order completed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ woId, reason }: { woId: string; reason: string }) => api.patch(`/production/work-orders/${woId}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] });
      setCancelDialog(null); setCancelReason(''); toast({ title: 'Work order cancelled' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/production/work-orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', 'work-orders'] });
      toast({ title: 'Work order deleted' }); setDeleteDialog(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const handleCreate = () => {
    if (form.skuId === '__none__' || !form.plannedQty) return;
    createMutation.mutate({
      skuId: form.skuId,
      operatorId: form.operatorId !== '__none__' ? form.operatorId : undefined,
      plannedQty: parseInt(form.plannedQty, 10), priority: form.priority,
      plannedStart: form.plannedStart ? new Date(form.plannedStart).toISOString() : new Date().toISOString(),
      plannedEnd: form.plannedEnd ? new Date(form.plannedEnd).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      notes: form.notes || undefined,
    });
  };

  const oeeColor = (v?: number) => v == null ? '' : v >= 85 ? 'text-green-400' : v >= 65 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Work Orders</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage production work orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Download size={13} />Export</Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { setForm(EMPTY_FORM); setFormOpen(true); }}>
            <Plus size={13} />New Work Order
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto p-6">
        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold">All Work Orders</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search orders…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="h-8 pl-7 w-48 text-xs" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Filter size={12} />{statusFilter ? STATUS_LABELS[statusFilter] : 'All Status'}<ChevronDown size={11} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => { setStatusFilter(null); setPage(1); }}>All Status</DropdownMenuItem>
                  {Object.keys(STATUS_LABELS).map(s => (
                    <DropdownMenuItem key={s} onClick={() => { setStatusFilter(s); setPage(1); }}>{STATUS_LABELS[s]}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <SortableHeader column="woNumber" label="Order #" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader column="woNumber" label="Product" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader column="status" label="Status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader column="priority" label="Priority" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader column="progress" label="Progress" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader column="plannedQty" label="Qty" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader column="plannedEnd" label="Planned End" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader column="oee" label="OEE" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}><div className="shimmer h-3.5 rounded w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">No work orders found</TableCell>
                  </TableRow>
                ) : sortedOrders.map(order => {
                  const progress = order.progress ?? (order.plannedQty > 0 ? Math.min(Math.round((order.actualQty / order.plannedQty) * 100), 100) : 0);
                  const canEdit = !['COMPLETED', 'CANCELLED'].includes(order.status);
                  const canDelete = ['PLANNED', 'RELEASED', 'ON_HOLD', 'CANCELLED'].includes(order.status);
                  return (
                    <TableRow key={order.id} className="border-border/20 hover:bg-muted/20">
                      <TableCell className="font-mono text-xs font-semibold text-primary">{order.orderNumber}</TableCell>
                      <TableCell>
                        <div className="text-xs font-medium truncate max-w-[120px]">{order.productName || '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{order.productCode}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[order.status] ?? 'secondary'} className="text-[10px] h-5">
                          {STATUS_LABELS[order.status] ?? order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-[10px] h-5', PRIORITY_CLS[order.priority] ?? '')}>
                          {order.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[90px]">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{progress}%</span>
                        </div>
                        {(order as any).totalSteps > 0 && (
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {(order as any).completedSteps}/{(order as any).totalSteps} steps
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-semibold">{(order as any).goodQty ?? order.actualQty}</span>
                        <span className="text-muted-foreground">/{order.plannedQty}</span>
                        {(order as any).scrapQty > 0 && (
                          <span className="text-red-400 text-[10px] ml-1">+{(order as any).scrapQty}✗</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {order.plannedEnd ? formatDate(order.plannedEnd) : '—'}
                      </TableCell>
                      <TableCell>
                        {order.oee != null && (
                          <span className={cn('text-xs font-semibold tabular-nums', oeeColor(order.oee))}>
                            {formatPercent(order.oee)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <TableRowActions
                          onView={() => setViewId(order.id)}
                          onEdit={canEdit ? () => { setEditWO(order); setEditForm({ plannedQty: String(order.plannedQty), priority: order.priority, notes: '' }); } : undefined}
                          onDelete={canDelete ? () => setDeleteDialog({ id: order.id, orderNumber: order.orderNumber }) : undefined}
                          extraActions={[
                            {
                              label: 'Start Order',
                              icon: Play,
                              onClick: () => startMutation.mutate(order.id),
                              variant: 'success',
                              hidden: !['PLANNED', 'RELEASED'].includes(order.status),
                            },
                            {
                              label: 'Resume',
                              icon: Play,
                              onClick: () => releaseMutation.mutate(order.id),
                              variant: 'success',
                              hidden: order.status !== 'ON_HOLD',
                            },
                            {
                              label: 'Complete',
                              icon: CheckCircle,
                              onClick: () => { setCompleteDialog({ woId: order.id, orderNumber: order.orderNumber, plannedQty: order.plannedQty }); setCompleteForm({ actualQty: String(order.plannedQty), goodQty: '' }); },
                              variant: 'success',
                              hidden: order.status !== 'IN_PROGRESS',
                            },
                            {
                              label: 'Hold',
                              icon: Pause,
                              onClick: () => setHoldDialog({ woId: order.id, orderNumber: order.orderNumber }),
                              variant: 'warning',
                              hidden: order.status !== 'IN_PROGRESS',
                            },
                            {
                              label: 'Cancel',
                              icon: XCircle,
                              onClick: () => { setCancelDialog({ woId: order.id, orderNumber: order.orderNumber }); setCancelReason(''); },
                              variant: 'destructive',
                              separator: true,
                              hidden: !['PLANNED', 'RELEASED', 'IN_PROGRESS', 'ON_HOLD'].includes(order.status),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} total={total} limit={20} onPageChange={setPage} isLoading={isLoading} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          DETAIL SHEET
      ══════════════════════════════════════════════ */}
      <Sheet open={!!viewId} onOpenChange={o => !o && setViewId(null)}>
        <SheetContent className="w-full max-w-xl">
          <SheetHeader>
            {detail ? (
              <>
                <div className="flex items-center gap-3 pr-6">
                  <div className="flex-1">
                    <SheetTitle className="font-mono text-sm">{detail.orderNumber}</SheetTitle>
                    <SheetDescription className="mt-0.5">{detail.productName || (detail as any).sku?.name || '—'}</SheetDescription>
                  </div>
                  <Badge variant={STATUS_COLORS[(detail as any).status] ?? 'secondary'}>
                    {STATUS_LABELS[(detail as any).status] ?? (detail as any).status}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[10px]', PRIORITY_CLS[(detail as any).priority] ?? '')}>
                    {(detail as any).priority}
                  </Badge>
                </div>
              </>
            ) : (
              <SheetTitle>Work Order Details</SheetTitle>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {detailLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="shimmer h-4 rounded w-full" />)}
              </div>
            ) : detail ? (
              <>
                {/* OEE Metrics */}
                {((detail as any).oee != null) && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">OEE Metrics</p>
                    <div className="grid grid-cols-4 gap-2">
                      <MetricCard label="OEE" value={`${(detail as any).oee?.toFixed(1)}%`} color={oeeColor((detail as any).oee)} />
                      <MetricCard label="Availability" value={`${(detail as any).availability?.toFixed(1)}%`} />
                      <MetricCard label="Performance" value={`${(detail as any).performance?.toFixed(1)}%`} />
                      <MetricCard label="Quality" value={`${(detail as any).quality?.toFixed(1)}%`} />
                    </div>
                  </div>
                )}

                {/* Production Progress — ISA-95 correct */}
                {(() => {
                  const d = detail as any;
                  const completedSteps = d.completedSteps ?? 0;
                  const totalSteps     = d.totalSteps     ?? d.jobOrders?.length ?? 0;
                  const stepPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                  const good   = d.liveGoodQty  ?? d.goodQty  ?? 0;
                  const scrap  = d.liveScrapQty ?? d.scrapQty ?? 0;
                  const actual = d.liveActualQty ?? d.actualQty ?? 0;
                  // Qty-based % for the final output vs WO planned
                  const qtyPct = d.plannedQty > 0 ? Math.min(Math.round((good / d.plannedQty) * 100), 100) : 0;
                  // Unit of the last JO = WO output unit
                  const lastJO = d.jobOrders?.[d.jobOrders.length - 1];
                  const unit = lastJO?.outputUnit ?? '';
                  return (
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Production Progress</p>
                      <div className="industrial-card rounded-lg p-3 space-y-3">
                        {/* Step completion bar */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">Steps completed</span>
                            <span className="text-[10px] font-semibold">{completedSteps} / {totalSteps}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${stepPct}%` }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums w-10 text-right">{stepPct}%</span>
                          </div>
                        </div>
                        {/* Output qty bar (final step vs WO planned) */}
                        {d.plannedQty > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground">Final output vs planned</span>
                              <span className="text-[10px] font-semibold">{good} / {d.plannedQty} {unit}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-green-500/70 rounded-full transition-all" style={{ width: `${qtyPct}%` }} />
                              </div>
                              <span className="text-xs font-semibold tabular-nums text-green-400 w-10 text-right">{qtyPct}%</span>
                            </div>
                          </div>
                        )}
                        {/* KPIs */}
                        <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-border/30">
                          {[
                            { label: 'Planned',       value: `${d.plannedQty}`,       sub: unit },
                            { label: 'Output (last)', value: `${actual}`,              sub: unit,  color: 'text-foreground' },
                            { label: 'Good',          value: `${good}`,               sub: unit,  color: 'text-green-400' },
                            { label: 'Total Scrap',   value: `${scrap}`,              sub: 'all steps', color: scrap > 0 ? 'text-red-400' : '' },
                          ].map(m => (
                            <div key={m.label}>
                              <div className={cn('text-base font-bold tabular-nums', (m as any).color)}>{m.value}</div>
                              <div className="text-[10px] text-muted-foreground">{m.label}</div>
                              {(m as any).sub && <div className="text-[9px] text-muted-foreground/60">{(m as any).sub}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Dispatch List (Job Orders) */}
                {((detail as any).jobOrders?.length > 0) && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Layers className="w-3 h-3" />Dispatch List (ISA-95)
                    </p>
                    <div className="space-y-1.5">
                      {(detail as any).jobOrders.map((jo: any) => {
                        const joProgress = jo.plannedQty > 0 ? Math.min(Math.round((jo.actualQtyGood / jo.plannedQty) * 100), 100) : 0;
                        const statusColor: Record<string, string> = {
                          EXECUTING: 'text-green-400', COMPLETE: 'text-blue-400',
                          PAUSED: 'text-yellow-400', READY: 'text-muted-foreground',
                          PENDING: 'text-muted-foreground/60',
                        };
                        const statusIcon: Record<string, React.ReactNode> = {
                          EXECUTING: <Circle className="w-2 h-2 fill-green-400 text-green-400" />,
                          COMPLETE:  <CheckSquare className="w-2.5 h-2.5 text-blue-400" />,
                          PAUSED:    <Circle className="w-2 h-2 fill-yellow-400 text-yellow-400" />,
                          READY:     <Circle className="w-2 h-2 text-muted-foreground" />,
                        };
                        return (
                          <div key={jo.id} className="industrial-card rounded-lg px-3 py-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{jo.sequenceOrder}</span>
                                {jo.stepType === 'SS' && (
                                  <span className="text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-400/30 rounded px-1">SS</span>
                                )}
                                <span className="text-xs font-semibold truncate">{jo.operationName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {statusIcon[jo.status] ?? <Circle className="w-2 h-2 text-muted-foreground/40" />}
                                <span className={cn('text-[10px] font-medium', statusColor[jo.status] ?? 'text-muted-foreground')}>
                                  {jo.status}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${joProgress}%` }} />
                              </div>
                              <span className="text-[10px] tabular-nums text-muted-foreground">
                                <span className="text-foreground font-medium">{jo.actualQtyGood}</span>
                                {jo.actualQtyRejected > 0 && (
                                  <span className="text-red-400"> +{jo.actualQtyRejected}✗</span>
                                )}
                                <span> / {jo.plannedQty} {jo.outputUnit}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              {jo.machine && (
                                <span className="flex items-center gap-1">
                                  <Cpu className="w-2.5 h-2.5" />{jo.machine.name}
                                </span>
                              )}
                              {jo.operator && (
                                <span className="flex items-center gap-1">
                                  <User className="w-2.5 h-2.5" />{jo.operator.name}
                                </span>
                              )}
                            </div>
                            {(jo.joOEE != null || jo.joQuality != null || jo.joPerformance != null || jo.joAvailability != null) && (
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {jo.joQuality != null && (
                                  <span className="text-[9px] font-bold px-1 py-0.5 rounded border text-green-400 bg-green-400/10 border-green-400/30 tabular-nums">
                                    Q: {jo.joQuality.toFixed(1)}%
                                  </span>
                                )}
                                {jo.joPerformance != null && (
                                  <span className="text-[9px] font-bold px-1 py-0.5 rounded border text-blue-400 bg-blue-400/10 border-blue-400/30 tabular-nums">
                                    P: {jo.joPerformance.toFixed(1)}%
                                  </span>
                                )}
                                {jo.joAvailability != null && (
                                  <span className="text-[9px] font-bold px-1 py-0.5 rounded border text-yellow-400 bg-yellow-400/10 border-yellow-400/30 tabular-nums">
                                    A: {jo.joAvailability.toFixed(1)}%
                                  </span>
                                )}
                                {jo.joOEE != null && (
                                  <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded border tabular-nums', jo.joOEE >= 85 ? 'text-green-400 bg-green-400/10 border-green-400/30' : jo.joOEE >= 60 ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' : 'text-red-400 bg-red-400/10 border-red-400/30')}>
                                    OEE: {jo.joOEE.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Details */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Order Details</p>
                  <div className="industrial-card rounded-lg px-3">
                    <DetailRow label="Product" value={(detail as any).sku?.name ?? (detail as any).productName} />
                    <DetailRow label="SKU Code" value={(detail as any).sku?.code ?? (detail as any).productCode} />
                    <DetailRow label="Item #" value={(detail as any).sku?.itemNumber} />
                    <DetailRow label="Production Line" value={(detail as any).line?.name ?? (detail as any).line} />
                    <DetailRow label="Operator" value={(detail as any).operator?.name ?? (detail as any).operator} />
                    <DetailRow label="Supervisor" value={(detail as any).supervisor?.name ?? (detail as any).supervisor} />
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timeline</p>
                  <div className="industrial-card rounded-lg px-3">
                    <DetailRow label="Planned Start" value={(detail as any).plannedStart ? formatDate((detail as any).plannedStart) : undefined} />
                    <DetailRow label="Planned End" value={(detail as any).plannedEnd ? formatDate((detail as any).plannedEnd) : undefined} />
                    <DetailRow label="Actual Start" value={(detail as any).actualStart ? formatDate((detail as any).actualStart) : undefined} />
                    <DetailRow label="Actual End" value={(detail as any).actualEnd ? formatDate((detail as any).actualEnd) : undefined} />
                    <DetailRow label="Downtime" value={(detail as any).downtimeMinutes != null ? `${(detail as any).downtimeMinutes} min` : undefined} />
                  </div>
                </div>

                {/* Linked batches */}
                {(detail as any).batchRecords?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Linked Batches</p>
                    <div className="space-y-1.5">
                      {(detail as any).batchRecords.map((b: any) => (
                        <div key={b.id} className="industrial-card rounded-lg px-3 py-2 flex items-center justify-between">
                          <span className="font-mono text-xs text-primary">{b.batchNumber}</span>
                          <Badge variant="outline" className="text-[10px] h-4">{b.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quality Inspections (ISA-95 integration) */}
                <WorkOrderQualityPanel workOrderId={(detail as any).id} machineId={(detail as any).machineId ?? (detail as any).machine?.id} />

                {/* Notes */}
                {(detail as any).notes && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                    <div className="industrial-card rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">{(detail as any).notes}</p>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Quick actions */}
          {detail && (
            <div className="px-6 py-3 border-t border-border/50 flex items-center gap-2 shrink-0">
              {['PLANNED', 'RELEASED'].includes((detail as any).status) && (
                <Button size="sm" className="gap-1.5 text-xs h-7 bg-green-600 hover:bg-green-700" onClick={() => { startMutation.mutate((detail as any).id); setViewId(null); }}>
                  <Play size={11} />Start
                </Button>
              )}
              {(detail as any).status === 'ON_HOLD' && (
                <Button size="sm" className="gap-1.5 text-xs h-7 bg-green-600 hover:bg-green-700" onClick={() => { releaseMutation.mutate((detail as any).id); setViewId(null); }}>
                  <Play size={11} />Resume
                </Button>
              )}
              {(detail as any).status === 'IN_PROGRESS' && (
                <>
                  <Button size="sm" className="gap-1.5 text-xs h-7 bg-green-600 hover:bg-green-700"
                    onClick={() => { setViewId(null); setCompleteDialog({ woId: (detail as any).id, orderNumber: (detail as any).orderNumber, plannedQty: (detail as any).plannedQty }); setCompleteForm({ actualQty: String((detail as any).plannedQty), goodQty: '' }); }}>
                    <CheckCircle size={11} />Complete
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7"
                    onClick={() => { setViewId(null); setHoldDialog({ woId: (detail as any).id, orderNumber: (detail as any).orderNumber }); }}>
                    <Pause size={11} />Hold
                  </Button>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ══ Create Form ══ */}
      <FormDialog open={formOpen} onClose={() => setFormOpen(false)} title="Create Work Order"
        onSubmit={handleCreate} isSubmitting={createMutation.isPending}
        isValid={form.skuId !== '__none__' && !!form.plannedQty}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Product (SKU) *</Label>
            <Select value={form.skuId} onValueChange={v => setForm(f => ({ ...f, skuId: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select product…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select product —</SelectItem>
                {skus.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code ?? s.sku ?? ''})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Operator</Label>
            <Select value={form.operatorId} onValueChange={v => setForm(f => ({ ...f, operatorId: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Assign operator…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Unassigned —</SelectItem>
                {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Planned Quantity *</Label>
            <Input type="number" min={1} value={form.plannedQty} onChange={e => setForm(v => ({ ...v, plannedQty: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Planned Start</Label>
            <Input type="datetime-local" value={form.plannedStart} onChange={e => setForm(v => ({ ...v, plannedStart: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Planned End</Label>
            <Input type="datetime-local" value={form.plannedEnd} onChange={e => setForm(v => ({ ...v, plannedEnd: e.target.value }))} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} placeholder="Optional notes…" className="mt-1" />
          </div>
        </div>
      </FormDialog>

      {/* ══ Edit Dialog ══ */}
      <Dialog open={!!editWO} onOpenChange={o => !o && setEditWO(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Edit — {editWO?.orderNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Planned Quantity</Label>
              <Input type="number" min={1} value={editForm.plannedQty} onChange={e => setEditForm(f => ({ ...f, plannedQty: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={editForm.priority} onValueChange={v => setEditForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Update notes…" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditWO(null)}>Cancel</Button>
            <Button size="sm" disabled={!editForm.plannedQty || updateMutation.isPending}
              onClick={() => editWO && updateMutation.mutate({ id: editWO.id, dto: { plannedQty: parseInt(editForm.plannedQty, 10), priority: editForm.priority, notes: editForm.notes || undefined } })}>
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Complete Dialog ══ */}
      <Dialog open={!!completeDialog} onOpenChange={o => !o && setCompleteDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Complete — {completeDialog?.orderNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Actual Quantity Produced *</Label>
              <Input type="number" min={0} value={completeForm.actualQty} onChange={e => setCompleteForm(f => ({ ...f, actualQty: e.target.value }))} placeholder={`Planned: ${completeDialog?.plannedQty}`} className="mt-1" />
            </div>
            <div>
              <Label>Good Quantity <span className="text-muted-foreground text-[10px]">(defaults to actual)</span></Label>
              <Input type="number" min={0} value={completeForm.goodQty} onChange={e => setCompleteForm(f => ({ ...f, goodQty: e.target.value }))} placeholder="Leave blank = same as actual" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCompleteDialog(null)}>Cancel</Button>
            <Button size="sm" disabled={!completeForm.actualQty || completeMutation.isPending} className="bg-green-600 hover:bg-green-700"
              onClick={() => completeDialog && completeMutation.mutate({ woId: completeDialog.woId, dto: { actualQty: parseInt(completeForm.actualQty, 10), goodQty: completeForm.goodQty ? parseInt(completeForm.goodQty, 10) : undefined } })}>
              {completeMutation.isPending ? 'Completing…' : 'Mark Complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Hold Dialog ══ */}
      <Dialog open={!!holdDialog} onOpenChange={o => !o && setHoldDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Hold — {holdDialog?.orderNumber}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label className="text-xs">Reason for hold *</Label>
            <Input placeholder="e.g. Waiting for material…" value={holdReason} onChange={e => setHoldReason(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setHoldDialog(null)}>Cancel</Button>
            <Button size="sm" disabled={holdReason.length < 5 || holdMutation.isPending}
              onClick={() => holdDialog && holdMutation.mutate({ woId: holdDialog.woId, reason: holdReason })}>
              Confirm Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Cancel Dialog ══ */}
      <Dialog open={!!cancelDialog} onOpenChange={o => !o && setCancelDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Cancel — {cancelDialog?.orderNumber}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label className="text-xs">Reason for cancellation *</Label>
            <Input placeholder="e.g. Material shortage, schedule change…" value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCancelDialog(null)}>Back</Button>
            <Button variant="destructive" size="sm" disabled={cancelReason.length < 5 || cancelMutation.isPending}
              onClick={() => cancelDialog && cancelMutation.mutate({ woId: cancelDialog.woId, reason: cancelReason })}>
              {cancelMutation.isPending ? 'Cancelling…' : 'Confirm Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Delete Dialog ══ */}
      <DeleteDialog
        open={!!deleteDialog} onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete ${deleteDialog?.orderNumber}?`}
        description="This will permanently delete the work order."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
