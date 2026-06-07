'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Plus, Layers3, AlertTriangle, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormDialog } from '@/components/ui/form-dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { useToast } from '@/components/ui/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';
import { TablePagination } from '@/components/ui/table-pagination';

interface MaterialLot {
  id: string;
  materialCode: string;
  materialName: string;
  lotNumber: string;
  supplierLot: string | null;
  supplierName: string | null;
  quantity: number;
  remainingQty: number;
  unit: string;
  status: string;
  receivedAt: string;
  expiryDate: string | null;
  storageLocation: string | null;
  utilizationPct: number;
  isExpired: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-400 border-green-400/40',
  COMPLETED: 'text-muted-foreground border-border',
  RELEASED: 'text-blue-400 border-blue-400/40',
  REJECTED: 'text-red-400 border-red-400/40',
  ON_HOLD: 'text-amber-400 border-amber-400/40',
  QUARANTINE: 'text-orange-400 border-orange-400/40',
};

export function MaterialsView() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editLot, setEditLot] = useState<MaterialLot | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; lotNumber: string } | null>(null)
  const [form, setForm] = useState({
    materialCode: '', materialName: '', lotNumber: '',
    supplierName: '', quantity: '', unit: 'KG', expiryDate: '', storageLocation: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'materials', search, status, page],
    queryFn: () => api.get<{ data: MaterialLot[]; total: number }>('/inventory/materials', {
      params: { search: search || undefined, status: status || undefined, page, limit: 20 },
    }),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/inventory/materials', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'materials'] })
      toast({ title: 'Material lot created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create lot', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/materials/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'materials'] })
      toast({ title: 'Material lot deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete lot', variant: 'destructive' }),
  })

  const lots: MaterialLot[] = (data as any)?.data ?? [];
  const total: number = (data as any)?.total ?? 0;
  const expiredCount = lots.filter(l => l.isExpired).length;

  const handleOpenCreate = () => {
    setEditLot(null)
    setForm({ materialCode: '', materialName: '', lotNumber: '', supplierName: '', quantity: '', unit: 'KG', expiryDate: '', storageLocation: '' })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditLot(null)
  };

  const handleSubmit = () => {
    createMutation.mutate({ ...form, quantity: parseFloat(form.quantity) })
  };

  const isValid = !!(form.materialCode && form.materialName && form.lotNumber && form.quantity)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Material Lots</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} lots
            {expiredCount > 0 && <span className="text-red-400 font-semibold ml-2">• {expiredCount} expired</span>}
          </p>
        </div>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1" />Receive Lot
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search material, lot #…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-9 w-64"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
        >
          <option value="">All Status</option>
          {['ACTIVE', 'COMPLETED', 'RELEASED', 'REJECTED', 'ON_HOLD', 'QUARANTINE'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/60">
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Material</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Lot #</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Supplier</th>
                <th className="text-right p-3 text-muted-foreground font-medium text-xs">Qty</th>
                <th className="text-right p-3 text-muted-foreground font-medium text-xs">Remaining</th>
                <th className="text-center p-3 text-muted-foreground font-medium text-xs">Used %</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Location</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Received</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Expiry</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Status</th>
                <th className="text-center p-3 text-muted-foreground font-medium text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={10} className="p-3"><div className="shimmer h-5 rounded" /></td></tr>
                ))
              ) : lots.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-muted-foreground">
                    <Layers3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    No material lots found
                  </td>
                </tr>
              ) : (
                lots.map((lot, i) => (
                  <motion.tr
                    key={lot.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn('border-b border-border/30 hover:bg-white/5', lot.isExpired && 'bg-red-500/5')}
                  >
                    <td className="p-3 text-xs">
                      <div className="font-medium">{lot.materialName}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{lot.materialCode}</div>
                    </td>
                    <td className="p-3 text-xs font-mono">
                      {lot.lotNumber}
                      {lot.supplierLot && <div className="text-[10px] text-muted-foreground">{lot.supplierLot}</div>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{lot.supplierName ?? '—'}</td>
                    <td className="p-3 text-xs text-right">{lot.quantity.toLocaleString()} {lot.unit}</td>
                    <td className="p-3 text-xs text-right font-semibold">{lot.remainingQty.toLocaleString()} {lot.unit}</td>
                    <td className="p-3 text-xs text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full"
                            style={{ width: `${lot.utilizationPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{lot.utilizationPct}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{lot.storageLocation ?? '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{lot.receivedAt.slice(0, 10)}</td>
                    <td className="p-3 text-xs">
                      {lot.expiryDate ? (
                        <span className={lot.isExpired ? 'text-red-400 font-semibold' : 'text-muted-foreground'}>
                          {lot.isExpired && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                          {lot.expiryDate.slice(0, 10)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[lot.status] ?? '')}>
                        {lot.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDeleteDialog({ id: lot.id, lotNumber: lot.lotNumber })} className="text-destructive">
                            <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} total={total} limit={20} onPageChange={setPage} isLoading={isLoading} />
      </div>

      <FormDialog
        open={formOpen}
        onClose={handleCloseForm}
        title="Receive Material Lot"
        onSubmit={handleSubmit}
        submitLabel="Receive"
        isSubmitting={createMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Material Code *</Label>
            <Input value={form.materialCode} onChange={e => setForm(v => ({ ...v, materialCode: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Material Name *</Label>
            <Input value={form.materialName} onChange={e => setForm(v => ({ ...v, materialName: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Lot Number *</Label>
            <Input value={form.lotNumber} onChange={e => setForm(v => ({ ...v, lotNumber: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Supplier</Label>
            <Input value={form.supplierName} onChange={e => setForm(v => ({ ...v, supplierName: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Quantity *</Label>
            <Input type="number" value={form.quantity} onChange={e => setForm(v => ({ ...v, quantity: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Unit</Label>
            <Input value={form.unit} onChange={e => setForm(v => ({ ...v, unit: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Expiry Date</Label>
            <Input type="date" value={form.expiryDate} onChange={e => setForm(v => ({ ...v, expiryDate: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Storage Location</Label>
            <Input value={form.storageLocation} onChange={e => setForm(v => ({ ...v, storageLocation: e.target.value }))} className="mt-1" />
          </div>
        </div>
      </FormDialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete lot ${deleteDialog?.lotNumber}?`}
        description="This will permanently delete this material lot."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
