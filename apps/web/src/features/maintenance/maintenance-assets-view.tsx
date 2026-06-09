'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Search, Factory, Cpu, Activity, Layers, Shield, Calendar, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { TableRowActions } from '@/components/ui/table-row-actions';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';
import { SortableHeader } from '@/components/ui/sortable-header';
import { useSortedData } from '@/lib/use-sorted-data';
import { TablePagination } from '@/components/ui/table-pagination';

interface Area { id: string; name: string; code: string }
interface Line { id: string; name: string; code: string; areaId: string }

interface Asset {
  id: string;
  code: string;
  name: string;
  machineType: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  criticality: string;
  installDate: string | null;
  warrantyExpiry: string | null;
  area: Area | null;
  line: Line | null;
  status: string;
  isActive: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  RUNNING:     { label: 'Running',     cls: 'text-green-400 border-green-400/30 bg-green-400/10' },
  IDLE:        { label: 'Idle',        cls: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' },
  MAINTENANCE: { label: 'Maintenance', cls: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
  BREAKDOWN:   { label: 'Breakdown',   cls: 'text-red-400 border-red-400/30 bg-red-400/10' },
  OFFLINE:     { label: 'Offline',     cls: 'text-gray-400 border-gray-400/30 bg-gray-400/10' },
};

const CRITICALITY_CONFIG: Record<string, { label: string; cls: string }> = {
  LOW:      { label: 'Low',      cls: 'text-muted-foreground' },
  MEDIUM:   { label: 'Medium',   cls: 'text-brand-400' },
  HIGH:     { label: 'High',     cls: 'text-amber-400' },
  CRITICAL: { label: 'Critical', cls: 'text-red-400 font-semibold' },
};

const MACHINE_TYPES = [
  'MACHINE', 'CONVEYOR', 'ROBOT', 'PALLETIZER', 'CHECKWEIGHER',
  'FILLING_MACHINE', 'CARTONING_MACHINE', 'COMPRESSOR', 'BOILER',
  'PUMP', 'MIXER', 'CHILLER', 'TRANSFORMER',
];

const EMPTY_FORM = {
  code: '', name: '', machineType: 'MACHINE', manufacturer: '', model: '',
  serialNumber: '', areaId: '', lineId: '', criticality: 'MEDIUM',
  installDate: '', warrantyExpiry: '',
};

export function MaintenanceAssetsView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', 'assets', search],
    queryFn: () => api.get('/maintenance/assets', { params: { search: search || undefined, limit: 100 } }),
    staleTime: 30_000,
  });

  const { data: areasData } = useQuery({
    queryKey: ['hierarchy', 'areas'],
    queryFn: () => api.get('/hierarchy/areas'),
    staleTime: 120_000,
    enabled: formOpen,
  });

  const { data: linesData } = useQuery({
    queryKey: ['hierarchy', 'lines', form.areaId],
    queryFn: () => api.get('/hierarchy/lines', { params: { areaId: form.areaId || undefined } }),
    staleTime: 120_000,
    enabled: formOpen,
  });

  const areas: Area[] = (areasData as any) ?? [];
  const lines: Line[] = ((linesData as any) ?? []).filter((l: any) =>
    !form.areaId || l.areaId === form.areaId
  );
  const assets: Asset[] = (data as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/maintenance/assets', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'assets'] });
      qc.invalidateQueries({ queryKey: ['hierarchy'] });
      toast({ title: 'Asset created', variant: 'success' });
      handleClose();
    },
    onError: (e: any) => toast({ title: 'Failed to create asset', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/maintenance/assets/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'assets'] });
      qc.invalidateQueries({ queryKey: ['hierarchy'] });
      toast({ title: 'Asset updated', variant: 'success' });
      handleClose();
    },
    onError: (e: any) => toast({ title: 'Failed to update asset', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/maintenance/assets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'assets'] });
      qc.invalidateQueries({ queryKey: ['hierarchy'] });
      toast({ title: 'Asset deactivated' });
      setDeleteDialog(null);
    },
    onError: (e: any) => toast({ title: 'Failed to delete asset', description: e?.response?.data?.message, variant: 'destructive' }),
  });

  const handleOpenCreate = () => {
    setEditAsset(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditAsset(asset);
    setForm({
      code: asset.code,
      name: asset.name,
      machineType: asset.machineType,
      manufacturer: asset.manufacturer ?? '',
      model: asset.model ?? '',
      serialNumber: asset.serialNumber ?? '',
      areaId: asset.area?.id ?? '',
      lineId: asset.line?.id ?? '',
      criticality: asset.criticality,
      installDate: asset.installDate?.slice(0, 10) ?? '',
      warrantyExpiry: asset.warrantyExpiry?.slice(0, 10) ?? '',
    });
    setFormOpen(true);
  };

  const handleClose = () => { setFormOpen(false); setEditAsset(null); };

  const handleSubmit = () => {
    const dto = {
      ...form,
      areaId: form.areaId || undefined,
      lineId: form.lineId || undefined,
      installDate: form.installDate || undefined,
      warrantyExpiry: form.warrantyExpiry || undefined,
    };
    if (editAsset) updateMutation.mutate({ id: editAsset.id, dto });
    else createMutation.mutate(dto);
  };

  const isValid = !!(form.code && form.name && form.machineType);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Maintenance Assets</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {assets.length} assets — linked to plant hierarchy
          </p>
        </div>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleOpenCreate}>
          <Plus size={13} />New Asset
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-7 w-56 text-xs"
            />
          </div>
        </div>

        <div className="industrial-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                {['Code', 'Asset Name', 'Type', 'Hierarchy Location', 'Criticality', 'Manufacturer / Model', 'Status', 'Install Date', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/20">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="shimmer h-3.5 rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-muted-foreground">
                    <Factory className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No assets found</p>
                    <p className="text-xs mt-1">Create your first asset to start tracking maintenance</p>
                  </td>
                </tr>
              ) : (
                assets.map((asset, i) => {
                  const statusCfg = STATUS_CONFIG[asset.status] ?? STATUS_CONFIG.OFFLINE;
                  const critCfg = CRITICALITY_CONFIG[asset.criticality] ?? CRITICALITY_CONFIG.MEDIUM;
                  const hasHierarchy = !!(asset.area || asset.line);
                  return (
                    <motion.tr
                      key={asset.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-border/20 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{asset.code}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Cpu size={12} className="text-brand-400 shrink-0" />
                          <span className="text-xs font-medium">{asset.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {asset.machineType?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        {hasHierarchy ? (
                          <div className="flex items-center gap-1 text-xs">
                            <Link2 size={10} className="text-brand-400 shrink-0" />
                            <div>
                              {asset.area && (
                                <div className="flex items-center gap-1">
                                  <Layers size={9} className="text-purple-400" />
                                  <span className="text-muted-foreground">{asset.area.name}</span>
                                </div>
                              )}
                              {asset.line && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Activity size={9} className="text-brand-400" />
                                  <span className="font-medium">{asset.line.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground/50">
                            <Unlink size={10} />
                            <span>Not linked</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium', critCfg.cls)}>{critCfg.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium">{asset.manufacturer ?? '—'}</div>
                        {asset.model && <div className="text-[10px] text-muted-foreground">{asset.model}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', statusCfg.cls)}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {asset.installDate?.slice(0, 10) ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <TableRowActions
                          onEdit={() => handleOpenEdit(asset)}
                          onDelete={() => setDeleteDialog({ id: asset.id, name: asset.name })}
                        />
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={o => !o && handleClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Cpu size={14} className="text-brand-400" />
              {editAsset ? `Edit Asset — ${editAsset.code}` : 'Register New Asset'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assets are machines registered in the system. Link them to the plant hierarchy (Area/Line) to enable location-aware maintenance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1 max-h-[70vh] overflow-y-auto pr-1">
            {/* Identity */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Identity</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Asset Code <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="e.g. MCH-001"
                    className="h-9"
                    disabled={!!editAsset}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Machine Type <span className="text-destructive">*</span></Label>
                  <Select value={form.machineType} onValueChange={v => setForm(f => ({ ...f, machineType: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MACHINE_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Asset Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Cartomac Packing Machine #3"
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Hierarchy Location */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Link2 size={10} className="text-brand-400" />
                Hierarchy Location
                <span className="font-normal text-muted-foreground/60 normal-case tracking-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Layers size={10} className="text-purple-400" />Area
                  </Label>
                  <Select
                    value={form.areaId || '__none__'}
                    onValueChange={v => setForm(f => ({ ...f, areaId: v === '__none__' ? '' : v, lineId: '' }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select area..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No area</SelectItem>
                      {areas.map((a: Area) => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Activity size={10} className="text-brand-400" />Production Line
                  </Label>
                  <Select
                    value={form.lineId || '__none__'}
                    onValueChange={v => setForm(f => ({ ...f, lineId: v === '__none__' ? '' : v }))}
                    disabled={!form.areaId}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={form.areaId ? 'Select line...' : 'Select area first'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No line</SelectItem>
                      {lines.map((l: Line) => (
                        <SelectItem key={l.id} value={l.id}>{l.name} ({l.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(form.areaId || form.lineId) && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-brand-400 bg-brand-400/5 border border-brand-400/20 rounded-md px-2.5 py-1.5">
                  <Link2 size={10} />
                  <span>
                    This asset will appear in the Plant Hierarchy under{' '}
                    {form.lineId
                      ? lines.find(l => l.id === form.lineId)?.name ?? 'the selected line'
                      : areas.find(a => a.id === form.areaId)?.name ?? 'the selected area'
                    }
                  </span>
                </div>
              )}
            </div>

            {/* Technical Details */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Technical Details</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Manufacturer</Label>
                  <Input value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} className="h-9" placeholder="e.g. Bosch" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model</Label>
                  <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className="h-9" placeholder="e.g. CP700" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Serial Number</Label>
                  <Input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} className="h-9" />
                </div>
              </div>
            </div>

            {/* Risk & Dates */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Risk & Dates</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Shield size={10} className="text-amber-400" />Criticality</Label>
                  <Select value={form.criticality} onValueChange={v => setForm(f => ({ ...f, criticality: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(c => (
                        <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Calendar size={10} />Install Date</Label>
                  <Input type="date" value={form.installDate} onChange={e => setForm(f => ({ ...f, installDate: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Warranty Expiry</Label>
                  <Input type="date" value={form.warrantyExpiry} onChange={e => setForm(f => ({ ...f, warrantyExpiry: e.target.value }))} className="h-9" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={!isValid || createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit}
            >
              {createMutation.isPending || updateMutation.isPending
                ? (editAsset ? 'Saving…' : 'Creating…')
                : (editAsset ? 'Save Changes' : 'Register Asset')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Deactivate ${deleteDialog?.name}?`}
        description="The asset will be deactivated and hidden from the hierarchy. Its maintenance history is preserved."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
