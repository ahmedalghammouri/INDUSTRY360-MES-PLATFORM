'use client';

import React, { useState } from 'react';
import { Plus, Download, Filter, Search, Calendar, Clock, CheckCircle, AlertCircle, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FormDialog } from '@/components/ui/form-dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { KPICard } from '@/components/widgets/kpi-card';
import { TablePagination } from '@/components/ui/table-pagination';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import { formatDate } from '@/lib/utils';

export function MaintenancePreventiveView() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editSchedule, setEditSchedule] = useState<any | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; task: string } | null>(null)
  const [form, setForm] = useState({
    equipment: '', task: '', frequency: 'WEEKLY', estimatedHours: '', assignedTo: '',
  })

  const { data: pmSchedules, isLoading } = useQuery({
    queryKey: ['maintenance', 'preventive', { search, page }],
    queryFn: () => api.get('/maintenance/preventive', { params: { search, limit: 20, page } }),
    staleTime: 30_000,
  })

  const { data: machinesData } = useQuery({
    queryKey: ['hierarchy', 'machines', 'pm-dropdown'],
    queryFn: () => api.get('/hierarchy/machines'),
    staleTime: 120_000,
    enabled: formOpen,
  })
  const { data: usersData } = useQuery({
    queryKey: ['users', 'pm-dropdown'],
    queryFn: () => api.get('/users', { params: { limit: 100 } }),
    staleTime: 120_000,
    enabled: formOpen,
  })
  const machines: Array<{ id: string; name: string; code: string }> = (machinesData as any) ?? []
  const usersList: Array<{ id: string; name: string; role: string }> = (usersData as any)?.data ?? []

  const { data: pmKPIs } = useQuery({
    queryKey: ['maintenance', 'preventive-kpis'],
    queryFn: () => api.get('/maintenance/preventive/kpis'),
    refetchInterval: 60_000,
  })

  const schedules = (pmSchedules as any)?.data ?? [];
  const total: number = (pmSchedules as any)?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/maintenance/preventive', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'preventive'] })
      toast({ title: 'PM schedule created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create schedule', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/maintenance/preventive/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'preventive'] })
      toast({ title: 'PM schedule updated successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update schedule', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/maintenance/preventive/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'preventive'] })
      toast({ title: 'PM schedule deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete schedule', variant: 'destructive' }),
  })

  const handleOpenCreate = () => {
    setEditSchedule(null)
    setForm({ equipment: '', task: '', frequency: 'WEEKLY', estimatedHours: '', assignedTo: '' })
    setFormOpen(true)
  };

  const handleOpenEdit = (schedule: any) => {
    setEditSchedule(schedule)
    setForm({
      equipment: schedule.equipment,
      task: schedule.task,
      frequency: schedule.frequency,
      estimatedHours: String(schedule.estimatedHours || ''),
      assignedTo: schedule.assignedTo || '',
    })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditSchedule(null)
  };

  const handleSubmit = () => {
    const dto = {
      equipment: form.equipment,
      task: form.task,
      frequency: form.frequency,
      estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : undefined,
      assignedTo: (form.assignedTo && form.assignedTo !== '__none__') ? form.assignedTo : undefined,
    };
    if (editSchedule) {
      updateMutation.mutate({ id: editSchedule.id, dto })
    } else {
      createMutation.mutate(dto)
    }
  };

  const isValid = !!(form.equipment && form.task && form.frequency)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Preventive Maintenance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            PM schedules and maintenance planning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Download size={13} />
            Export
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleOpenCreate}>
            <Plus size={13} />
            New PM Schedule
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Total Schedules" value={(pmKPIs as any)?.total ?? 0} isLoading={isLoading} />
          <KPICard title="Due This Week" value={(pmKPIs as any)?.dueThisWeek ?? 0} colorMode="alarm" isLoading={isLoading} />
          <KPICard title="Overdue" value={(pmKPIs as any)?.overdue ?? 0} colorMode="alarm" isLoading={isLoading} />
          <KPICard title="Completed" value={(pmKPIs as any)?.completed ?? 0} colorMode="default" isLoading={isLoading} />
        </div>

        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">PM Schedules</h3>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search schedules..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-8 pl-7 w-48 text-xs"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <TableHead className="text-[11px] font-semibold">Equipment</TableHead>
                  <TableHead className="text-[11px] font-semibold">Task</TableHead>
                  <TableHead className="text-[11px] font-semibold">Frequency</TableHead>
                  <TableHead className="text-[11px] font-semibold">Last Done</TableHead>
                  <TableHead className="text-[11px] font-semibold">Next Due</TableHead>
                  <TableHead className="text-[11px] font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold">Assigned To</TableHead>
                  <TableHead className="text-[11px] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="shimmer h-3.5 rounded w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      No PM schedules found
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((schedule: any) => (
                    <TableRow key={schedule.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                      <TableCell className="text-xs font-medium">{schedule.equipment}</TableCell>
                      <TableCell className="text-xs">{schedule.task}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{schedule.frequency}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(schedule.lastDone)}</TableCell>
                      <TableCell className="text-xs font-medium">{formatDate(schedule.nextDue)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={schedule.status === 'OVERDUE' ? 'destructive' : schedule.status === 'DUE' ? 'outline' : 'secondary'}
                          className="text-[10px] h-5"
                        >
                          {schedule.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{schedule.assignedTo}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(schedule)}>
                              <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ id: schedule.id, task: schedule.task })}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
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
        title={editSchedule ? 'Edit PM Schedule' : 'Create PM Schedule'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Equipment / Machine *</Label>
            <Select value={form.equipment} onValueChange={v => setForm(f => ({ ...f, equipment: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select machine..." /></SelectTrigger>
              <SelectContent className="max-h-52">
                {machines.map((m: any) => (
                  <SelectItem key={m.id} value={m.name}>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{m.name} <span className="font-mono text-muted-foreground">({m.code})</span></span>
                      <span className="text-[10px] text-muted-foreground">{m.line?.name ?? m.area?.name ?? 'Unassigned'}</span>
                    </div>
                  </SelectItem>
                ))}
                {machines.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">No machines found</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Frequency *</Label>
            <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="YEARLY">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Task Description *</Label>
            <Input value={form.task} onChange={e => setForm(v => ({ ...v, task: e.target.value }))} className="mt-1" placeholder="e.g. Lubrication, Filter replacement..." />
          </div>
          <div>
            <Label>Estimated Hours</Label>
            <Input type="number" min="0" step="0.5" value={form.estimatedHours} onChange={e => setForm(v => ({ ...v, estimatedHours: e.target.value }))} className="mt-1" placeholder="0.0" />
          </div>
          <div>
            <Label>Assigned To</Label>
            <Select value={form.assignedTo} onValueChange={v => setForm(f => ({ ...f, assignedTo: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select technician..." /></SelectTrigger>
              <SelectContent className="max-h-52">
                <SelectItem value="__none__">Unassigned</SelectItem>
                {usersList.map(u => (
                  <SelectItem key={u.id} value={u.name}>
                    <span className="text-xs font-medium">{u.name}</span>
                    <span className="text-muted-foreground ml-1 text-[10px]">{u.role.replace(/_/g, ' ')}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete PM schedule for ${deleteDialog?.task}?`}
        description="This will permanently delete this preventive maintenance schedule."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
