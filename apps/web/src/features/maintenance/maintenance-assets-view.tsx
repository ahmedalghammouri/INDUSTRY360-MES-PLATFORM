'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Factory, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FormDialog } from '@/components/ui/form-dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  type: string;
  model: string | null;
  manufacturer: string | null;
  location: string | null;
  status: string;
  installDate: string | null;
  lastMaintenanceDate: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-400 border-green-400/40',
  IDLE: 'text-yellow-400 border-yellow-400/40',
  MAINTENANCE: 'text-orange-400 border-orange-400/40',
  DOWN: 'text-red-400 border-red-400/40',
  RETIRED: 'text-gray-400 border-gray-400/40',
};

export function MaintenanceAssetsView() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState({
    assetCode: '', name: '', type: '', model: '', manufacturer: '', location: '', installDate: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', 'assets', search],
    queryFn: () => api.get('/maintenance/assets', {
      params: { search: search || undefined, limit: 50 },
    }),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/maintenance/assets', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'assets'] })
      toast({ title: 'Asset created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create asset', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/maintenance/assets/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'assets'] })
      toast({ title: 'Asset updated successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update asset', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/maintenance/assets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'assets'] })
      toast({ title: 'Asset deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete asset', variant: 'destructive' }),
  })

  const assets: Asset[] = (data as any)?.data ?? (data as any) ?? [];

  const handleOpenCreate = () => {
    setEditAsset(null)
    setForm({ assetCode: '', name: '', type: '', model: '', manufacturer: '', location: '', installDate: '' })
    setFormOpen(true)
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditAsset(asset)
    setForm({
      assetCode: asset.assetCode,
      name: asset.name,
      type: asset.type,
      model: asset.model || '',
      manufacturer: asset.manufacturer || '',
      location: asset.location || '',
      installDate: asset.installDate?.slice(0, 10) || '',
    })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditAsset(null)
  };

  const handleSubmit = () => {
    if (editAsset) {
      updateMutation.mutate({ id: editAsset.id, dto: form })
    } else {
      createMutation.mutate(form)
    }
  };

  const isValid = !!(form.assetCode && form.name && form.type)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance Assets</h1>
          <p className="text-muted-foreground text-sm mt-1">{assets.length} assets registered</p>
        </div>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-2" />Add Asset
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search assets..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-muted-foreground font-medium">Asset Code</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Name</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Type</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Manufacturer</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Model</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Location</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Install Date</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="p-4"><div className="shimmer h-4 rounded w-24" /></td>
                  ))}
                </tr>
              ))
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-muted-foreground">
                  <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  No assets found
                </td>
              </tr>
            ) : (
              assets.map((asset, i) => (
                <motion.tr
                  key={asset.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-white/5"
                >
                  <td className="p-4 font-mono text-xs">{asset.assetCode}</td>
                  <td className="p-4 font-medium">{asset.name}</td>
                  <td className="p-4 text-xs text-muted-foreground">{asset.type}</td>
                  <td className="p-4 text-xs text-muted-foreground">{asset.manufacturer ?? '—'}</td>
                  <td className="p-4 text-xs text-muted-foreground">{asset.model ?? '—'}</td>
                  <td className="p-4 text-xs text-muted-foreground">{asset.location ?? '—'}</td>
                  <td className="p-4">
                    <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[asset.status] ?? '')}>
                      {asset.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{asset.installDate?.slice(0, 10) ?? '—'}</td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEdit(asset)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ id: asset.id, name: asset.name })}>
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

      <FormDialog
        open={formOpen}
        onClose={handleCloseForm}
        title={editAsset ? 'Edit Asset' : 'Create Asset'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Asset Code *</Label>
            <Input value={form.assetCode} onChange={e => setForm(v => ({ ...v, assetCode: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Type *</Label>
            <Input value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value }))} className="mt-1" placeholder="e.g. Machine, Pump, Conveyor" />
          </div>
          <div className="col-span-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Manufacturer</Label>
            <Input value={form.manufacturer} onChange={e => setForm(v => ({ ...v, manufacturer: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Model</Label>
            <Input value={form.model} onChange={e => setForm(v => ({ ...v, model: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm(v => ({ ...v, location: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Install Date</Label>
            <Input type="date" value={form.installDate} onChange={e => setForm(v => ({ ...v, installDate: e.target.value }))} className="mt-1" />
          </div>
        </div>
      </FormDialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete ${deleteDialog?.name}?`}
        description="This will permanently delete this asset and all related data."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
