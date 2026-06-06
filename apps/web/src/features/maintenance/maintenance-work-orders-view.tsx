'use client';

import React, { useState } from 'react';
import {
  Plus, Search, Filter, ChevronDown, MoreHorizontal,
  Wrench, AlertTriangle, Clock, User, CheckCircle, Pencil, Trash2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FormDialog } from '@/components/ui/form-dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { api } from '@/services/api.client';
import { cn, formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  OPEN: 'secondary',
  ASSIGNED: 'outline',
  IN_PROGRESS: 'default',
  ON_HOLD: 'outline',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW:      { label: 'Low',      color: 'text-muted-foreground' },
  MEDIUM:   { label: 'Medium',   color: 'text-brand-400' },
  HIGH:     { label: 'High',     color: 'text-amber-400' },
  CRITICAL: { label: 'Critical', color: 'text-red-400' },
};

const TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: 'Corrective', PREVENTIVE: 'Preventive', PREDICTIVE: 'Predictive', EMERGENCY: 'Emergency',
};

interface MaintWO {
  id: string;
  woNumber: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  machine?: { name: string; code: string };
  assignedTo?: { name: string };
  reportedAt: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
}

const SUMMARY_CARDS = [
  { label: 'Open WOs', key: 'OPEN', icon: AlertTriangle, color: 'text-amber-400' },
  { label: 'In Progress', key: 'IN_PROGRESS', icon: Wrench, color: 'text-brand-400' },
  { label: 'Completed Today', key: 'COMPLETED', icon: CheckCircle, color: 'text-green-400' },
];

const EMPTY_FORM = { woNumber: '', title: '', type: 'CORRECTIVE', priority: 'MEDIUM', machineId: '__none__', description: '', dueDate: '', estimatedHours: '' };

