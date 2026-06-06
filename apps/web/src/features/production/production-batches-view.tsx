'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Download, Filter, FlaskConical, Clock, CheckCircle2, AlertTriangle, Edit3, Trash2, Hash, Package, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'; // still used for status filter
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { TableRowActions } from '@/components/ui/table-row-actions';
import { api } from '@/services/api.client';
import { cn, formatDate } from '@/lib/utils';

type BatchStatus = 'ACTIVE' | 'COMPLETED' | 'RELEASED' | 'REJECTED' | 'ON_HOLD' | 'QUARANTINE';

interface Batch {
  id: string;
  batchNumber: string;
  sku?: { name: string; code: string };
  workOrder?: { orderNumber: string; machine?: { name: string } };
  status: BatchStatus;
  quantity: number;
  goodQuantity: number;
  scrapQuantity: number;
  lotNumber?: string | null;
  notes?: string | null;
  createdAt?: string;
  yieldPct?: number;
  scrapPct?: number;
}

interface SKU { id: string; name: string; code: string; itemNumber?: string; brand?: string; }
interface WorkOrder { id: string; orderNumber: string; status: string; sku?: { name: string } }

const STATUS_CONFIG: Record<BatchStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE:     { label: 'Active',      variant: 'default' },
  COMPLETED:  { label: 'Completed',   variant: 'secondary' },
  RELEASED:   { label: 'Released',    variant: 'secondary' },
  REJECTED:   { label: 'Rejected',    variant: 'destructive' },
  ON_HOLD:    { label: 'On Hold',     variant: 'outline' },
  QUARANTINE: { label: 'Quarantine',  variant: 'outline' },
};

const EMPTY_FORM = { batchNumber: '', skuId: '', plannedQty: '', workOrderId: '' };

