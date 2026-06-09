'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, Download, Filter, ChevronDown, AlertTriangle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
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
import { TablePagination } from '@/components/ui/table-pagination';
import { SortableHeader } from '@/components/ui/sortable-header';
import { useSortedData } from '@/lib/use-sorted-data';

type Severity = 'MINOR' | 'MAJOR' | 'CRITICAL';
type NcrStatus = 'OPEN' | 'IN_REVIEW' | 'CAPA_PENDING' | 'RESOLVED' | 'CLOSED';

const SEV: Record<Severity, { label: string; color: string }> = {
  MINOR:    { label: 'Minor',    color: 'text-brand-400' },
  MAJOR:    { label: 'Major',    color: 'text-amber-400' },
  CRITICAL: { label: 'Critical', color: 'text-red-400'   },
};

const STATUS_VARIANT: Record<NcrStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'destructive', IN_REVIEW: 'secondary', CAPA_PENDING: 'outline', RESOLVED: 'default', CLOSED: 'secondary',
};

const STATUS_LABELS: Record<NcrStatus, string> = {
  OPEN: 'Open', IN_REVIEW: 'In Review', CAPA_PENDING: 'CAPA Pending', RESOLVED: 'Resolved', CLOSED: 'Closed',
};

// Valid NCR transitions
const TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_REVIEW', 'RESOLVED'],
  IN_REVIEW: ['CAPA_PENDING', 'RESOLVED'],
  CAPA_PENDING: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

interface NCR {
  id: string;
  ncrNumber: string;
  title: string;
  severity: Severity;
  status: NcrStatus;
  defectCategory?: string;
  affectedQty?: number;
  detectedBy?: { name: string };
  reportedAt: string;
  dueDate?: string;
  machine?: { name: string };
  workOrder?: { orderNumber: string };
}

const EMPTY_NCR_FORM = {
  title: '', severity: 'MINOR', defectCategory: '', quantity: '', machineId: '__none__',
  description: '', detectedAt: new Date().toISOString().slice(0, 10),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
};