export function MaintenanceWorkOrdersView() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editWO, setEditWO] = useState<MaintWO | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; woNumber: string } | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', 'work-orders', { search, status: statusFilter }],
    queryFn: () => api.get('/maintenance/work-orders', {
      params: { search: search || undefined, status: statusFilter || undefined, limit: 50 },
    }),
    staleTime: 15_000,
  })

  const { data: machinesData } = useQuery({
    queryKey: ['hierarchy', 'machines', 'maint-wo-dropdown'],
    queryFn: () => api.get('/hierarchy/machines'),
    staleTime: 120_000,
    enabled: formOpen,
  })
  const machines: Array<{ id: string; name: string; code: string }> = (machinesData as any) ?? []

  const orders: MaintWO[] = (data as any)?.data ?? (data as any) ?? [];

  // Count by status for summary cards
  const counts = orders.reduce<Record<string, number>>((acc, wo) => {
    acc[wo.status] = (acc[wo.status] ?? 0) + 1;
    return acc;
  }, {})

  const startMutation = useMutation({
    mutationFn: (woId: string) => api.patch(`/maintenance/work-orders/${woId}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', 'work-orders'] })
      toast({ title: 'Maintenance work order started' })
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to start work order', variant: 'destructive' }),
  })

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/maintenance/work-orders', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', 'work-orders'] })
      toast({ title: 'Work order created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create work order', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/maintenance/work-orders/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', 'work-orders'] })
      toast({ title: 'Work order updated successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update work order', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/maintenance/work-orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', 'work-orders'] })
      toast({ title: 'Work order deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete', variant: 'destructive' }),
  })

  const cancelMutation = useMutation({
    mutationFn: (woId: string) => api.patch(`/maintenance/work-orders/${woId}/cancel`, { reason: 'Cancelled by user' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', 'work-orders'] })
      toast({ title: 'Work order cancelled' })
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to cancel work order', variant: 'destructive' }),
  })

  const handleOpenCreate = () => {
    setEditWO(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  };

  const handleOpenEdit = (wo: MaintWO) => {
    setEditWO(wo)
    setForm({
      woNumber: wo.woNumber,
      title: wo.title,
      type: wo.type,
      priority: wo.priority,
      machineId: wo.machine ? (wo as any).machineId ?? '__none__' : '__none__',
      description: (wo as any).description ?? '',
      dueDate: wo.dueDate?.slice(0, 10) ?? '',
      estimatedHours: wo.estimatedHours?.toString() ?? '',
    })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditWO(null)
    setForm(EMPTY_FORM)
  };

  const handleSubmit = () => {
    const dto = {
      title: form.title,
      type: form.type,
      priority: form.priority,
      machineId: (form.machineId && form.machineId !== '__none__') ? form.machineId : undefined,
      description: form.description || undefined,
      dueDate: form.dueDate || undefined,
      estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : undefined,
    }
    if (editWO) {
      updateMutation.mutate({ id: editWO.id, dto })
    } else {
      createMutation.mutate({ ...dto, woNumber: form.woNumber })
    }
  };

  const isValid = !!((editWO ? true : form.woNumber) && form.title && form.type && form.priority)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Maintenance Work Orders</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Corrective, preventive, and emergency maintenance</p>
        </div>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleOpenCreate}>
          <Plus size={13} />
          New Work Order
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {SUMMARY_CARDS.map(({ label, key, icon: Icon, color }) => (
            <div key={key} className="industrial-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon size={14} className={color} />
              </div>
              <p className={cn('text-2xl font-bold mt-1', color)}>{counts[key] ?? 0}</p>
            </div>
          ))}
        </div>

        {/* Work orders table */}
        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold">All Work Orders</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-7 w-44 text-xs"
                />
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
                  <DropdownMenuItem onClick={() => setStatusFilter(null)}>All Status</DropdownMenuItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <DropdownMenuItem key={k} onClick={() => setStatusFilter(k)}>{v}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <TableHead className="text-[11px] font-semibold">WO #</TableHead>
                  <TableHead className="text-[11px] font-semibold">Title</TableHead>
                  <TableHead className="text-[11px] font-semibold">Type</TableHead>
                  <TableHead className="text-[11px] font-semibold">Priority</TableHead>
                  <TableHead className="text-[11px] font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold">Machine</TableHead>
                  <TableHead className="text-[11px] font-semibold">Assigned To</TableHead>
                  <TableHead className="text-[11px] font-semibold">Due</TableHead>
                  <TableHead className="text-[11px] font-semibold">Est. hrs</TableHead>
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
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                      No maintenance work orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((wo) => {
                    const priority = PRIORITY_CONFIG[wo.priority];
                    return (
                      <TableRow key={wo.id} className="border-border/20 hover:bg-muted/20">
                        <TableCell className="font-mono text-xs font-semibold text-primary">{wo.woNumber}</TableCell>
                        <TableCell>
                          <div className="text-xs font-medium max-w-[160px] truncate">{wo.title}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{TYPE_LABELS[wo.type] ?? wo.type}</TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-semibold', priority?.color)}>{priority?.label ?? wo.priority}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_COLORS[wo.status] ?? 'secondary'} className="text-[10px] h-5">
                            {STATUS_LABELS[wo.status] ?? wo.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{wo.machine?.name ?? '—'}</TableCell>
                        <TableCell>
                          {wo.assignedTo ? (
                            <div className="flex items-center gap-1 text-xs">
                              <User size={10} className="text-muted-foreground" />
                              {wo.assignedTo.name}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {wo.dueDate ? formatDate(wo.dueDate) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {wo.estimatedHours ? `${wo.estimatedHours}h` : '—'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal size={13} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2 text-xs" onClick={() => handleOpenEdit(wo)}>
                                <Pencil size={12} /> Edit
                              </DropdownMenuItem>
                              {wo.status === 'ASSIGNED' && (
                                <DropdownMenuItem
                                  className="gap-2 text-xs text-brand-400"
                                  onClick={() => startMutation.mutate(wo.id)}
                                >
                                  <Wrench size={12} /> Start Work
                                </DropdownMenuItem>
                              )}
                              {['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'].includes(wo.status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="gap-2 text-xs text-destructive"
                                    onClick={() => setDeleteDialog({ id: wo.id, woNumber: wo.woNumber })}
                                  >
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
        title={editWO ? 'Edit Maintenance Work Order' : 'Create Maintenance Work Order'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-4">
          {!editWO && (
            <div>
              <Label>WO Number *</Label>
              <Input value={form.woNumber} onChange={e => setForm(v => ({ ...v, woNumber: e.target.value }))} className="mt-1" placeholder="e.g. MWO-001" />
            </div>
          )}
          <div className={editWO ? '' : ''}>
            <Label>Priority *</Label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} className="mt-1" placeholder="Brief description of the maintenance task" />
          </div>
          <div>
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CORRECTIVE">Corrective</SelectItem>
                <SelectItem value="PREVENTIVE">Preventive</SelectItem>
                <SelectItem value="PREDICTIVE">Predictive</SelectItem>
                <SelectItem value="EMERGENCY">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Machine</Label>
            <Select value={form.machineId} onValueChange={v => setForm(f => ({ ...f, machineId: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select machine..." /></SelectTrigger>
              <SelectContent className="max-h-52">
                <SelectItem value="__none__">None</SelectItem>
                {machines.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{m.name} <span className="font-mono text-muted-foreground">({m.code})</span></span>
                      <span className="text-[10px] text-muted-foreground">{m.line?.name ?? m.area?.name ?? 'Unassigned'}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={e => setForm(v => ({ ...v, dueDate: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Estimated Hours</Label>
            <Input type="number" min="0" step="0.5" value={form.estimatedHours} onChange={e => setForm(v => ({ ...v, estimatedHours: e.target.value }))} className="mt-1" placeholder="0.0" />
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} className="mt-1" placeholder="Additional details..." />
          </div>
        </div>
      </FormDialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete work order ${deleteDialog?.woNumber}?`}
        description="This will permanently delete this maintenance work order."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
