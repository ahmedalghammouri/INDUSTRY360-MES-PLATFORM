'use client';

import React, { useState } from 'react';
import {
  Plus, Search, AlertTriangle, Pencil, Trash2, MoreHorizontal,
  Layers3, TrendingDown, DollarSign, Package,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EntityPicker } from '@/components/ui/entity-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';
import { TablePagination } from '@/components/ui/table-pagination';

// ── Types ────────────────────────────────────────────────────

interface StorageLocationOption {
  id: string;
  code: string;
  name: string;
  zone: string;
}

interface RawMaterial {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  unitCost: number | null;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  minStock: number;
  reorderPoint: number | null;
  storageLocation: string | null;
  storageLocationId: string | null;
  supplierName: string | null;
  isLowStock: boolean;
  stockValue: number | null;
  isActive: boolean;
}

interface RawMaterialsResponse {
  data: RawMaterial[];
  total: number;
  page: number;
}

type RawMaterialCategory = 'RAW' | 'PACKAGING' | 'CONSUMABLE' | 'CHEMICAL' | 'LABEL';

interface MaterialFormState {
  code: string;
  name: string;
  category: string;
  unit: string;
  unitCost: string;
  minStock: string;
  maxStock: string;
  reorderPoint: string;
  storageLocationId: string;
  supplierName: string;
  leadTimeDays: string;
}

// ── Constants ────────────────────────────────────────────────

const CATEGORIES: RawMaterialCategory[] = ['RAW', 'PACKAGING', 'CONSUMABLE', 'CHEMICAL', 'LABEL'];

const CATEGORY_COLORS: Record<string, string> = {
  RAW:        'text-green-400 border-green-400/30 bg-green-400/10',
  PACKAGING:  'text-blue-400 border-blue-400/30 bg-blue-400/10',
  CONSUMABLE: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  CHEMICAL:   'text-red-400 border-red-400/30 bg-red-400/10',
  LABEL:      'text-purple-400 border-purple-400/30 bg-purple-400/10',
};

const EMPTY_FORM: MaterialFormState = {
  code: '', name: '', category: '', unit: 'KG', unitCost: '',
  minStock: '', maxStock: '', reorderPoint: '', storageLocationId: '',
  supplierName: '', leadTimeDays: '',
};

function getStockStatus(material: RawMaterial): { label: string; cls: string } {
  if (material.isLowStock) return { label: 'Low Stock', cls: 'text-amber-400 border-amber-400/30 bg-amber-400/10' };
  if (material.reorderPoint && material.availableStock <= material.reorderPoint)
    return { label: 'Reorder', cls: 'text-orange-400 border-orange-400/30 bg-orange-400/10' };
  return { label: 'Normal', cls: 'text-green-400 border-green-400/30 bg-green-400/10' };
}

// ── Component ────────────────────────────────────────────────

