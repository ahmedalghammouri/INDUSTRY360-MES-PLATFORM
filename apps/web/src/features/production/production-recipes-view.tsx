'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, BookOpen, FlaskConical, CheckCircle2, Clock3,
  ChevronDown, ChevronRight, Copy, Trash2, Pencil, X, MoreHorizontal,
  Package, Beaker, Send, ShieldCheck, Archive, Info, DollarSign,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EntityPicker } from '@/components/ui/entity-picker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';
import { TablePagination } from '@/components/ui/table-pagination';
import { SortableHeader } from '@/components/ui/sortable-header';
import { useSortedData } from '@/lib/use-sorted-data';

// ── Types ─────────────────────────────────────────────────────

type RecipeStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'OBSOLETE';

interface RecipeIngredient {
  id: string;
  recipeId: string;
  rawMaterialId: string;
  phase?: string;
  quantityPer: number;
  unit: string;
  scrapFactor: number;
  isOptional: boolean;
  notes?: string;
  sortOrder: number;
  rawMaterial: { id: string; code: string; name: string; unit: string; unitCost?: number };
}

interface Recipe {
  id: string;
  code: string;
  version: string;
  name: string;
  description?: string;
  status: RecipeStatus;
  skuId: string;
  processId?: string;
  batchSize?: number;
  batchUnit?: string;
  yieldPct?: number;
  cycleTimeSecs?: number;
  shelfLifeDays?: number;
  storageConditions?: string;
  approvedAt?: string;
  approvedById?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
  estimatedMaterialCost?: number;
  sku: { id: string; code: string; name: string; itemNumber?: string; brand?: string };
  process?: { id: string; name: string; version: string };
  approvedBy?: { id: string; name: string };
  ingredients: RecipeIngredient[];
  _count: { workOrders: number; ingredients: number };
}

// ── Status config ─────────────────────────────────────────────

