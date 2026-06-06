'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Download, BookOpen, FlaskConical, Settings2, Copy, Lock, Unlock, MoreHorizontal, Pencil, Trash2, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FormDialog } from '@/components/ui/form-dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';

interface SKU { id: string; name: string; code: string; itemNumber?: string; brand?: string; weight?: number }

interface Recipe {
  id: string; code: string; name: string; product: string; version: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'LOCKED';
  cycleTime: number; yield: number; steps: number; materials: number;
  lastModified: string; modifiedBy?: string;
}

const STATUS_CONFIG = {
  ACTIVE:   { label:'Active',   color:'text-green-400',  bg:'bg-green-500/10' },
  DRAFT:    { label:'Draft',    color:'text-amber-400',  bg:'bg-amber-500/10' },
  ARCHIVED: { label:'Archived', color:'text-slate-400',  bg:'bg-slate-500/10' },
  LOCKED:   { label:'Locked',   color:'text-purple-400', bg:'bg-purple-500/10'},
};

export function ProductionRecipesView() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState({
    code: '', name: '', product: '', version: '', status: 'DRAFT', cycleTime: '', yieldPct: '', steps: '', materials: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['production', 'recipes', search],
    queryFn: () => api.get('/production/recipes', {
      params: { search: search || undefined, limit: 50 },
    }),
    staleTime: 30_000,
  })

  const { data: skusData } = useQuery({
    queryKey: ['inventory', 'products', 'recipes-dropdown'],
    queryFn: () => api.get('/inventory/products', { params: { limit: 200 } }),
    staleTime: 120_000,
    enabled: formOpen,
  })
  const skus: SKU[] = (skusData as any)?.data ?? []

  const recipes: Recipe[] = (data as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/production/recipes', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', 'recipes'] })
      toast({ title: 'Recipe created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create recipe', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/production/recipes/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', 'recipes'] })
      toast({ title: 'Recipe updated successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update recipe', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/production/recipes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', 'recipes'] })
      toast({ title: 'Recipe deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete recipe', variant: 'destructive' }),
  })

  const handleOpenCreate = () => {
    setEditRecipe(null)
    setForm({ code: '', name: '', product: '', version: '', status: 'DRAFT', cycleTime: '', yieldPct: '', steps: '', materials: '' })
    setFormOpen(true)
  };

  const handleOpenEdit = (recipe: Recipe) => {
    setEditRecipe(recipe)
    setForm({
      code: recipe.code,
      name: recipe.name,
      product: recipe.product,
      version: recipe.version,
      status: recipe.status,
      cycleTime: String(recipe.cycleTime),
      yieldPct: String(recipe.yield),
      steps: String(recipe.steps),
      materials: String(recipe.materials),
    })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditRecipe(null)
  };

  const handleSubmit = () => {
    const dto = {
      code: form.code,
      name: form.name,
      product: form.product,
      version: form.version,
      status: form.status,
      cycleTime: parseFloat(form.cycleTime),
      yield: parseFloat(form.yieldPct || '0'),
      steps: parseInt(form.steps),
      materials: parseInt(form.materials || '0'),
    };
    if (editRecipe) {
      updateMutation.mutate({ id: editRecipe.id, dto })
    } else {
      createMutation.mutate(dto)
    }
  };

  const isValid = !!(form.code && form.name && form.product && form.version && form.cycleTime && form.steps)

  const filtered = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase()) ||
    r.product.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Recipe Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Define, version, and manage production process recipes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Download size={13} />Export</Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleOpenCreate}><Plus size={13} />New Recipe</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:'Total Recipes', value: recipes.length, icon: BookOpen, color:'text-brand-400' },
            { label:'Active',        value: recipes.filter(r=>r.status==='ACTIVE').length,   icon: FlaskConical, color:'text-green-400' },
            { label:'Draft',         value: recipes.filter(r=>r.status==='DRAFT').length,    icon: Settings2,    color:'text-amber-400' },
            { label:'Locked',        value: recipes.filter(r=>r.status==='LOCKED').length,   icon: Lock,         color:'text-purple-400'},
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.label} initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.05 }}
                className="industrial-card rounded-xl p-4 flex items-center gap-3">
                <Icon className={cn('w-8 h-8', s.color)} />
                <div><div className="text-2xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
              </motion.div>
            )
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search recipe or product..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 text-xs" />
          </div>
        </div>

        {/* Recipe cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="industrial-card rounded-xl p-4"><div className="shimmer h-32 rounded" /></div>
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">No recipes found</div>
          ) : (
            filtered.map((recipe, i) => {
            const cfg = STATUS_CONFIG[recipe.status];
            return (
              <motion.div key={recipe.id} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.04 }}
                className="industrial-card rounded-xl p-4 flex flex-col gap-3 hover:border-brand-500/40 cursor-pointer transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[10px] text-muted-foreground">{recipe.code} · {recipe.version}</div>
                    <div className="font-semibold text-sm mt-0.5 leading-tight">{recipe.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{recipe.product}</div>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0', cfg.bg, cfg.color)}>
                    {recipe.status === 'LOCKED' ? <Lock size={9}/> : <Unlock size={9}/>}
                    {cfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label:'Cycle Time', value:`${recipe.cycleTime}s` },
                    { label:'Steps',      value:recipe.steps },
                    { label:'Materials',  value:recipe.materials },
                  ].map(m => (
                    <div key={m.label} className="bg-muted/30 rounded-lg p-2">
                      <div className="text-sm font-bold">{m.value}</div>
                      <div className="text-[10px] text-muted-foreground">{m.label}</div>
                    </div>
                  ))}
                </div>

                {recipe.yield > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Expected Yield</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width:`${recipe.yield}%` }} />
                    </div>
                    <span className="text-green-400 font-medium">{recipe.yield}%</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground">Modified {recipe.lastModified.slice(0, 10)}{recipe.modifiedBy ? ` by ${recipe.modifiedBy}` : ''}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal size={11}/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(recipe)}>
                        <Pencil className="w-3 h-3 mr-2" />Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem><Copy className="w-3 h-3 mr-2" />Duplicate</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ id: recipe.id, name: recipe.name })}>
                        <Trash2 className="w-3 h-3 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            )
          })
          )}
        </div>
      </div>

      <FormDialog
        open={formOpen}
        onClose={handleCloseForm}
        title={editRecipe ? 'Edit Recipe' : 'Create Recipe'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Recipe Code *</Label>
            <Input value={form.code} onChange={e => setForm(v => ({ ...v, code: e.target.value }))} className="mt-1" placeholder="RCP-001" />
          </div>
          <div>
            <Label>Version *</Label>
            <Input value={form.version} onChange={e => setForm(v => ({ ...v, version: e.target.value }))} className="mt-1" placeholder="v1.0" />
          </div>
          <div className="col-span-2">
            <Label>Recipe Name *</Label>
            <Input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="flex items-center gap-1.5"><Package size={11} className="text-muted-foreground" />Product / SKU *</Label>
            <Select value={form.product} onValueChange={v => setForm(f => ({ ...f, product: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select a product..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {skus.length === 0
                  ? <SelectItem value="_none" disabled>No products available</SelectItem>
                  : skus.map(sku => (
                    <SelectItem key={sku.id} value={sku.name}>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{sku.name}</span>
                        <span className="text-[10px] text-muted-foreground">{sku.itemNumber ?? sku.code}{sku.brand ? ` · ${sku.brand}` : ''}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status *</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="LOCKED">Locked</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cycle Time (s) *</Label>
            <Input type="number" value={form.cycleTime} onChange={e => setForm(v => ({ ...v, cycleTime: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Expected Yield (%)</Label>
            <Input type="number" value={form.yieldPct} onChange={e => setForm(v => ({ ...v, yieldPct: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Steps *</Label>
            <Input type="number" value={form.steps} onChange={e => setForm(v => ({ ...v, steps: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Materials</Label>
            <Input type="number" value={form.materials} onChange={e => setForm(v => ({ ...v, materials: e.target.value }))} className="mt-1" />
          </div>
        </div>
      </FormDialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete recipe ${deleteDialog?.name}?`}
        description="This will permanently delete this recipe and all related data."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