export function RawMaterialsView() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editMaterial, setEditMaterial] = useState<RawMaterial | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState<MaterialFormState>(EMPTY_FORM);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Queries ─────────────────────────────────────────────────

  const { data: storageLocData } = useQuery({
    queryKey: ['inventory', 'storage-locations'],
    queryFn: () => api.get<{ data: StorageLocationOption[] }>('/inventory/storage-locations'),
    staleTime: 300_000,
  });
  const storageLocations: StorageLocationOption[] = (storageLocData as any)?.data ?? (storageLocData as any) ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'raw-materials', { search, category: categoryFilter, lowStock: lowStockOnly }, page],
    queryFn: () =>
      api.get<RawMaterialsResponse>('/inventory/raw-materials', {
        params: {
          search: search || undefined,
          category: categoryFilter || undefined,
          lowStock: lowStockOnly ? 'true' : undefined,
          page,
          limit: 20,
        },
      }),
    staleTime: 30_000,
  });

  const materials: RawMaterial[] = (data as unknown as RawMaterialsResponse)?.data ?? [];
  const total: number = (data as unknown as RawMaterialsResponse)?.total ?? 0;
  const lowCount = materials.filter(m => m.isLowStock).length;
  const totalStockValue = materials.reduce((sum, m) => sum + (m.stockValue ?? 0), 0);

  // ── Mutations ────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) => api.post('/inventory/raw-materials', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'raw-materials'] });
      toast({ title: 'Raw material created successfully', variant: 'success' });
      handleCloseForm();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create material';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Record<string, unknown> }) =>
      api.patch(`/inventory/raw-materials/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'raw-materials'] });
      toast({ title: 'Raw material updated', variant: 'success' });
      handleCloseForm();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update material';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/raw-materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'raw-materials'] });
      toast({ title: 'Raw material deleted' });
      setDeleteDialog(null);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete material';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  // ── Handlers ─────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditMaterial(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const handleOpenEdit = (material: RawMaterial) => {
    setEditMaterial(material);
    setForm({
      code: material.code,
      name: material.name,
      category: material.category ?? '',
      unit: material.unit,
      unitCost: material.unitCost?.toString() ?? '',
      minStock: material.minStock.toString(),
      maxStock: '',
      reorderPoint: material.reorderPoint?.toString() ?? '',
      storageLocationId: material.storageLocationId ?? '',
      supplierName: material.supplierName ?? '',
      leadTimeDays: '',
    });
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditMaterial(null);
    setForm(EMPTY_FORM);
  };

  const buildDto = (): Record<string, unknown> => ({
    code: form.code,
    name: form.name,
    category: form.category || null,
    unit: form.unit,
    unitCost: form.unitCost ? parseFloat(form.unitCost) : null,
    minStock: parseInt(form.minStock) || 0,
    maxStock: form.maxStock ? parseInt(form.maxStock) : null,
    reorderPoint: form.reorderPoint ? parseInt(form.reorderPoint) : null,
    storageLocationId: form.storageLocationId || null,
    supplierName: form.supplierName || null,
    leadTimeDays: form.leadTimeDays ? parseInt(form.leadTimeDays) : null,
  });

  const handleSubmit = () => {
    if (editMaterial) {
      const dto = buildDto();
      delete dto.code; // code is immutable after creation
      updateMutation.mutate({ id: editMaterial.id, dto });
    } else {
      createMutation.mutate(buildDto());
    }
  };

  const isValid = !!(form.code && form.name && form.unit && form.minStock);
  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Raw Materials</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inventory of raw materials, packaging, chemicals, and consumables
          </p>
        </div>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleOpenCreate}>
          <Plus size={13} />Add Material
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Total Materials</span>
              <Layers3 size={14} className="text-brand-400" />
            </div>
            <p className="text-2xl font-bold text-brand-400">{total}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">active material records</p>
          </div>
          <div className={cn('glass-card p-4', lowCount > 0 && 'border-amber-500/30')}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Low Stock</span>
              <TrendingDown size={14} className={lowCount > 0 ? 'text-amber-400' : 'text-muted-foreground'} />
            </div>
            <p className={cn('text-2xl font-bold', lowCount > 0 ? 'text-amber-400' : 'text-muted-foreground')}>
              {lowCount}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">materials below minimum</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Total Stock Value</span>
              <DollarSign size={14} className="text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-400">
              {totalStockValue.toLocaleString('en-SA', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">SAR across all materials</p>
          </div>
        </div>

        {/* Filters + Table */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold">All Materials</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search code, name…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="h-8 pl-7 w-44 text-xs"
                />
              </div>
              <Select value={categoryFilter || '__all__'} onValueChange={v => { setCategoryFilter(v === '__all__' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant={lowStockOnly ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => { setLowStockOnly(v => !v); setPage(1); }}
              >
                <AlertTriangle size={12} />Low Stock
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border/30 overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20">
                  <tr className="border-b border-border/30">
                    {['Code', 'Name', 'Category', 'Unit', 'Available', 'Reserved', 'Min Stock', 'Unit Cost', 'Location', 'Status', ''].map(h => (
                      <th key={h} className="text-left p-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={11} className="p-3">
                          <div className="shimmer h-4 rounded" />
                        </td>
                      </tr>
                    ))
                  ) : materials.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-muted-foreground">
                        <Package size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No raw materials found</p>
                        <p className="text-xs mt-1">Add your first material using the button above</p>
                      </td>
                    </tr>
                  ) : (
                    materials.map(m => {
                      const status = getStockStatus(m);
                      return (
                        <tr
                          key={m.id}
                          className={cn('border-b border-border/20 hover:bg-muted/20 transition-colors', m.isLowStock && 'bg-amber-500/5')}
                        >
                          <td className="p-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{m.code}</td>
                          <td className="p-3 text-xs font-medium">
                            <div className="max-w-[160px] truncate">{m.name}</div>
                            {m.supplierName && (
                              <div className="text-[10px] text-muted-foreground">{m.supplierName}</div>
                            )}
                          </td>
                          <td className="p-3">
                            {m.category ? (
                              <span className={cn(
                                'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                                CATEGORY_COLORS[m.category] ?? 'text-muted-foreground border-border',
                              )}>
                                {m.category}
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{m.unit}</td>
                          <td className="p-3">
                            <span className={cn(
                              'text-xs font-bold tabular-nums',
                              m.isLowStock ? 'text-amber-400' : 'text-foreground',
                            )}>
                              {m.availableStock.toLocaleString()}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground tabular-nums">
                            {m.reservedStock > 0 ? m.reservedStock.toLocaleString() : '—'}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground tabular-nums">{m.minStock.toLocaleString()}</td>
                          <td className="p-3 text-xs text-muted-foreground tabular-nums">
                            {m.unitCost != null ? `${m.unitCost.toFixed(2)} SAR` : '—'}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            <span className="max-w-[100px] truncate block">{m.storageLocation ?? '—'}</span>
                          </td>
                          <td className="p-3">
                            <span className={cn(
                              'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                              status.cls,
                            )}>
                              {status.label}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem className="gap-2 text-xs" onClick={() => handleOpenEdit(m)}>
                                  <Pencil size={12} />Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 text-xs text-destructive"
                                  onClick={() => setDeleteDialog({ id: m.id, name: m.name })}
                                >
                                  <Trash2 size={12} />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <TablePagination page={page} total={total} limit={20} onPageChange={setPage} isLoading={isLoading} />
        </div>
      </div>

      {/* ── Create / Edit Dialog ─────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={o => !o && handleCloseForm()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
            <DialogTitle className="text-sm flex items-center gap-2">
              <Layers3 size={14} className="text-brand-400" />
              {editMaterial ? `Edit — ${editMaterial.name}` : 'Add Raw Material'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editMaterial ? 'Update material details below.' : 'Fill in the details to add a new raw material to inventory.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Code */}
              <div className="space-y-1.5">
                <Label className="text-xs">Code <span className="text-destructive">*</span></Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. RM-001"
                  className="h-9"
                  disabled={!!editMaterial}
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={form.category || '__none__'} onValueChange={v => setForm(p => ({ ...p, category: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Material name"
                  className="h-9"
                />
              </div>

              {/* Unit */}
              <div className="space-y-1.5">
                <Label className="text-xs">Unit <span className="text-destructive">*</span></Label>
                <Input
                  value={form.unit}
                  onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                  placeholder="KG, L, PCS…"
                  className="h-9"
                />
              </div>

              {/* Unit Cost */}
              <div className="space-y-1.5">
                <Label className="text-xs">Unit Cost (SAR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unitCost}
                  onChange={e => setForm(p => ({ ...p, unitCost: e.target.value }))}
                  placeholder="0.00"
                  className="h-9"
                />
              </div>

              {/* Min Stock */}
              <div className="space-y-1.5">
                <Label className="text-xs">Min Stock <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  value={form.minStock}
                  onChange={e => setForm(p => ({ ...p, minStock: e.target.value }))}
                  placeholder="0"
                  className="h-9"
                />
              </div>

              {/* Max Stock */}
              <div className="space-y-1.5">
                <Label className="text-xs">Max Stock</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.maxStock}
                  onChange={e => setForm(p => ({ ...p, maxStock: e.target.value }))}
                  placeholder="Optional"
                  className="h-9"
                />
              </div>

              {/* Reorder Point */}
              <div className="space-y-1.5">
                <Label className="text-xs">Reorder Point</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.reorderPoint}
                  onChange={e => setForm(p => ({ ...p, reorderPoint: e.target.value }))}
                  placeholder="Optional"
                  className="h-9"
                />
              </div>

              {/* Lead Time */}
              <div className="space-y-1.5">
                <Label className="text-xs">Lead Time (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.leadTimeDays}
                  onChange={e => setForm(p => ({ ...p, leadTimeDays: e.target.value }))}
                  placeholder="Optional"
                  className="h-9"
                />
              </div>

              {/* Storage Location */}
              <div className="space-y-1.5">
                <Label className="text-xs">Storage Location</Label>
                <EntityPicker
                  items={storageLocations}
                  value={form.storageLocationId || null}
                  onChange={id => setForm(p => ({ ...p, storageLocationId: id ?? '' }))}
                  getId={loc => loc.id}
                  getPrimary={loc => loc.name}
                  getSecondary={loc => loc.code}
                  getMeta={loc => <span className="text-muted-foreground">{loc.zone}</span>}
                  placeholder="Select location…"
                  searchPlaceholder="Search by code or name…"
                />
              </div>

              {/* Supplier */}
              <div className="space-y-1.5">
                <Label className="text-xs">Supplier Name</Label>
                <Input
                  value={form.supplierName}
                  onChange={e => setForm(p => ({ ...p, supplierName: e.target.value }))}
                  placeholder="Optional"
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/50 shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={handleCloseForm}>Cancel</Button>
            <Button
              size="sm"
              disabled={!isValid || isBusy}
              onClick={handleSubmit}
            >
              {isBusy
                ? (editMaterial ? 'Saving…' : 'Creating…')
                : (editMaterial ? 'Save Changes' : 'Add Material')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────── */}
      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete "${deleteDialog?.name}"?`}
        description="This will permanently remove this raw material from inventory. This action cannot be undone."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