export function ProductionBatchesView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [viewBatch, setViewBatch] = useState<Batch | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['production', 'batches', { search, status: statusFilter }],
    queryFn: () => api.get('/production/batches', {
      params: { search: search || undefined, status: statusFilter || undefined, limit: 50 },
    }),
    staleTime: 15_000,
  });

  const { data: skusData } = useQuery({
    queryKey: ['inventory', 'products', 'dropdown'],
    queryFn: () => api.get('/inventory/products', { params: { limit: 200 } }),
    staleTime: 120_000,
  });

  const { data: workOrdersData } = useQuery({
    queryKey: ['production', 'work-orders', 'dropdown'],
    queryFn: () => api.get('/production/work-orders', { params: { limit: 100, status: 'PLANNED,IN_PROGRESS' } }),
    staleTime: 30_000,
    enabled: formOpen,
  });

  const batches: Batch[] = (data as any)?.data ?? [];
  const skus: SKU[] = (skusData as any)?.data ?? [];
  const workOrders: WorkOrder[] = (workOrdersData as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/production/batches', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
      toast({ title: 'Batch created', description: `Batch ${formData.batchNumber} is now active.` });
      setFormOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (e: any) => toast({ title: 'Failed to create batch', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/production/batches/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
      toast({ title: 'Batch updated successfully' });
      setEditBatch(null);
    },
    onError: (e: any) => toast({ title: 'Update failed', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/production/batches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
      toast({ title: 'Batch deleted' }); setDeleteId(null);
    },
    onError: (e: any) => toast({ title: 'Delete failed', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const activeCount = batches.filter(b => b.status === 'ACTIVE').length;
  const completedCount = batches.filter(b => b.status === 'COMPLETED' || b.status === 'RELEASED').length;
  const onHoldCount = batches.filter(b => b.status === 'ON_HOLD' || b.status === 'QUARANTINE').length;
  const totalScrap = batches.reduce((sum, b) => sum + (b.scrapQuantity ?? 0), 0);

  const SUMMARY = [
    { label: 'Active Batches',  value: activeCount,    icon: FlaskConical, color: 'text-brand-400' },
    { label: 'Completed',       value: completedCount, icon: CheckCircle2, color: 'text-green-400' },
    { label: 'On Hold',         value: onHoldCount,    icon: Clock,        color: 'text-amber-400' },
    { label: 'Total Scrap',     value: totalScrap,     icon: AlertTriangle,color: 'text-red-400'   },
  ];

  const handleCreate = () => {
    if (!formData.batchNumber || !formData.plannedQty) return;
    createMutation.mutate({
      batchNumber: formData.batchNumber,
      skuId: formData.skuId || undefined,
      quantity: parseFloat(formData.plannedQty),
      workOrderId: formData.workOrderId || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editBatch) return;
    updateMutation.mutate({
      id: editBatch.id,
      dto: {
        status: editBatch.status,
        quantity: editBatch.quantity,
        goodQuantity: editBatch.goodQuantity,
        scrapQuantity: editBatch.scrapQuantity,
        lotNumber: editBatch.lotNumber ?? undefined,
        notes: editBatch.notes ?? undefined,
      },
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Production Batches</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track batch progress, yields, and quality outcomes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Download size={13} />Export</Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { setFormData(EMPTY_FORM); setFormOpen(true); }}>
            <Plus size={13} />New Batch
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SUMMARY.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="industrial-card rounded-xl p-4 flex items-center gap-3">
                <Icon className={cn('w-8 h-8', s.color)} />
                <div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="industrial-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search batch or product..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 w-56 text-xs" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Filter size={13} />{statusFilter ? STATUS_CONFIG[statusFilter as BatchStatus]?.label : 'All Status'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter(null)}>All Status</DropdownMenuItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <DropdownMenuItem key={k} onClick={() => setStatusFilter(k)}>{v.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/30">
                {['Batch #', 'Product', 'Status', 'Quantity', 'Work Order', 'Lot #', 'Created', 'Yield', 'Scrap', ''].map(h => (
                  <TableHead key={h} className="text-[11px]">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-border/20">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><div className="shimmer h-3.5 rounded w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">No batches found</TableCell>
                </TableRow>
              ) : (
                batches.map(batch => {
                  const cfg = STATUS_CONFIG[batch.status] ?? { label: batch.status, variant: 'outline' as const };
                  const yieldPct = batch.yieldPct ?? (batch.quantity > 0 ? Math.round((batch.goodQuantity / batch.quantity) * 100) : 0);
                  const scrapPct = batch.scrapPct ?? (batch.quantity > 0 ? Math.round((batch.scrapQuantity / batch.quantity) * 100) : 0);
                  return (
                    <TableRow key={batch.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                      <TableCell className="font-mono text-xs font-semibold text-primary">{batch.batchNumber}</TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">{batch.sku?.name ?? '—'}</div>
                        {batch.sku?.code && <div className="text-[10px] text-muted-foreground">{batch.sku.code}</div>}
                      </TableCell>
                      <TableCell><Badge variant={cfg.variant} className="text-[10px] h-5">{cfg.label}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{batch.goodQuantity}</div>
                        <div className="text-muted-foreground text-[10px]">/ {batch.quantity}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {batch.workOrder?.orderNumber ?? '—'}
                        {batch.workOrder?.machine?.name && (
                          <div className="text-[10px]">{batch.workOrder.machine.name}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{batch.lotNumber ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{batch.createdAt ? formatDate(batch.createdAt) : '—'}</TableCell>
                      <TableCell className="text-xs">
                        <span className={yieldPct >= 99 ? 'text-green-400 font-medium' : yieldPct >= 90 ? 'text-yellow-400' : 'text-red-400'}>
                          {yieldPct}%
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className={scrapPct > 5 ? 'text-red-400 font-medium' : scrapPct > 0 ? 'text-amber-400' : 'text-green-400'}>
                          {batch.scrapQuantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <TableRowActions
                          onView={() => setViewBatch(batch)}
                          onEdit={() => setEditBatch(batch)}
                          onDelete={batch.status !== 'ACTIVE' ? () => setDeleteId(batch.id) : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Batch Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="w-4 h-4 text-brand-400" />
              Create Production Batch
            </DialogTitle>
            <DialogDescription className="text-xs">
              Start a new production batch. Link it to a SKU and work order for full traceability.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Batch Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Hash size={11} className="text-muted-foreground" />
                Batch Number <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.batchNumber}
                onChange={e => setFormData(v => ({ ...v, batchNumber: e.target.value }))}
                placeholder="e.g. BTH-2024-001"
                className="h-9"
              />
            </div>

            {/* Product / SKU */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Package size={11} className="text-muted-foreground" />
                Product / SKU
              </Label>
              <Select value={formData.skuId} onValueChange={v => setFormData(f => ({ ...f, skuId: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {skus.length === 0 ? (
                    <SelectItem value="_none" disabled>No products available</SelectItem>
                  ) : (
                    skus.map(sku => (
                      <SelectItem key={sku.id} value={sku.id}>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{sku.name}</span>
                          <span className="text-[10px] text-muted-foreground">{sku.itemNumber ?? sku.code}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Planned Quantity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Planned Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={1}
                value={formData.plannedQty}
                onChange={e => setFormData(v => ({ ...v, plannedQty: e.target.value }))}
                placeholder="e.g. 1000"
                className="h-9"
              />
            </div>

            {/* Work Order */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Work Order</Label>
              <Select value={formData.workOrderId} onValueChange={v => setFormData(f => ({ ...f, workOrderId: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Link to a work order..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {workOrders.length === 0 ? (
                    <SelectItem value="_none" disabled>No open work orders</SelectItem>
                  ) : (
                    workOrders.map(wo => (
                      <SelectItem key={wo.id} value={wo.id}>
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-medium">{wo.orderNumber}</span>
                          {wo.sku?.name && <span className="text-[10px] text-muted-foreground">{wo.sku.name}</span>}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!formData.batchNumber || !formData.plannedQty || createMutation.isPending}
              onClick={handleCreate}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Batch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Batch Dialog */}
      {editBatch && (
        <Dialog open={true} onOpenChange={() => setEditBatch(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm font-mono">{editBatch.batchNumber}</DialogTitle>
              <DialogDescription className="text-xs">Update batch quantities, status, and tracking info.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Quantities */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quantities</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Total Planned</Label>
                    <Input type="number" min={0} value={editBatch.quantity ?? ''}
                      onChange={e => setEditBatch({ ...editBatch, quantity: parseInt(e.target.value) || 0 })}
                      className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Good Qty</Label>
                    <Input type="number" min={0} value={editBatch.goodQuantity ?? ''}
                      onChange={e => setEditBatch({ ...editBatch, goodQuantity: parseInt(e.target.value) || 0 })}
                      className="h-9 border-green-500/40 focus-visible:ring-green-500/30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Scrap Qty</Label>
                    <Input type="number" min={0} value={editBatch.scrapQuantity ?? ''}
                      onChange={e => setEditBatch({ ...editBatch, scrapQuantity: parseInt(e.target.value) || 0 })}
                      className="h-9 border-red-500/40 focus-visible:ring-red-500/30" />
                  </div>
                </div>
                {/* Live yield preview */}
                {editBatch.quantity > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${Math.min(Math.round((editBatch.goodQuantity / editBatch.quantity) * 100), 100)}%` }} />
                    </div>
                    <span className="text-[11px] text-green-400 font-medium tabular-nums">
                      {Math.min(Math.round((editBatch.goodQuantity / editBatch.quantity) * 100), 100)}% yield
                    </span>
                  </div>
                )}
              </div>

              {/* Status & Tracking */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status & Tracking</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Batch Status</Label>
                    <Select value={editBatch.status} onValueChange={v => setEditBatch({ ...editBatch, status: v as BatchStatus })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lot Number</Label>
                    <Input value={editBatch.lotNumber ?? ''}
                      onChange={e => setEditBatch({ ...editBatch, lotNumber: e.target.value })}
                      placeholder="e.g. LOT-2024-001" className="h-9" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Input value={editBatch.notes ?? ''}
                  onChange={e => setEditBatch({ ...editBatch, notes: e.target.value })}
                  placeholder="Optional notes or quality observations…" className="h-9" />
              </div>

              {/* Delete zone for non-ACTIVE */}
              {editBatch.status !== 'ACTIVE' && (
                <div className="border border-red-500/30 rounded-lg px-3 py-2.5 bg-red-500/5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-red-400">Delete this batch</p>
                    <p className="text-[10px] text-muted-foreground">This action is permanent and cannot be undone.</p>
                  </div>
                  <Button variant="destructive" size="sm" className="h-7 text-xs"
                    onClick={() => { setEditBatch(null); setDeleteId(editBatch.id); }}>
                    Delete
                  </Button>
                </div>
              )}
              {editBatch.status === 'ACTIVE' && (
                <div className="border border-muted rounded-lg px-3 py-2.5 bg-muted/30 flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                  <p className="text-[10px] text-muted-foreground">
                    Active batches cannot be deleted. Change status to Completed, Rejected, or another final state first.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditBatch(null)}>Cancel</Button>
              <Button size="sm" disabled={updateMutation.isPending} onClick={handleUpdate}>
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Batch Detail Sheet ── */}
      <Sheet open={!!viewBatch} onOpenChange={o => !o && setViewBatch(null)}>
        <SheetContent className="w-full max-w-lg">
          <SheetHeader>
            {viewBatch && (
              <div className="flex items-center gap-3 pr-6">
                <div className="flex-1">
                  <SheetTitle className="font-mono text-sm">{viewBatch.batchNumber}</SheetTitle>
                  <SheetDescription className="mt-0.5">{viewBatch.lotNumber ? `Lot: ${viewBatch.lotNumber}` : 'No lot number'}</SheetDescription>
                </div>
                <Badge variant={STATUS_CONFIG[viewBatch.status]?.variant ?? 'outline'}>
                  {STATUS_CONFIG[viewBatch.status]?.label ?? viewBatch.status}
                </Badge>
              </div>
            )}
          </SheetHeader>

          {viewBatch && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* Yield metrics */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quality Metrics</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Planned', value: viewBatch.quantity, color: '' },
                    { label: 'Good', value: viewBatch.goodQuantity, color: 'text-green-400' },
                    { label: 'Scrap', value: viewBatch.scrapQuantity, color: 'text-red-400' },
                  ].map(m => (
                    <div key={m.label} className="industrial-card rounded-lg p-3 text-center">
                      <div className={cn('text-xl font-bold tabular-nums', m.color)}>{m.value ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="industrial-card rounded-lg px-3 py-2 mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${viewBatch.yieldPct ?? (viewBatch.quantity > 0 ? Math.round((viewBatch.goodQuantity / viewBatch.quantity) * 100) : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-green-400 tabular-nums">
                    {viewBatch.yieldPct ?? (viewBatch.quantity > 0 ? Math.round((viewBatch.goodQuantity / viewBatch.quantity) * 100) : 0)}% yield
                  </span>
                </div>
              </div>

              {/* Details */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Batch Details</p>
                <div className="industrial-card rounded-lg px-3">
                  {[
                    { label: 'Product', value: viewBatch.sku?.name },
                    { label: 'SKU Code', value: viewBatch.sku?.code },
                    { label: 'Lot Number', value: viewBatch.lotNumber },
                    { label: 'Work Order', value: viewBatch.workOrder?.orderNumber },
                    { label: 'Machine', value: viewBatch.workOrder?.machine?.name },
                    { label: 'Created', value: viewBatch.createdAt ? formatDate(viewBatch.createdAt) : undefined },
                  ].map(row => (
                    <div key={row.label} className="flex items-start gap-2 py-2 border-b border-border/20 last:border-0">
                      <span className="text-[11px] text-muted-foreground w-24 shrink-0 pt-0.5">{row.label}</span>
                      <span className="text-xs font-medium flex-1">{row.value ?? <span className="text-muted-foreground">—</span>}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {viewBatch.notes && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                  <div className="industrial-card rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">{viewBatch.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {viewBatch && (
            <div className="px-6 py-3 border-t border-border/50 flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                onClick={() => { setViewBatch(null); setEditBatch(viewBatch); }}>
                <Edit3 size={11} />Edit Batch
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <Dialog open onOpenChange={o => !o && setDeleteId(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">Delete Batch?</DialogTitle>
              <DialogDescription className="text-xs">This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteId)}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