const STATUS: Record<RecipeStatus, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:    { label: 'Draft',    color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  REVIEW:   { label: 'Review',   color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  APPROVED: { label: 'Approved', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  OBSOLETE: { label: 'Obsolete', color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20' },
};

// ── Empty forms ───────────────────────────────────────────────

const EMPTY_RECIPE_FORM = () => ({
  skuId: '', processId: '', code: '', version: '1.0',
  name: '', description: '',
  batchSize: '', batchUnit: 'kg', yieldPct: '', cycleTimeSecs: '',
  shelfLifeDays: '', storageConditions: '', notes: '',
});

const EMPTY_ING_FORM = () => ({
  rawMaterialId: '', phase: '', quantityPer: '', unit: '', scrapFactor: '0', isOptional: false, notes: '', sortOrder: '0',
});

// ── Main view ─────────────────────────────────────────────────

export function ProductionRecipesView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecipeStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create recipe dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_RECIPE_FORM());

  // Clone dialog
  const [cloneTarget, setCloneTarget] = useState<{ id: string; name: string } | null>(null);
  const [cloneVersion, setCloneVersion] = useState('');

  // Add ingredient dialog
  const [ingTarget, setIngTarget] = useState<{ recipeId: string; status: RecipeStatus } | null>(null);
  const [ingForm, setIngForm] = useState(EMPTY_ING_FORM());

  // ── Sort state ────────────────────────────────────────────

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

  // Reset page when sort changes
  useEffect(() => { setPage(1); }, [sortCol, sortDir]);

  // ── Queries ───────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['production', 'recipes', search, statusFilter, page, sortCol, sortDir],
    queryFn: () => api.get('/production/recipes', {
      params: {
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page,
        limit: 20,
        sortBy: sortCol,
        sortOrder: sortDir,
      },
    }),
    staleTime: 30_000,
  });

  const { data: skusData } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/inventory/products?limit=200'),
    staleTime: 60_000,
    enabled: createOpen,
  });

  const { data: processesData } = useQuery({
    queryKey: ['manufacturing-processes-list'],
    queryFn: () => api.get('/inventory/manufacturing-processes?limit=200'),
    staleTime: 60_000,
    enabled: createOpen,
  });

  const { data: rawMatsData } = useQuery({
    queryKey: ['raw-materials-list'],
    queryFn: () => api.get('/inventory/raw-materials?limit=500'),
    staleTime: 60_000,
    enabled: !!ingTarget,
  });

  const recipes: Recipe[] = (data as any)?.data ?? [];
  const total: number = (data as any)?.total ?? 0;
  const skus: any[] = (skusData as any)?.data ?? [];
  const processes: any[] = (processesData as any)?.data ?? [];
  const rawMaterials: any[] = (rawMatsData as any)?.data ?? [];

  const { sortedData } = useSortedData<Recipe>(recipes, sortCol, sortDir);

  // ── Mutations ─────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: (dto: any) => api.post('/production/recipes', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', 'recipes'] });
      toast({ title: 'Recipe created' });
      setCreateOpen(false);
      setForm(EMPTY_RECIPE_FORM());
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => api.post(`/production/recipes/${id}/submit`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production', 'recipes'] }); toast({ title: 'Submitted for review' }); },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/production/recipes/${id}/approve`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production', 'recipes'] }); toast({ title: 'Recipe approved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const obsoleteMut = useMutation({
    mutationFn: (id: string) => api.post(`/production/recipes/${id}/obsolete`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production', 'recipes'] }); toast({ title: 'Recipe obsoleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const cloneMut = useMutation({
    mutationFn: ({ id, version }: { id: string; version: string }) =>
      api.post(`/production/recipes/${id}/clone`, { version }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', 'recipes'] });
      toast({ title: 'Recipe cloned as new DRAFT' });
      setCloneTarget(null);
      setCloneVersion('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/production/recipes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production', 'recipes'] }); toast({ title: 'Recipe deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const addIngMut = useMutation({
    mutationFn: ({ recipeId, dto }: { recipeId: string; dto: any }) =>
      api.post(`/production/recipes/${recipeId}/ingredients`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', 'recipes'] });
      toast({ title: 'Ingredient added' });
      setIngTarget(null);
      setIngForm(EMPTY_ING_FORM());
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const removeIngMut = useMutation({
    mutationFn: ({ recipeId, ingredientId }: { recipeId: string; ingredientId: string }) =>
      api.delete(`/production/recipes/${recipeId}/ingredients/${ingredientId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production', 'recipes'] }); },
  });

  // ── Handlers ──────────────────────────────────────────────

  const handleCreate = () => {
    if (!form.skuId || !form.code || !form.name) return;
    createMut.mutate({
      skuId: form.skuId,
      processId: form.processId || undefined,
      code: form.code,
      version: form.version,
      name: form.name,
      description: form.description || undefined,
      batchSize: form.batchSize ? parseFloat(form.batchSize) : undefined,
      batchUnit: form.batchUnit || undefined,
      yieldPct: form.yieldPct ? parseFloat(form.yieldPct) : undefined,
      cycleTimeSecs: form.cycleTimeSecs ? parseFloat(form.cycleTimeSecs) : undefined,
      shelfLifeDays: form.shelfLifeDays ? parseInt(form.shelfLifeDays, 10) : undefined,
      storageConditions: form.storageConditions || undefined,
      notes: form.notes || undefined,
    });
  };

  const handleAddIngredient = () => {
    if (!ingTarget || !ingForm.rawMaterialId || !ingForm.quantityPer || !ingForm.unit) return;
    addIngMut.mutate({
      recipeId: ingTarget.recipeId,
      dto: {
        rawMaterialId: ingForm.rawMaterialId,
        phase: ingForm.phase || undefined,
        quantityPer: parseFloat(ingForm.quantityPer),
        unit: ingForm.unit,
        scrapFactor: parseFloat(ingForm.scrapFactor) || 0,
        isOptional: ingForm.isOptional,
        notes: ingForm.notes || undefined,
        sortOrder: parseInt(ingForm.sortOrder, 10) || 0,
      },
    });
  };

  // ── Stats ─────────────────────────────────────────────────

  const counts: Record<RecipeStatus, number> = { DRAFT: 0, REVIEW: 0, APPROVED: 0, OBSOLETE: 0 };
  for (const r of recipes) counts[r.status] = (counts[r.status] ?? 0) + 1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Recipe Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Master production documents linking SKUs → BOM → Routing → Work Orders
          </p>
        </div>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus size={13} />New Recipe
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.entries(STATUS) as [RecipeStatus, (typeof STATUS)[RecipeStatus]][]).map(([s, cfg], i) => (
            <motion.button
              key={s}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
              className={cn(
                'industrial-card rounded-xl p-4 flex items-center gap-3 text-left transition-all',
                statusFilter === s && 'ring-2 ring-primary',
              )}
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', cfg.bg)}>
                {s === 'APPROVED' ? <CheckCircle2 size={16} className={cfg.color} /> :
                 s === 'REVIEW'   ? <Send size={16} className={cfg.color} /> :
                 s === 'OBSOLETE' ? <Archive size={16} className={cfg.color} /> :
                 <BookOpen size={16} className={cfg.color} />}
              </div>
              <div>
                <div className="text-xl font-bold">{(data as any)?.total !== undefined && statusFilter === 'ALL' ? (counts[s] ?? 0) : '—'}</div>
                <div className="text-xs text-muted-foreground">{cfg.label}</div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
          <Info size={14} className="mt-0.5 text-primary shrink-0" />
          <span>
            Status machine: <strong className="text-foreground">DRAFT</strong> → <strong className="text-foreground">REVIEW</strong> → <strong className="text-foreground">APPROVED</strong> → <strong className="text-foreground">OBSOLETE</strong>.
            Only APPROVED recipes can be used in Work Orders. Clone an approved recipe to create a new DRAFT for editing.
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search recipe, code, product..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="h-8 pl-7 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v as any); setPage(1); }}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {Object.entries(STATUS).map(([s, cfg]) => (
                <SelectItem key={s} value={s}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort toolbar */}
        <div className="rounded-lg border bg-muted/20 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <SortableHeader column="code"      label="Code"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader column="name"      label="Name"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader column="status"    label="Status"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader column="version"   label="Version" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader column="yieldPct"  label="Yield"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader column="unitCost"  label="Cost"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader column="updatedAt" label="Updated" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader column="createdAt" label="Created" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
          </table>
        </div>

        {/* Recipe list */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground p-8 text-center">Loading recipes...</div>
          ) : sortedData.length === 0 ? (
            <div className="border rounded-xl p-12 text-center text-sm text-muted-foreground">
              <FlaskConical size={32} className="mx-auto mb-3 opacity-20" />
              No recipes found.
            </div>
          ) : sortedData.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isExpanded={expandedId === recipe.id}
              onToggle={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
              onSubmit={() => submitMut.mutate(recipe.id)}
              onApprove={() => approveMut.mutate(recipe.id)}
              onObsolete={() => obsoleteMut.mutate(recipe.id)}
              onClone={() => { setCloneTarget({ id: recipe.id, name: recipe.name }); setCloneVersion(''); }}
              onDelete={() => deleteMut.mutate(recipe.id)}
              onAddIngredient={() => setIngTarget({ recipeId: recipe.id, status: recipe.status })}
              onRemoveIngredient={(ingredientId) => removeIngMut.mutate({ recipeId: recipe.id, ingredientId })}
            />
          ))}
        </div>

        <TablePagination page={page} total={total} limit={20} onPageChange={setPage} />
      </div>

      {/* Create Recipe Dialog */}
      <AnimatePresence>
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5 border-b flex items-center justify-between">
                <h2 className="font-semibold text-base">Create Recipe</h2>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreateOpen(false)}>
                  <X size={14} />
                </Button>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                {/* SKU */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Product (SKU) *</Label>
                  <EntityPicker
                    items={skus}
                    value={form.skuId}
                    onChange={id => setForm(f => ({ ...f, skuId: id ?? '' }))}
                    getId={(s: any) => s.id}
                    getPrimary={(s: any) => s.name}
                    getSecondary={(s: any) => s.itemNumber}
                    placeholder="Select product..."
                    searchPlaceholder="Search by item number or name…"
                    size="sm"
                    clearable={false}
                  />
                </div>

                {/* Process */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Manufacturing Process (optional)</Label>
                  <EntityPicker
                    items={processes}
                    value={form.processId || null}
                    onChange={id => setForm(f => ({ ...f, processId: id ?? '' }))}
                    getId={(p: any) => p.id}
                    getPrimary={(p: any) => p.name}
                    getSecondary={(p: any) => `v${p.version}`}
                    placeholder="Link to a process..."
                    searchPlaceholder="Search processes…"
                    size="sm"
                  />
                </div>

                {/* Code + Version */}
                <div className="flex flex-col gap-1.5">
                  <Label>Recipe Code *</Label>
                  <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="RCP-001" className="h-8 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Version</Label>
                  <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0" className="h-8 text-sm" />
                </div>

                {/* Name */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Recipe Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard Shampoo Formula" className="h-8 text-sm" />
                </div>

                {/* Batch size + unit */}
                <div className="flex flex-col gap-1.5">
                  <Label>Batch Size</Label>
                  <Input type="number" min="0" value={form.batchSize} onChange={e => setForm(f => ({ ...f, batchSize: e.target.value }))} placeholder="1000" className="h-8 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Batch Unit</Label>
                  <Select value={form.batchUnit} onValueChange={v => setForm(f => ({ ...f, batchUnit: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['kg', 'g', 'L', 'mL', 'unit', 'pcs', 'box'].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Yield + Cycle time */}
                <div className="flex flex-col gap-1.5">
                  <Label>Yield %</Label>
                  <Input type="number" min="0" max="100" value={form.yieldPct} onChange={e => setForm(f => ({ ...f, yieldPct: e.target.value }))} placeholder="98" className="h-8 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Cycle Time (seconds)</Label>
                  <Input type="number" min="0" value={form.cycleTimeSecs} onChange={e => setForm(f => ({ ...f, cycleTimeSecs: e.target.value }))} placeholder="3600" className="h-8 text-sm" />
                </div>

                {/* Shelf life + Storage */}
                <div className="flex flex-col gap-1.5">
                  <Label>Shelf Life (days)</Label>
                  <Input type="number" min="0" value={form.shelfLifeDays} onChange={e => setForm(f => ({ ...f, shelfLifeDays: e.target.value }))} placeholder="365" className="h-8 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Storage Conditions</Label>
                  <Input value={form.storageConditions} onChange={e => setForm(f => ({ ...f, storageConditions: e.target.value }))} placeholder="Store below 25°C" className="h-8 text-sm" />
                </div>

                {/* Notes */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." className="h-8 text-sm" />
                </div>
              </div>
              <div className="p-5 border-t flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={createMut.isPending || !form.skuId || !form.code || !form.name}
                >
                  {createMut.isPending ? 'Creating...' : 'Create Recipe'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Ingredient Dialog */}
      <AnimatePresence>
        {ingTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border rounded-xl shadow-2xl w-full max-w-lg"
            >
              <div className="p-5 border-b flex items-center justify-between">
                <h2 className="font-semibold text-base">Add Ingredient</h2>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIngTarget(null)}>
                  <X size={14} />
                </Button>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Raw Material *</Label>
                  <EntityPicker
                    items={rawMaterials}
                    value={ingForm.rawMaterialId}
                    onChange={(id, mat) => setIngForm(f => ({ ...f, rawMaterialId: id ?? '', unit: (mat as any)?.unit ?? f.unit }))}
                    getId={(m: any) => m.id}
                    getPrimary={(m: any) => m.name}
                    getSecondary={(m: any) => m.code}
                    getMeta={(m: any) => <span className="text-muted-foreground">{m.unit}</span>}
                    placeholder="Select material..."
                    searchPlaceholder="Search by code or name…"
                    size="sm"
                    clearable={false}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Phase / Group</Label>
                  <Input value={ingForm.phase} onChange={e => setIngForm(f => ({ ...f, phase: e.target.value }))} placeholder="A, B, Premix..." className="h-8 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Sort Order</Label>
                  <Input type="number" min="0" value={ingForm.sortOrder} onChange={e => setIngForm(f => ({ ...f, sortOrder: e.target.value }))} className="h-8 text-sm" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Quantity per Batch *</Label>
                  <Input type="number" min="0" step="0.001" value={ingForm.quantityPer} onChange={e => setIngForm(f => ({ ...f, quantityPer: e.target.value }))} placeholder="100" className="h-8 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Unit *</Label>
                  <Select value={ingForm.unit || '_none'} onValueChange={v => setIngForm(f => ({ ...f, unit: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Unit..." /></SelectTrigger>
                    <SelectContent>
                      {['kg', 'g', 'mg', 'L', 'mL', 'unit', 'pcs'].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Scrap Factor %</Label>
                  <Input type="number" min="0" max="100" value={ingForm.scrapFactor} onChange={e => setIngForm(f => ({ ...f, scrapFactor: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Optional?</Label>
                  <Select value={ingForm.isOptional ? 'yes' : 'no'} onValueChange={v => setIngForm(f => ({ ...f, isOptional: v === 'yes' }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No (required)</SelectItem>
                      <SelectItem value="yes">Yes (optional)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-5 border-t flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setIngTarget(null)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={handleAddIngredient}
                  disabled={addIngMut.isPending || !ingForm.rawMaterialId || !ingForm.quantityPer || !ingForm.unit}
                >
                  {addIngMut.isPending ? 'Adding...' : 'Add Ingredient'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clone Dialog */}
      <AnimatePresence>
        {cloneTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border rounded-xl shadow-xl w-full max-w-sm"
            >
              <div className="p-5 border-b flex items-center justify-between">
                <h2 className="font-semibold text-base">Clone Recipe</h2>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCloneTarget(null)}>
                  <X size={14} />
                </Button>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Cloning <strong className="text-foreground">{cloneTarget.name}</strong> will create a new DRAFT recipe with all ingredients copied.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label>New Version *</Label>
                  <Input
                    value={cloneVersion}
                    onChange={e => setCloneVersion(e.target.value)}
                    placeholder="e.g. 2.0"
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-5 border-t flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setCloneTarget(null)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={() => cloneMut.mutate({ id: cloneTarget.id, version: cloneVersion })}
                  disabled={cloneMut.isPending || !cloneVersion.trim()}
                >
                  {cloneMut.isPending ? 'Cloning...' : 'Clone'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Recipe Card ───────────────────────────────────────────────

function RecipeCard({
  recipe, isExpanded, onToggle,
  onSubmit, onApprove, onObsolete, onClone, onDelete,
  onAddIngredient, onRemoveIngredient,
}: {
  recipe: Recipe;
  isExpanded: boolean;
  onToggle: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onObsolete: () => void;
  onClone: () => void;
  onDelete: () => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (id: string) => void;
}) {
  const cfg = STATUS[recipe.status];

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
          <FlaskConical size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground">{recipe.code}</span>
            <span className="font-semibold text-sm">{recipe.name}</span>
            <Badge variant="outline" className="text-[10px] h-4">v{recipe.version}</Badge>
            <Badge className={cn('text-[10px] h-4 border', cfg.bg, cfg.color, cfg.border)}>
              {cfg.label}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
            <span><Package size={10} className="inline mr-0.5" />{recipe.sku.name}</span>
            {recipe.batchSize && <span>{recipe.batchSize} {recipe.batchUnit}</span>}
            {recipe.yieldPct != null && <span>{recipe.yieldPct}% yield</span>}
            {recipe.cycleTimeSecs != null && <span><Clock3 size={10} className="inline mr-0.5" />{(recipe.cycleTimeSecs / 60).toFixed(0)} min</span>}
            <span>{recipe._count.ingredients} ingredients</span>
            {recipe.estimatedMaterialCost != null && (
              <span className="text-green-400 flex items-center gap-0.5">
                <DollarSign size={9} />{recipe.estimatedMaterialCost.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {recipe.status === 'DRAFT' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onSubmit}>
              <Send size={11} className="mr-1" />Review
            </Button>
          )}
          {recipe.status === 'REVIEW' && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-green-500 border-green-500/30 hover:bg-green-500/10" onClick={onApprove}>
              <ShieldCheck size={11} className="mr-1" />Approve
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal size={13} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onClone}>
                <Copy size={12} className="mr-2" />Clone to new version
              </DropdownMenuItem>
              {recipe.status === 'APPROVED' && (
                <DropdownMenuItem onClick={onObsolete} className="text-amber-500">
                  <Archive size={12} className="mr-2" />Mark Obsolete
                </DropdownMenuItem>
              )}
              {recipe.status === 'DRAFT' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 size={12} className="mr-2" />Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded: Ingredients */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Bill of Materials ({recipe.ingredients?.length ?? 0} ingredients)
                </div>
                {(recipe.status === 'DRAFT' || recipe.status === 'REVIEW') && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAddIngredient}>
                    <Plus size={11} className="mr-1" />Add Ingredient
                  </Button>
                )}
              </div>

              {(recipe.ingredients?.length ?? 0) === 0 ? (
                <div className="text-xs text-muted-foreground p-4 border rounded-lg border-dashed text-center">
                  No ingredients yet. Add raw materials to define the BOM.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Material</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Phase</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty/Batch</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Scrap %</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost/unit</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(recipe.ingredients ?? []).map((ing, i) => (
                        <tr key={ing.id} className={cn('border-t', i % 2 === 0 ? '' : 'bg-muted/20')}>
                          <td className="px-3 py-2">
                            <div className="font-medium">{ing.rawMaterial.name}</div>
                            <div className="text-[10px] text-muted-foreground">{ing.rawMaterial.code}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{ing.phase || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <span className="font-mono">{ing.quantityPer} {ing.unit}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {ing.scrapFactor > 0 ? `${ing.scrapFactor}%` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {ing.rawMaterial.unitCost != null ? `$${ing.rawMaterial.unitCost}` : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {(recipe.status === 'DRAFT' || recipe.status === 'REVIEW') && (
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                onClick={() => onRemoveIngredient(ing.id)}
                              >
                                <Trash2 size={11} />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {recipe.estimatedMaterialCost != null && (
                      <tfoot className="border-t bg-muted/30">
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                            Estimated material cost / batch:
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-green-400">
                            ${recipe.estimatedMaterialCost.toFixed(2)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* Meta */}
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                {recipe.process && (
                  <div><span className="font-medium text-foreground">Process:</span> {recipe.process.name} v{recipe.process.version}</div>
                )}
                {recipe.shelfLifeDays && (
                  <div><span className="font-medium text-foreground">Shelf Life:</span> {recipe.shelfLifeDays} days</div>
                )}
                {recipe.storageConditions && (
                  <div><span className="font-medium text-foreground">Storage:</span> {recipe.storageConditions}</div>
                )}
                {recipe.approvedBy && (
                  <div><span className="font-medium text-foreground">Approved by:</span> {recipe.approvedBy.name}</div>
                )}
                {recipe._count.workOrders > 0 && (
                  <div><span className="font-medium text-foreground">Work Orders:</span> {recipe._count.workOrders}</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
