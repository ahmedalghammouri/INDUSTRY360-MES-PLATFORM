'use client';

import { useState } from 'react';
import { Plus, Search, Download, Filter, ChevronDown, CheckCircle2, XCircle, AlertCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormDialog } from '@/components/ui/form-dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import { cn, formatDate } from '@/lib/utils';
import { TablePagination } from '@/components/ui/table-pagination';

const RESULT_CONFIG = {
  PASS:        { label: 'Pass',        color: 'text-green-400',  icon: CheckCircle2 },
  FAIL:        { label: 'Fail',        color: 'text-red-400',    icon: XCircle      },
  CONDITIONAL: { label: 'Conditional', color: 'text-amber-400',  icon: AlertCircle  },
} as const;

const TYPE_LABELS: Record<string, string> = {
  INCOMING: 'Incoming', IN_PROCESS: 'In-Process', FINAL: 'Final', PATROL: 'Patrol',
};

interface Inspection {
  id: string;
  inspectionNumber: string;
  type: string;
  result: 'PASS' | 'FAIL' | 'CONDITIONAL';
  totalQty: number;
  passQty: number;
  failQty: number;
  inspector?: { name: string };
  workOrder?: { orderNumber: string };
  inspectedAt: string;
  notes?: string;
}

export function QualityInspectionsView() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [resultFilter, setResultFilter] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editInspection, setEditInspection] = useState<Inspection | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; number: string } | null>(null)
  const [form, setForm] = useState({
    inspectionNumber: '', type: 'INCOMING', totalQty: '', passQty: '', failQty: '', workOrderId: '', notes: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['quality', 'inspections', { search, type: typeFilter, result: resultFilter, page }],
    queryFn: () => api.get('/quality/inspections', {
      params: { search: search || undefined, type: typeFilter || undefined, result: resultFilter || undefined, limit: 20, page },
    }),
    staleTime: 20_000,
  })

  const { data: workOrdersData } = useQuery({
    queryKey: ['production', 'work-orders', 'inspection-dropdown'],
    queryFn: () => api.get('/production/work-orders', { params: { limit: 100 } }),
    staleTime: 60_000,
    enabled: formOpen,
  })
  const workOrders: Array<{ id: string; orderNumber: string; sku?: { name: string } }> = (workOrdersData as any)?.data ?? []

  const inspections: Inspection[] = (data as any)?.data ?? (data as any) ?? [];
  const total: number = (data as any)?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/quality/inspections', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quality', 'inspections'] })
      toast({ title: 'Inspection created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create inspection', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/quality/inspections/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quality', 'inspections'] })
      toast({ title: 'Inspection updated successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update inspection', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quality/inspections/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quality', 'inspections'] })
      toast({ title: 'Inspection deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete inspection', variant: 'destructive' }),
  })

  const handleOpenCreate = () => {
    setEditInspection(null)
    setForm({ inspectionNumber: '', type: 'INCOMING', totalQty: '', passQty: '', failQty: '', workOrderId: '', notes: '' })
    setFormOpen(true)
  };

  const handleOpenEdit = (inspection: Inspection) => {
    setEditInspection(inspection)
    setForm({
      inspectionNumber: inspection.inspectionNumber,
      type: inspection.type,
      totalQty: String(inspection.totalQty),
      passQty: String(inspection.passQty),
      failQty: String(inspection.failQty),
      workOrderId: '',
      notes: inspection.notes || '',
    })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditInspection(null)
  };

  const handleSubmit = () => {
    const dto = {
      ...form,
      totalQty: parseInt(form.totalQty),
      passQty: parseInt(form.passQty),
      failQty: parseInt(form.failQty),
      workOrderId: (form.workOrderId && form.workOrderId !== '__none__') ? form.workOrderId : undefined,
    };
    if (editInspection) {
      updateMutation.mutate({ id: editInspection.id, dto })
    } else {
      createMutation.mutate(dto)
    }
  };

  const isValid = !!(form.inspectionNumber && form.type && form.totalQty && form.passQty)

  const summary = {
    total: inspections.length,
    pass: inspections.filter((i) => i.result === 'PASS').length,
    fail: inspections.filter((i) => i.result === 'FAIL').length,
    conditional: inspections.filter((i) => i.result === 'CONDITIONAL').length,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Quality Inspections</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Incoming, in-process, and final inspection results</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Download size={13} /> Export
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleOpenCreate}>
            <Plus size={13} /> New Inspection
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="industrial-card p-4">
            <p className="text-xs text-muted-foreground">Total Today</p>
            <p className="text-2xl font-bold mt-1">{summary.total}</p>
          </div>
          <div className="industrial-card p-4">
            <p className="text-xs text-muted-foreground">Pass</p>
            <p className="text-2xl font-bold mt-1 text-green-400">{summary.pass}</p>
          </div>
          <div className="industrial-card p-4">
            <p className="text-xs text-muted-foreground">Conditional</p>
            <p className="text-2xl font-bold mt-1 text-amber-400">{summary.conditional}</p>
          </div>
          <div className="industrial-card p-4">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{summary.fail}</p>
          </div>
        </div>

        {/* Table */}
        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold">Inspection Records</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-8 pl-7 w-40 text-xs" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Filter size={12} />
                    {typeFilter ? TYPE_LABELS[typeFilter] : 'All Types'}
                    <ChevronDown size={11} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => { setTypeFilter(null); setPage(1); }}>All Types</DropdownMenuItem>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <DropdownMenuItem key={k} onClick={() => { setTypeFilter(k); setPage(1); }}>{v}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Filter size={12} />
                    {resultFilter ?? 'All Results'}
                    <ChevronDown size={11} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => { setResultFilter(null); setPage(1); }}>All Results</DropdownMenuItem>
                  {Object.entries(RESULT_CONFIG).map(([k, v]) => (
                    <DropdownMenuItem key={k} onClick={() => { setResultFilter(k); setPage(1); }}>{v.label}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <TableHead className="text-[11px] font-semibold">Inspection #</TableHead>
                  <TableHead className="text-[11px] font-semibold">Type</TableHead>
                  <TableHead className="text-[11px] font-semibold">Result</TableHead>
                  <TableHead className="text-[11px] font-semibold">Total</TableHead>
                  <TableHead className="text-[11px] font-semibold">Pass</TableHead>
                  <TableHead className="text-[11px] font-semibold">Fail</TableHead>
                  <TableHead className="text-[11px] font-semibold">Work Order</TableHead>
                  <TableHead className="text-[11px] font-semibold">Inspector</TableHead>
                  <TableHead className="text-[11px] font-semibold">Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}><div className="shimmer h-3.5 rounded w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : inspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                      No inspections found
                    </TableCell>
                  </TableRow>
                ) : (
                  inspections.map((ins) => {
                    const result = RESULT_CONFIG[ins.result];
                    const ResultIcon = result?.icon;
                    return (
                      <TableRow key={ins.id} className="border-border/20 hover:bg-muted/20">
                        <TableCell className="font-mono text-xs font-semibold text-primary">{ins.inspectionNumber}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{TYPE_LABELS[ins.type] ?? ins.type}</TableCell>
                        <TableCell>
                          {result && (
                            <div className={cn('flex items-center gap-1 text-xs font-semibold', result.color)}>
                              <ResultIcon size={12} />
                              {result.label}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{ins.totalQty}</TableCell>
                        <TableCell className="text-xs text-green-400">{ins.passQty}</TableCell>
                        <TableCell className="text-xs text-red-400">{ins.failQty > 0 ? ins.failQty : '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {ins.workOrder?.orderNumber ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ins.inspector?.name ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(ins.inspectedAt)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal size={13} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEdit(ins)}>
                                <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ id: ins.id, number: ins.inspectionNumber })}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                              </DropdownMenuItem>
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
        title={editInspection ? 'Edit Inspection' : 'Create Inspection'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Inspection Number *</Label>
            <Input value={form.inspectionNumber} onChange={e => setForm(v => ({ ...v, inspectionNumber: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Total Quantity *</Label>
            <Input type="number" value={form.totalQty} onChange={e => setForm(v => ({ ...v, totalQty: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Pass Quantity *</Label>
            <Input type="number" value={form.passQty} onChange={e => setForm(v => ({ ...v, passQty: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Fail Quantity</Label>
            <Input type="number" value={form.failQty} onChange={e => setForm(v => ({ ...v, failQty: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Work Order</Label>
            <Select value={form.workOrderId} onValueChange={v => setForm(f => ({ ...f, workOrderId: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Link to work order..." /></SelectTrigger>
              <SelectContent className="max-h-52">
                <SelectItem value="__none__">None</SelectItem>
                {workOrders.map(wo => (
                  <SelectItem key={wo.id} value={wo.id}>
                    <span className="font-mono text-xs">{wo.orderNumber}</span>
                    {wo.sku?.name && <span className="text-muted-foreground ml-2 text-[10px]">{wo.sku.name}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} className="mt-1" />
          </div>
        </div>
      </FormDialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete inspection ${deleteDialog?.number}?`}
        description="This will permanently delete this inspection record."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
