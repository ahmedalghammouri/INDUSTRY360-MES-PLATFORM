'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, BoxesIcon, ChevronDown, ChevronRight, Plus, Edit3, Trash2, MoreHorizontal, Ruler, Weight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';

interface StorageLocationOption {
  id: string;
  code: string;
  name: string;
  zone: string;
}

interface BOMComponent {
  componentCode: string;
  componentName: string;
  quantity: number;
  unit: string;
  type: string;
}

interface SKU {
  id: string;
  itemNumber: string;
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  packagingType: string | null;
  unitsPerInner: number;
  innersPerCarton: number;
  cartonsPerPallet: number;
  baseUnit: string;
  weight: number | null;
  weightUnit: string;
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: string;
  storageLocationId: string | null;
  storageLocationRef: { id: string; code: string; name: string } | null;
  family: { name: string; brand: string | null } | null;
  bomComponents: BOMComponent[];
}

const BOM_COLORS: Record<string, string> = {
  RAW: 'text-amber-400',
  PACKAGING: 'text-blue-400',
  CONSUMABLE: 'text-purple-400',
};

const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'];
const DIM_UNITS = ['cm', 'mm', 'm', 'in'];

function formatDimensions(sku: SKU): string {
  if (!sku.length && !sku.width && !sku.height) return '—';
  const parts = [sku.length, sku.width, sku.height].map(v => v != null ? v.toString() : '?');
  return `${parts.join(' × ')} ${sku.dimensionUnit}`;
}

