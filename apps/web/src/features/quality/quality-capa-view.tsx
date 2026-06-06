'use client';

import { useState } from 'react';
import { Plus, Search, ChevronRight, Download, MoreHorizontal, CheckCircle2, ShieldCheck, Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FormDialog } from '@/components/ui/form-dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { api } from '@/services/api.client';
import { cn, formatDate } from '@/lib/utils';

type CapaType = 'CORRECTIVE' | 'PREVENTIVE';
type CapaStatus = 'OPEN' | 'IN_PROGRESS' | 'VERIFICATION' | 'CLOSED';

const TYPE_CFG: Record<CapaType, { label: string; color: string }> = {
  CORRECTIVE: { label: 'Corrective', color: 'text-red-400' },
  PREVENTIVE: { label: 'Preventive', color: 'text-brand-400' },
};

const STATUS_VARIANT: Record<CapaStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'destructive',
  IN_PROGRESS: 'default',
  VERIFICATION: 'outline',
  CLOSED: 'secondary',
};

const STATUS_LABELS: Record<CapaStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  VERIFICATION: 'Verification',
  CLOSED: 'Closed',
};

const TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['VERIFICATION'],
  VERIFICATION: ['CLOSED'],
  CLOSED: [],
};

interface Capa {
  id: string;
  capaNumber: string;
  title: string;
  type: CapaType;
  status: CapaStatus;
  priority: string;
  dueDate?: string;
  effectiveness?: string;
  ncr?: { ncrNumber: string };
  assignedTo?: { name: string };
  createdAt: string;
}

