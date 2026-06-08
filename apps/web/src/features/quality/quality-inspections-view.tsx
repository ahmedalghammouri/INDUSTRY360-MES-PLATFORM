'use client';

import { useState } from 'react';
import {
  Plus, Search, Download, Filter, ChevronDown, CheckCircle2,
  XCircle, AlertCircle, MoreHorizontal, Pencil, Trash2,
  ClipboardList, Link2, FlaskConical, ChevronRight,
} from 'lucide-react';
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

interface QualityParameter {
  id: string;
  name: string;
  unit?: string;
  nominalValue?: number;
  ucl?: number;
  lcl?: number;
  usl?: number;
  lsl?: number;
  checkMethod?: string;
}

interface QualityPlan {
  id: string;
  code: string;
  name: string;
  type: string;
  parameters: QualityParameter[];
}

interface ChecklistItem {
  parameterId: string;
  parameterName: string;
  measuredValue: string;
  pass: boolean | null;
  notes: string;
}

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
  plan?: { name: string; code: string };
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
  const [expandedWorkOrder, setExpandedWorkOrder] = useState<string | null>(null)
  const [form, setForm] = useState({
    inspectionNumber: '', type: 'INCOMING', totalQty: '', passQty: '', failQty: '',
    workOrderId: '', planId: '', notes: '',
  })
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])

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

  const { data: plansData } = useQuery({
    queryKey: ['quality', 'plans'],
    queryFn: () => api.get('/quality/plans'),
    staleTime: 120_000,
    enabled: formOpen,
  })

  const workOrders: Array<{ id: string; orderNumber: string; sku?: { name: string } }> = (workOrdersData as any)?.data ?? []
  const plans: QualityPlan[] = (plansData as any) ?? []
  const inspections: Inspection[] = (data as any)?.data ?? (data as any) ?? [];
  const total: number = (data as any)?.total ?? 0;

  const selectedPlan = plans.find(p => p.id === form.planId)

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
    setForm({ inspectionNumber: '', type: 'INCOMING', totalQty: '', passQty: '', failQty: '', workOrderId: '', planId: '', notes: '' })
    setChecklist([])
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
      planId: '',
      notes: inspection.notes || '',
    })
    setChecklist([])
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditInspection(null)
    setChecklist([])
  };

  const handlePlanSelect = (planId: string) => {
    setForm(f => ({ ...f, planId }))
    if (planId && planId !== '__none__') {
      const plan = plans.find(p => p.id === planId)
      if (plan) {
        setChecklist(plan.parameters.map(p => ({
          parameterId: p.id,
          parameterName: p.name,
          measuredValue: '',
          pass: null,
          notes: '',
        })))
      }
    } else {
      setChecklist([])
    }
  }

  const updateChecklistItem = (idx: number, field: keyof ChecklistItem, value: any) => {
    setChecklist(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const handleSubmit = () => {
    const measurements = checklist.length > 0
      ? checklist.map(c => ({
          parameterId: c.parameterId,
          parameterName: c.parameterName,
          value: c.measuredValue,
          pass: c.pass,
          notes: c.notes,
        }))
      : undefined;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inspectionNumber: _strip, ...formRest } = form;
    const dto: any = {
      ...formRest,
      type: form.type,
      totalQty: parseInt(form.totalQty),
      passQty: parseInt(form.passQty),
      failQty: form.failQty ? parseInt(form.failQty) : undefined,
      workOrderId: (form.workOrderId && form.workOrderId !== '__none__') ? form.workOrderId : undefined,
      planId: (form.planId && form.planId !== '__none__') ? form.planId : undefined,
      measurements,
    };
    if (editInspection) {
      updateMutation.mutate({ id: editInspection.id, dto })
    } else {
      createMutation.mutate(dto)
    }
  };

  const isValid = !!(form.type && form.totalQty && form.passQty)

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
          <p className="text-xs text-muted-foreground mt-0.5">Incoming, in-process, and final inspection results · linked to Work Orders (ISA-95)</p>
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
                  <TableHead className="text-[11px] font-semibold">Quality Plan</TableHead>
                  <TableHead className="text-[11px] font-semibold">Inspector</TableHead>
                  <TableHead className="text-[11px] font-semibold">Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 11 }).map((_, j) => (
                        <TableCell key={j}><div className="shimmer h-3.5 rounded w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : inspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-sm">
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
                        <TableCell className="text-xs">
                          {ins.workOrder ? (
                            <span className="flex items-center gap-1 font-mono text-primary/80">
                              <Link2 size={10} />
                              {ins.workOrder.orderNumber}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ins.plan ? (
                            <span className="flex items-center gap-1">
                              <ClipboardList size={10} className="text-primary/60" />
                              {ins.plan.name}
                            </span>
                          ) : '—'}
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
        title={editInspection ? 'Edit Inspection' : 'New Inspection'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isValid={isValid}
      >
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Base fields */}
          <div className="grid grid-cols-2 gap-4">
            {editInspection && (
              <div>
                <Label>Inspection Number</Label>
                <Input value={form.inspectionNumber} disabled className="mt-1 font-mono text-xs bg-muted/50" />
              </div>
            )}
            <div className={editInspection ? '' : 'col-span-2'}>
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
              <Label>Work Order (ISA-95 link)</Label>
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
          </div>

          {/* Quality Plan */}
          <div>
            <Label className="flex items-center gap-1.5">
              <ClipboardList size={12} className="text-primary" />
              Quality Plan (ISA-95 QualityTest)
            </Label>
            <Select value={form.planId || '__none__'} onValueChange={handlePlanSelect}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select plan..." /></SelectTrigger>
              <SelectContent className="max-h-52">
                <SelectItem value="__none__">No plan</SelectItem>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-mono text-xs">{p.code}</span>
                    <span className="ml-2">{p.name}</span>
                    <span className="ml-2 text-muted-foreground text-[10px]">{p.type}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quality Checklist (quality parameters from plan) */}
          {checklist.length > 0 && (
            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <FlaskConical size={12} className="text-primary" />
                Quality Check Points ({checklist.length} parameters)
              </Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-2 font-medium text-muted-foreground">Parameter</th>
                      <th className="text-left p-2 font-medium text-muted-foreground w-28">Measured Value</th>
                      <th className="text-center p-2 font-medium text-muted-foreground w-24">Result</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checklist.map((item, idx) => {
                      const param = selectedPlan?.parameters.find(p => p.id === item.parameterId)
                      return (
                        <tr key={item.parameterId} className="border-t">
                          <td className="p-1.5">
                            <div className="font-medium">{item.parameterName}</div>
                            {param && (
                              <div className="text-[10px] text-muted-foreground">
                                {param.nominalValue != null && `Nominal: ${param.nominalValue}`}
                                {param.unit && ` ${param.unit}`}
                                {(param.lsl != null || param.usl != null) && ` | Spec: [${param.lsl ?? '—'}, ${param.usl ?? '—'}]`}
                              </div>
                            )}
                          </td>
                          <td className="p-1.5">
                            <Input
                              value={item.measuredValue}
                              onChange={e => updateChecklistItem(idx, 'measuredValue', e.target.value)}
                              className="h-7 text-xs w-full"
                              placeholder="Enter value"
                            />
                          </td>
                          <td className="p-1.5">
                            <div className="flex gap-1 justify-center">
                              <button
                                type="button"
                                onClick={() => updateChecklistItem(idx, 'pass', true)}
                                className={cn(
                                  'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
                                  item.pass === true
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                                    : 'bg-muted/30 text-muted-foreground hover:bg-green-500/10',
                                )}
                              >
                                <CheckCircle2 size={10} /> Pass
                              </button>
                              <button
                                type="button"
                                onClick={() => updateChecklistItem(idx, 'pass', false)}
                                className={cn(
                                  'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
                                  item.pass === false
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                    : 'bg-muted/30 text-muted-foreground hover:bg-red-500/10',
                                )}
                              >
                                <XCircle size={10} /> Fail
                              </button>
                            </div>
                          </td>
                          <td className="p-1.5">
                            <Input
                              value={item.notes}
                              onChange={e => updateChecklistItem(idx, 'notes', e.target.value)}
                              className="h-7 text-xs w-full"
                              placeholder="Optional..."
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {checklist.filter(c => c.pass === true).length}/{checklist.length} parameters passing
              </p>
            </div>
          )}

          <div>
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