export function QualityNcrView() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<NcrStatus | null>(null)
  const [severityFilter, setSeverityFilter] = useState<Severity | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editNCR, setEditNCR] = useState<NCR | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; ncrNumber: string } | null>(null)
  const [form, setForm] = useState(EMPTY_NCR_FORM)

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['quality', 'ncr', { search, status: statusFilter, severity: severityFilter, page }],
    queryFn: () => api.get('/quality/ncr', {
      params: { search: search || undefined, status: statusFilter || undefined, severity: severityFilter || undefined, limit: 20, page },
    }),
    staleTime: 20_000,
  })

  const { data: machinesData } = useQuery({
    queryKey: ['hierarchy', 'machines', 'ncr-dropdown'],
    queryFn: () => api.get('/hierarchy/machines'),
    staleTime: 120_000,
    enabled: formOpen,
  })
  const { data: workOrdersData } = useQuery({
    queryKey: ['production', 'work-orders', 'ncr-dropdown'],
    queryFn: () => api.get('/production/work-orders', { params: { limit: 100 } }),
    staleTime: 60_000,
    enabled: formOpen,
  })
  const machines: Array<{ id: string; name: string; code: string }> = (machinesData as any) ?? []
  const workOrders: Array<{ id: string; orderNumber: string; sku?: { name: string } }> = (workOrdersData as any)?.data ?? []

  const ncrs: NCR[] = (data as any)?.data ?? (data as any) ?? [];
  const total: number = (data as any)?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/quality/ncr', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'ncr'] })
      toast({ title: 'NCR created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create NCR', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/quality/ncr/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'ncr'] })
      toast({ title: 'NCR updated successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update NCR', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quality/ncr/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'ncr'] })
      toast({ title: 'NCR deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete NCR', variant: 'destructive' }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ ncrId, status }: { ncrId: string; status: string }) =>
      api.patch(`/quality/ncr/${ncrId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'ncr'] })
      toast({ title: 'NCR status updated' })
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update NCR', variant: 'destructive' }),
  })

  const openCount = ncrs.filter((n) => n.status === 'OPEN').length;
  const criticalCount = ncrs.filter((n) => n.severity === 'CRITICAL').length;

  const handleOpenCreate = () => {
    setEditNCR(null)
    setForm({ ...EMPTY_NCR_FORM, detectedAt: new Date().toISOString().slice(0, 10) })
    setFormOpen(true)
  };

  const handleOpenEdit = (ncr: NCR) => {
    setEditNCR(ncr)
    setForm({
      title: ncr.title,
      severity: ncr.severity,
      defectCategory: ncr.defectCategory ?? '',
      quantity: (ncr as any).quantity?.toString() ?? '',
      machineId: (ncr as any).machineId ?? '__none__',
      description: (ncr as any).description ?? '',
      detectedAt: ncr.reportedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      dueDate: ncr.dueDate?.slice(0, 10) ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditNCR(null)
  };

  const buildDto = () => ({
    title: form.title,
    severity: form.severity,
    defectCategory: form.defectCategory,
    quantity: parseInt(form.quantity) || 1,
    machineId: (form.machineId && form.machineId !== '__none__') ? form.machineId : undefined,
    description: form.description,
    detectedAt: new Date(form.detectedAt).toISOString(),
    dueDate: new Date(form.dueDate).toISOString(),
  });

  const handleSubmit = () => {
    if (editNCR) {
      updateMutation.mutate({ id: editNCR.id, dto: buildDto() })
    } else {
      createMutation.mutate(buildDto())
    }
  };

  const isValid = !!(
    form.title && form.severity && form.detectedAt && form.dueDate &&
    form.defectCategory && form.description && form.description.length >= 10 && form.quantity
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Non-Conformance Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track and resolve non-conforming product and process issues</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Download size={13} /> Export</Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleOpenCreate}><Plus size={13} /> New NCR</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="industrial-card p-4">
            <p className="text-xs text-muted-foreground">Total NCRs</p>
            <p className="text-2xl font-bold mt-1">{ncrs.length}</p>
          </div>
          <div className="industrial-card p-4">
            <p className="text-xs text-muted-foreground">Open</p>
            <p className="text-2xl font-bold mt-1 text-amber-400">{openCount}</p>
          </div>
          <div className="industrial-card p-4">
            <p className="text-xs text-muted-foreground">Critical</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{criticalCount}</p>
          </div>
          <div className="industrial-card p-4">
            <p className="text-xs text-muted-foreground">Resolved</p>
            <p className="text-2xl font-bold mt-1 text-green-400">
              {ncrs.filter((n) => ['RESOLVED', 'CLOSED'].includes(n.status)).length}
            </p>
          </div>
        </div>

        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold">NCR Register</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-8 pl-7 w-40 text-xs" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Filter size={12} />
                    {statusFilter ? STATUS_LABELS[statusFilter] : 'All Status'}
                    <ChevronDown size={11} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => { setStatusFilter(null); setPage(1); }}>All Status</DropdownMenuItem>
                  {(Object.keys(STATUS_LABELS) as NcrStatus[]).map((k) => (
                    <DropdownMenuItem key={k} onClick={() => { setStatusFilter(k); setPage(1); }}>{STATUS_LABELS[k]}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <TableHead className="text-[11px] font-semibold">NCR #</TableHead>
                  <TableHead className="text-[11px] font-semibold">Title</TableHead>
                  <TableHead className="text-[11px] font-semibold">Severity</TableHead>
                  <TableHead className="text-[11px] font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold">Machine</TableHead>
                  <TableHead className="text-[11px] font-semibold">Work Order</TableHead>
                  <TableHead className="text-[11px] font-semibold">Detected By</TableHead>
                  <TableHead className="text-[11px] font-semibold">Reported</TableHead>
                  <TableHead className="text-[11px] font-semibold">Due</TableHead>
                  <TableHead className="text-[11px] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}><div className="shimmer h-3.5 rounded w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : ncrs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                      No NCRs found
                    </TableCell>
                  </TableRow>
                ) : (
                  ncrs.map((ncr) => {
                    const sev = SEV[ncr.severity];
                    const nextStatuses = TRANSITIONS[ncr.status] ?? [];
                    return (
                      <TableRow key={ncr.id} className="border-border/20 hover:bg-muted/20">
                        <TableCell className="font-mono text-xs font-semibold text-primary">{ncr.ncrNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {ncr.severity === 'CRITICAL' && <AlertTriangle size={11} className="text-red-400 shrink-0" />}
                            <span className="text-xs font-medium truncate max-w-[140px]">{ncr.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-semibold', sev?.color)}>{sev?.label ?? ncr.severity}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[ncr.status] ?? 'secondary'} className="text-[10px] h-5">
                            {STATUS_LABELS[ncr.status] ?? ncr.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ncr.machine?.name ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{ncr.workOrder?.orderNumber ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ncr.detectedBy?.name ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(ncr.reportedAt)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ncr.dueDate ? formatDate(ncr.dueDate) : '—'}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal size={13} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {['OPEN', 'IN_REVIEW'].includes(ncr.status) && (
                                <DropdownMenuItem className="gap-2 text-xs" onClick={() => handleOpenEdit(ncr)}>
                                  <Pencil size={12} /> Edit
                                </DropdownMenuItem>
                              )}
                              {nextStatuses.length > 0 && <DropdownMenuSeparator />}
                              {nextStatuses.map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  className="text-xs"
                                  onClick={() => statusMutation.mutate({ ncrId: ncr.id, status: s })}
                                >
                                  → {STATUS_LABELS[s as NcrStatus] ?? s}
                                </DropdownMenuItem>
                              ))}
                              {['OPEN'].includes(ncr.status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="gap-2 text-destructive text-xs" onClick={() => setDeleteDialog({ id: ncr.id, ncrNumber: ncr.ncrNumber })}>
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
          <TablePagination page={page} total={total} limit={20} onPageChange={setPage} isLoading={isLoading} />
        </div>
      </div>

      <FormDialog
        open={formOpen}
        onClose={handleCloseForm}
        title={editNCR ? 'Edit Non-Conformance Report' : 'Create Non-Conformance Report'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Severity *</Label>
            <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['MINOR', 'MAJOR', 'CRITICAL'] as const).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Detected At *</Label>
            <Input type="date" value={form.detectedAt} onChange={e => setForm(v => ({ ...v, detectedAt: e.target.value }))} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Defect Category *</Label>
            <Input value={form.defectCategory} onChange={e => setForm(v => ({ ...v, defectCategory: e.target.value }))} placeholder="e.g. LABELING, FILL_WEIGHT, SEAL" className="mt-1" />
          </div>
          <div>
            <Label>Non-Conforming Quantity *</Label>
            <Input type="number" min="1" value={form.quantity} onChange={e => setForm(v => ({ ...v, quantity: e.target.value }))} placeholder="Number of defective units" className="mt-1" />
          </div>
          <div>
            <Label>Machine (optional)</Label>
            <Select value={form.machineId} onValueChange={v => setForm(f => ({ ...f, machineId: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select machine..." /></SelectTrigger>
              <SelectContent className="max-h-52">
                <SelectItem value="__none__">None</SelectItem>
                {machines.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex flex-col">
                      <span className="text-xs">{m.name} <span className="font-mono text-muted-foreground">({m.code})</span></span>
                      <span className="text-[10px] text-muted-foreground">{m.line?.name ?? m.area?.name ?? 'Unassigned'}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Resolution Due Date *</Label>
            <Input type="date" value={form.dueDate} onChange={e => setForm(v => ({ ...v, dueDate: e.target.value }))} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label>Description * <span className="text-muted-foreground text-xs">(min 10 characters)</span></Label>
            <textarea
              value={form.description}
              onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
              placeholder="Describe the non-conformance in detail — what was found, where, how many affected..."
              rows={3}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">{form.description.length} / 5000 chars</p>
          </div>
        </div>
      </FormDialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete NCR ${deleteDialog?.ncrNumber}?`}
        description="This will permanently delete this non-conformance report."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