export function QualityCapaView() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CapaStatus | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editCapa, setEditCapa] = useState<Capa | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; capaNumber: string } | null>(null)
  const [form, setForm] = useState({
    title: '', type: 'CORRECTIVE', priority: 'MEDIUM', dueDate: '', ncrId: '__none__', description: '',
  })

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['quality', 'capa', { search, status: statusFilter }],
    queryFn: () => api.get('/quality/capa', {
      params: { search: search || undefined, status: statusFilter || undefined, limit: 50 },
    }),
    staleTime: 20_000,
  })

  const { data: ncrsData } = useQuery({
    queryKey: ['quality', 'ncr', 'capa-dropdown'],
    queryFn: () => api.get('/quality/ncr', { params: { limit: 100, status: 'OPEN,IN_REVIEW,CAPA_PENDING' } }),
    staleTime: 60_000,
    enabled: formOpen,
  })
  const openNcrs: Array<{ id: string; ncrNumber: string; title: string }> = (ncrsData as any)?.data ?? []

  const capas: Capa[] = (data as any)?.data ?? (data as any) ?? [];

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/quality/capa', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'capa'] })
      toast({ title: 'CAPA created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create CAPA', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quality/capa/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'capa'] })
      toast({ title: 'CAPA deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete CAPA', variant: 'destructive' }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ capaId, action }: { capaId: string; action: 'verify' | 'close' }) =>
      api.patch(`/quality/capa/${capaId}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'capa'] })
      toast({ title: 'CAPA updated' })
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed', variant: 'destructive' }),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/quality/capa/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'capa'] })
      toast({ title: 'CAPA updated successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update CAPA', variant: 'destructive' }),
  })

  const stats = [
    { label: 'Open',        value: capas.filter(c => c.status === 'OPEN').length,         color: 'text-red-400'   },
    { label: 'In Progress', value: capas.filter(c => c.status === 'IN_PROGRESS').length,  color: 'text-brand-400' },
    { label: 'Verification',value: capas.filter(c => c.status === 'VERIFICATION').length, color: 'text-amber-400' },
    { label: 'Closed',      value: capas.filter(c => c.status === 'CLOSED').length,       color: 'text-green-400' },
  ];

  const handleOpenCreate = () => {
    setEditCapa(null)
    setForm({ title: '', type: 'CORRECTIVE', priority: 'MEDIUM', dueDate: '', ncrId: '__none__', description: '' })
    setFormOpen(true)
  };

  const handleOpenEdit = (capa: Capa) => {
    setEditCapa(capa)
    setForm({
      title: capa.title,
      type: capa.type,
      priority: capa.priority,
      dueDate: capa.dueDate?.slice(0, 10) ?? '',
      ncrId: (capa as any).ncrId ?? '__none__',
      description: (capa as any).description ?? '',
    })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditCapa(null)
  };

  const buildDto = () => ({
    title: form.title,
    type: form.type,
    priority: form.priority,
    dueDate: form.dueDate || undefined,
    ncrId: (form.ncrId && form.ncrId !== '__none__') ? form.ncrId : undefined,
    description: form.description || undefined,
  });

  const handleSubmit = () => {
    if (editCapa) {
      editMutation.mutate({ id: editCapa.id, dto: buildDto() })
    } else {
      createMutation.mutate(buildDto())
    }
  };

  const isValid = !!(form.title && form.type && form.priority)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">CAPA Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Corrective and Preventive Actions — root cause to effectiveness</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Download size={13} />Export</Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleOpenCreate}><Plus size={13} />New CAPA</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="industrial-card rounded-xl p-4">
              <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold">CAPA Register</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search CAPA..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 w-44 text-xs" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    {statusFilter ? STATUS_LABELS[statusFilter] : 'All Status'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setStatusFilter(null)}>All Status</DropdownMenuItem>
                  {(Object.keys(STATUS_LABELS) as CapaStatus[]).map(k => (
                    <DropdownMenuItem key={k} onClick={() => setStatusFilter(k)}>{STATUS_LABELS[k]}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <TableHead className="text-[11px] font-semibold">CAPA #</TableHead>
                  <TableHead className="text-[11px] font-semibold">Title</TableHead>
                  <TableHead className="text-[11px] font-semibold">Type</TableHead>
                  <TableHead className="text-[11px] font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold">Related NCR</TableHead>
                  <TableHead className="text-[11px] font-semibold">Owner</TableHead>
                  <TableHead className="text-[11px] font-semibold">Due Date</TableHead>
                  <TableHead className="text-[11px] font-semibold">Effectiveness</TableHead>
                  <TableHead className="text-[11px] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}><div className="shimmer h-3.5 rounded w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : capas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">No CAPAs found</TableCell>
                  </TableRow>
                ) : (
                  capas.map(capa => {
                    const typeCfg = TYPE_CFG[capa.type];
                    const overdue = capa.dueDate && new Date(capa.dueDate) < new Date() && capa.status !== 'CLOSED';
                    const nextSteps = TRANSITIONS[capa.status] ?? [];
                    return (
                      <TableRow key={capa.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                        <TableCell className="font-mono text-xs font-semibold text-primary">{capa.capaNumber}</TableCell>
                        <TableCell className="text-xs max-w-[180px]"><span className="truncate block">{capa.title}</span></TableCell>
                        <TableCell><span className={cn('text-[10px] font-semibold', typeCfg?.color)}>{typeCfg?.label ?? capa.type}</span></TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[capa.status] ?? 'secondary'} className="text-[10px] h-5">
                            {STATUS_LABELS[capa.status] ?? capa.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{capa.ncr?.ncrNumber ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{capa.assignedTo?.name ?? '—'}</TableCell>
                        <TableCell className={cn('text-xs', overdue ? 'text-red-400 font-medium' : 'text-muted-foreground')}>
                          {capa.dueDate ? formatDate(capa.dueDate) : '—'}{overdue ? ' ⚠' : ''}
                        </TableCell>
                        <TableCell className="text-xs">
                          {capa.effectiveness
                            ? <span className="text-green-400">{capa.effectiveness}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal size={13} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {['OPEN', 'IN_PROGRESS'].includes(capa.status) && (
                                <DropdownMenuItem className="gap-2 text-xs" onClick={() => handleOpenEdit(capa)}>
                                  <Pencil size={12} /> Edit
                                </DropdownMenuItem>
                              )}
                              {capa.status === 'IN_PROGRESS' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => statusMutation.mutate({ capaId: capa.id, action: 'verify' })}>
                                    <ShieldCheck size={12} /> Submit for Verification
                                  </DropdownMenuItem>
                                </>
                              )}
                              {capa.status === 'VERIFICATION' && (
                                <DropdownMenuItem className="gap-2 text-xs text-green-400" onClick={() => statusMutation.mutate({ capaId: capa.id, action: 'close' })}>
                                  <CheckCircle2 size={12} /> Close CAPA
                                </DropdownMenuItem>
                              )}
                              {['OPEN'].includes(capa.status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="gap-2 text-destructive text-xs" onClick={() => setDeleteDialog({ id: capa.id, capaNumber: capa.capaNumber })}>
                                    <Trash2 size={12} /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <FormDialog
        open={formOpen}
        onClose={handleCloseForm}
        title={editCapa ? 'Edit CAPA' : 'Create CAPA'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || editMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CORRECTIVE">Corrective</SelectItem>
                <SelectItem value="PREVENTIVE">Preventive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Priority *</Label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={e => setForm(v => ({ ...v, dueDate: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Related NCR</Label>
            <Select value={form.ncrId} onValueChange={v => setForm(f => ({ ...f, ncrId: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Link to NCR (optional)..." /></SelectTrigger>
              <SelectContent className="max-h-52">
                <SelectItem value="__none__">None</SelectItem>
                {openNcrs.map(ncr => (
                  <SelectItem key={ncr.id} value={ncr.id}>
                    <span className="font-mono text-xs">{ncr.ncrNumber}</span>
                    <span className="text-muted-foreground ml-2 text-[10px] truncate">{ncr.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} className="mt-1" />
          </div>
        </div>
      </FormDialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete CAPA ${deleteDialog?.capaNumber}?`}
        description="This will permanently delete this corrective/preventive action."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
