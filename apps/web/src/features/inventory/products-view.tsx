'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, BoxesIcon, ChevronDown, ChevronRight, Plus, Edit3, Trash2, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';

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
  family: { name: string; brand: string | null } | null;
  bomComponents: BOMComponent[];
}

const BOM_COLORS: Record<string, string> = {
  RAW: 'text-amber-400',
  PACKAGING: 'text-blue-400',
  CONSUMABLE: 'text-purple-400',
};

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
        <td className="p-3 text-xs text-center">
          {hasBOM ? (
            <Badge variant="secondary" className="text-[10px]">{sku.bomComponents.length} items</Badge>
          ) : (
            <span className="text-muted-foreground text-[10px]">—</span>
          )}
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
          <td colSpan={10} className="px-6 py-3">
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

export function ProductsView() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SKU | null>(null);
  const [editForm, setEditForm] = useState({ name: '', brand: '', category: '', baseUnit: '' });
  const [formData, setFormData] = useState({ code: '', name: '', itemNumber: '', brand: '', category: '', packagingType: '', unitsPerInner: '', innersPerCarton: '', cartonsPerPallet: '', baseUnit: 'PCS' });

  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      setFormData({ code: '', name: '', itemNumber: '', brand: '', category: '', packagingType: '', unitsPerInner: '', innersPerCarton: '', cartonsPerPallet: '', baseUnit: 'PCS' });
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
                <th className="text-center p-3 text-muted-foreground font-medium text-xs">BOM</th>
                <th className="text-center p-3 text-muted-foreground font-medium text-xs w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={10} className="p-3"><div className="shimmer h-5 rounded" /></td></tr>
                ))
              ) : skus.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-muted-foreground">
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">Create New Product</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2 max-h-[400px] overflow-y-auto">
            <div>
              <Label className="text-xs">Product Code*</Label>
              <Input value={formData.code} onChange={e => setFormData(v => ({ ...v, code: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Item Number*</Label>
              <Input value={formData.itemNumber} onChange={e => setFormData(v => ({ ...v, itemNumber: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Product Name*</Label>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Edit Product</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Product Name*</Label>
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