function SKURow({ sku, index, onDelete, onEdit }: { sku: SKU; index: number; onDelete: (id: string) => void; onEdit: (sku: SKU) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasBOM = sku.bomComponents.length > 0;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.02 }}
        className="border-b border-border/30 hover:bg-white/5 cursor-pointer"
        onClick={() => hasBOM && setExpanded(v => !v)}
      >
        <td className="p-3 text-xs">
          {hasBOM ? (
            expanded ? <ChevronDown className="w-3.5 h-3.5 inline text-muted-foreground" />
                     : <ChevronRight className="w-3.5 h-3.5 inline text-muted-foreground" />
          ) : <span className="w-3.5 h-3.5 inline-block" />}
        </td>
        <td className="p-3 text-xs font-mono text-muted-foreground">{sku.itemNumber}</td>
        <td className="p-3 text-xs">
          <div className="font-medium">{sku.name}</div>
          <div className="text-[10px] text-muted-foreground">{sku.code}</div>
        </td>
        <td className="p-3 text-xs">
          {sku.family?.name && <Badge variant="outline" className="text-[10px]">{sku.family.name}</Badge>}
        </td>
        <td className="p-3 text-xs text-muted-foreground">{sku.brand ?? sku.family?.brand ?? '—'}</td>
        <td className="p-3 text-xs">
          {sku.category && <Badge variant="outline" className="text-[10px]">{sku.category}</Badge>}
        </td>
        <td className="p-3 text-xs text-muted-foreground">{sku.packagingType ?? '—'}</td>
        <td className="p-3 text-xs text-right text-muted-foreground">
          {sku.unitsPerInner} / {sku.innersPerCarton} / {sku.cartonsPerPallet}
        </td>
        <td className="p-3 text-xs text-muted-foreground tabular-nums">
          {sku.weight != null ? (
            <span className="flex items-center gap-1">
              <Weight size={10} className="text-muted-foreground/60" />
              {sku.weight} {sku.weightUnit}
            </span>
          ) : '—'}
        </td>
        <td className="p-3 text-xs text-muted-foreground tabular-nums">
          {formatDimensions(sku) !== '—' ? (
            <span className="flex items-center gap-1">
              <Ruler size={10} className="text-muted-foreground/60" />
              {formatDimensions(sku)}
            </span>
          ) : '—'}
        </td>
        <td className="p-3 text-xs text-center">
          {hasBOM ? (
            <Badge variant="secondary" className="text-[10px]">{sku.bomComponents.length} items</Badge>
          ) : (
            <span className="text-muted-foreground text-[10px]">—</span>
          )}
        </td>
        <td className="p-3 text-xs text-muted-foreground">
          {sku.storageLocationRef
            ? <span className="font-mono text-[10px]">{sku.storageLocationRef.code}</span>
            : <span>—</span>
          }
        </td>
        <td className="p-3 text-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2 text-xs" onClick={(e) => { e.stopPropagation(); onEdit(sku); }}>
                <Edit3 className="w-3 h-3" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(sku.id); }}>
                <Trash2 className="w-3 h-3" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </motion.tr>
      {expanded && hasBOM && (
        <tr className="bg-white/2 border-b border-border/20">
          <td colSpan={13} className="px-6 py-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Bill of Materials</div>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 text-muted-foreground font-medium">Code</th>
                  <th className="text-left py-1 text-muted-foreground font-medium">Component</th>
                  <th className="text-right py-1 text-muted-foreground font-medium">Qty</th>
                  <th className="text-left py-1 text-muted-foreground font-medium">Unit</th>
                  <th className="text-left py-1 text-muted-foreground font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {sku.bomComponents.map((c, i) => (
                  <tr key={i} className="border-t border-border/20">
                    <td className="py-1 font-mono text-muted-foreground">{c.componentCode}</td>
                    <td className="py-1">{c.componentName}</td>
                    <td className="py-1 text-right">{c.quantity}</td>
                    <td className="py-1 text-muted-foreground">{c.unit}</td>
                    <td className="py-1">
                      <span className={BOM_COLORS[c.type] ?? ''}>{c.type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

const EMPTY_CREATE = {
  code: '', name: '', itemNumber: '', brand: '', category: '', packagingType: '',
  unitsPerInner: '', innersPerCarton: '', cartonsPerPallet: '', baseUnit: 'PCS',
  storageLocationId: '',
  weight: '', weightUnit: 'kg',
  length: '', width: '', height: '', dimensionUnit: 'cm',
};

export function ProductsView() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SKU | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', brand: '', category: '', baseUnit: '', storageLocationId: '',
    weight: '', weightUnit: 'kg',
    length: '', width: '', height: '', dimensionUnit: 'cm',
  });
  const [formData, setFormData] = useState(EMPTY_CREATE);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: storageLocData } = useQuery({
    queryKey: ['inventory', 'storage-locations'],
    queryFn: () => api.get<{ data: StorageLocationOption[] }>('/inventory/storage-locations'),
    staleTime: 300_000,
  });
  const storageLocations: StorageLocationOption[] = (storageLocData as any)?.data ?? (storageLocData as any) ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'products', search, category, brand],
    queryFn: () => api.get<{ data: SKU[]; total: number }>('/inventory/products', {
      params: {
        search: search || undefined,
        category: category || undefined,
        brand: brand || undefined,
        limit: 50,
      },
    }),
    staleTime: 60_000,
  });

  const skus: SKU[] = (data as any)?.data ?? [];
  const total: number = (data as any)?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/inventory/products', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
      toast({ title: 'Product created successfully' });
      setFormOpen(false);
      setFormData(EMPTY_CREATE);
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create product', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/inventory/products/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
      toast({ title: 'Product updated successfully' });
      setEditTarget(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update product', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
      toast({ title: 'Product deleted successfully' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete product', variant: 'destructive' }),
  });

  const handleOpenEdit = (sku: SKU) => {
    setEditTarget(sku);
    setEditForm({
      name: sku.name,
      brand: sku.brand ?? '',
      category: sku.category ?? '',
      baseUnit: sku.baseUnit,
      storageLocationId: sku.storageLocationId ?? '',
      weight: sku.weight != null ? String(sku.weight) : '',
      weightUnit: sku.weightUnit ?? 'kg',
      length: sku.length != null ? String(sku.length) : '',
      width: sku.width != null ? String(sku.width) : '',
      height: sku.height != null ? String(sku.height) : '',
      dimensionUnit: sku.dimensionUnit ?? 'cm',
    });
  };

  const handleCreate = () => {
    if (!formData.code || !formData.name || !formData.itemNumber) return;
    createMutation.mutate({
      code: formData.code,
      name: formData.name,
      itemNumber: formData.itemNumber,
      brand: formData.brand || null,
      category: formData.category || null,
      packagingType: formData.packagingType || null,
      unitsPerInner: formData.unitsPerInner ? parseInt(formData.unitsPerInner) : 1,
      innersPerCarton: formData.innersPerCarton ? parseInt(formData.innersPerCarton) : 1,
      cartonsPerPallet: formData.cartonsPerPallet ? parseInt(formData.cartonsPerPallet) : 1,
      baseUnit: formData.baseUnit,
      storageLocationId: formData.storageLocationId || null,
      weight: formData.weight ? parseFloat(formData.weight) : null,
      weightUnit: formData.weightUnit,
      length: formData.length ? parseFloat(formData.length) : null,
      width: formData.width ? parseFloat(formData.width) : null,
      height: formData.height ? parseFloat(formData.height) : null,
      dimensionUnit: formData.dimensionUnit,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} SKUs with Bill of Materials</p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />Add Product
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search SKU, item #…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 w-64"
          />
        </div>
        <Input placeholder="Category…" value={category} onChange={e => setCategory(e.target.value)} className="h-9 w-36" />
        <Input placeholder="Brand…" value={brand} onChange={e => setBrand(e.target.value)} className="h-9 w-32" />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/60">
              <tr className="border-b border-border">
                <th className="w-6 p-3" />
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Item #</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Name / Code</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Family</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Brand</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Category</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Packaging</th>
                <th className="text-right p-3 text-muted-foreground font-medium text-xs">Units/Inner/Carton/Pallet</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Weight</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Dimensions (L×W×H)</th>
                <th className="text-center p-3 text-muted-foreground font-medium text-xs">BOM</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Storage</th>
                <th className="text-center p-3 text-muted-foreground font-medium text-xs w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={13} className="p-3"><div className="shimmer h-5 rounded" /></td></tr>
                ))
              ) : skus.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-muted-foreground">
                    <BoxesIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    No products found
                  </td>
                </tr>
              ) : (
                skus.map((sku, i) => <SKURow key={sku.id} sku={sku} index={i} onDelete={(id) => deleteMutation.mutate(id)} onEdit={handleOpenEdit} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Product Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-sm">Create New Product</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <Label className="text-xs">Product Code *</Label>
              <Input value={formData.code} onChange={e => setFormData(v => ({ ...v, code: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Item Number *</Label>
              <Input value={formData.itemNumber} onChange={e => setFormData(v => ({ ...v, itemNumber: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Product Name *</Label>
              <Input value={formData.name} onChange={e => setFormData(v => ({ ...v, name: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Brand</Label>
              <Input value={formData.brand} onChange={e => setFormData(v => ({ ...v, brand: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Input value={formData.category} onChange={e => setFormData(v => ({ ...v, category: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Packaging Type</Label>
              <Input value={formData.packagingType} onChange={e => setFormData(v => ({ ...v, packagingType: e.target.value }))} className="h-9 mt-1" placeholder="e.g. Bottle, Box" />
            </div>
            <div>
              <Label className="text-xs">Base Unit</Label>
              <Input value={formData.baseUnit} onChange={e => setFormData(v => ({ ...v, baseUnit: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Units per Inner</Label>
              <Input type="number" value={formData.unitsPerInner} onChange={e => setFormData(v => ({ ...v, unitsPerInner: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Inners per Carton</Label>
              <Input type="number" value={formData.innersPerCarton} onChange={e => setFormData(v => ({ ...v, innersPerCarton: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Cartons per Pallet</Label>
              <Input type="number" value={formData.cartonsPerPallet} onChange={e => setFormData(v => ({ ...v, cartonsPerPallet: e.target.value }))} className="h-9 mt-1" />
            </div>

            {/* Weight */}
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Weight size={12} /> Weight &amp; Dimensions
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Net Weight</Label>
                    <Input type="number" step="0.001" min="0" value={formData.weight}
                      onChange={e => setFormData(v => ({ ...v, weight: e.target.value }))}
                      className="h-9 mt-1" placeholder="0.000" />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Unit</Label>
                    <Select value={formData.weightUnit} onValueChange={v => setFormData(p => ({ ...p, weightUnit: v }))}>
                      <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEIGHT_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Dim. Unit</Label>
                    <Select value={formData.dimensionUnit} onValueChange={v => setFormData(p => ({ ...p, dimensionUnit: v }))}>
                      <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DIM_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Length</Label>
                  <Input type="number" step="0.1" min="0" value={formData.length}
                    onChange={e => setFormData(v => ({ ...v, length: e.target.value }))}
                    className="h-9 mt-1" placeholder="0.0" />
                </div>
                <div>
                  <Label className="text-xs">Width</Label>
                  <Input type="number" step="0.1" min="0" value={formData.width}
                    onChange={e => setFormData(v => ({ ...v, width: e.target.value }))}
                    className="h-9 mt-1" placeholder="0.0" />
                </div>
                <div>
                  <Label className="text-xs">Height</Label>
                  <Input type="number" step="0.1" min="0" value={formData.height}
                    onChange={e => setFormData(v => ({ ...v, height: e.target.value }))}
                    className="h-9 mt-1" placeholder="0.0" />
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <Label className="text-xs">Storage Location (Finished Goods)</Label>
              <Select
                value={formData.storageLocationId || '__none__'}
                onValueChange={v => setFormData(p => ({ ...p, storageLocationId: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select location…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {storageLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.code} — {loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={!formData.code || !formData.name || !formData.itemNumber || createMutation.isPending} onClick={handleCreate}>
              {createMutation.isPending ? 'Creating...' : 'Create Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">Edit Product</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="col-span-2">
              <Label className="text-xs">Product Name *</Label>
              <Input value={editForm.name} onChange={e => setEditForm(v => ({ ...v, name: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Brand</Label>
              <Input value={editForm.brand} onChange={e => setEditForm(v => ({ ...v, brand: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Input value={editForm.category} onChange={e => setEditForm(v => ({ ...v, category: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Base Unit</Label>
              <Input value={editForm.baseUnit} onChange={e => setEditForm(v => ({ ...v, baseUnit: e.target.value }))} className="h-9 mt-1" />
            </div>

            {/* Weight & Dimensions */}
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Weight size={12} /> Weight &amp; Dimensions
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Net Weight</Label>
                    <Input type="number" step="0.001" min="0" value={editForm.weight}
                      onChange={e => setEditForm(v => ({ ...v, weight: e.target.value }))}
                      className="h-9 mt-1" placeholder="0.000" />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Unit</Label>
                    <Select value={editForm.weightUnit} onValueChange={v => setEditForm(p => ({ ...p, weightUnit: v }))}>
                      <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEIGHT_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Dim. Unit</Label>
                    <Select value={editForm.dimensionUnit} onValueChange={v => setEditForm(p => ({ ...p, dimensionUnit: v }))}>
                      <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DIM_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Length</Label>
                  <Input type="number" step="0.1" min="0" value={editForm.length}
                    onChange={e => setEditForm(v => ({ ...v, length: e.target.value }))}
                    className="h-9 mt-1" placeholder="0.0" />
                </div>
                <div>
                  <Label className="text-xs">Width</Label>
                  <Input type="number" step="0.1" min="0" value={editForm.width}
                    onChange={e => setEditForm(v => ({ ...v, width: e.target.value }))}
                    className="h-9 mt-1" placeholder="0.0" />
                </div>
                <div>
                  <Label className="text-xs">Height</Label>
                  <Input type="number" step="0.1" min="0" value={editForm.height}
                    onChange={e => setEditForm(v => ({ ...v, height: e.target.value }))}
                    className="h-9 mt-1" placeholder="0.0" />
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <Label className="text-xs">Storage Location (Finished Goods)</Label>
              <Select
                value={editForm.storageLocationId || '__none__'}
                onValueChange={v => setEditForm(p => ({ ...p, storageLocationId: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select location…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {storageLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.code} — {loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!editForm.name || updateMutation.isPending}
              onClick={() => editTarget && updateMutation.mutate({
                id: editTarget.id,
                dto: {
                  name: editForm.name,
                  brand: editForm.brand || null,
                  category: editForm.category || null,
                  unit: editForm.baseUnit || undefined,
                  storageLocationId: editForm.storageLocationId || null,
                  weight: editForm.weight ? parseFloat(editForm.weight) : null,
                  weightUnit: editForm.weightUnit,
                  length: editForm.length ? parseFloat(editForm.length) : null,
                  width: editForm.width ? parseFloat(editForm.width) : null,
                  height: editForm.height ? parseFloat(editForm.height) : null,
                  dimensionUnit: editForm.dimensionUnit,
                },
              })}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
