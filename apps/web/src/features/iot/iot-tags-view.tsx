'use client';

import React, { useState } from 'react';
import { Plus, Download, Search, Tag, TrendingUp, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FormDialog } from '@/components/ui/form-dialog';
import { InlineFormSlot } from '@/components/ui/inline-form-panel';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { TablePagination } from '@/components/ui/table-pagination';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import { formatDate } from '@/lib/utils';

export function IotTagsView() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editTag, setEditTag] = useState<any | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null)
  const emptyForm = {
    code: '', name: '', deviceId: '', machineId: '', dataType: 'INT', tagType: 'MEASUREMENT',
    unit: '', description: '',
    address: '', registerType: 'HOLDING', wordCount: '1', wordOrder: 'BIG',
    scaleFactor: '', offset: '', counterRole: 'NONE', edgeType: 'RISING', pollIntervalMs: '',
  };
  const [form, setForm] = useState({ ...emptyForm })

  const { data: tags, isLoading } = useQuery({
    queryKey: ['iot', 'tags', { search, page }],
    queryFn: () => api.get('/iot/tags', { params: { search, limit: 20, page } }),
    staleTime: 10_000,
  })

  // Devices for the source dropdown (gateway-pollable Modbus devices + others).
  const { data: devicesResp } = useQuery({
    queryKey: ['iot', 'devices', 'all'],
    queryFn: () => api.get('/iot/devices', { params: { limit: 200 } }),
    staleTime: 30_000,
  })
  const deviceOptions = (devicesResp as any)?.data ?? (Array.isArray(devicesResp) ? devicesResp : []);

  const tagList = (tags as any)?.data ?? [];
  const total: number = (tags as any)?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/iot/tags', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot', 'tags'] })
      toast({ title: 'Tag created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create tag', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/iot/tags/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot', 'tags'] })
      toast({ title: 'Tag updated successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update tag', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/iot/tags/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot', 'tags'] })
      toast({ title: 'Tag deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete tag', variant: 'destructive' }),
  })

  const handleOpenCreate = () => {
    setEditTag(null)
    setForm({ ...emptyForm })
    setFormOpen(true)
  };

  const handleOpenEdit = (tag: any) => {
    setEditTag(tag)
    setForm({
      code: tag.code || '',
      name: tag.name || '',
      deviceId: tag.deviceId || '',
      machineId: tag.machineId || '',
      dataType: tag.dataType || 'INT',
      tagType: tag.tagType || 'MEASUREMENT',
      unit: tag.unit || '',
      description: tag.description || '',
      address: tag.address || '',
      registerType: tag.registerType || 'HOLDING',
      wordCount: String(tag.wordCount ?? 1),
      wordOrder: tag.wordOrder || 'BIG',
      scaleFactor: tag.scaleFactor != null ? String(tag.scaleFactor) : '',
      offset: tag.offset != null ? String(tag.offset) : '',
      counterRole: tag.counterRole || 'NONE',
      edgeType: tag.edgeType || 'RISING',
      pollIntervalMs: tag.pollIntervalMs != null ? String(tag.pollIntervalMs) : '',
    })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditTag(null)
  };

  const handleSubmit = () => {
    // Coerce numeric strings; drop empties so they don't overwrite with NaN/null.
    const num = (s: string) => (s === '' ? undefined : Number(s));
    const dto: any = {
      code: form.code.trim(),
      name: form.name.trim(),
      deviceId: form.deviceId || null,
      machineId: form.machineId || null,
      dataType: form.dataType,
      tagType: form.tagType,
      unit: form.unit || null,
      description: form.description || null,
      address: form.address || null,
      registerType: form.registerType,
      wordCount: num(form.wordCount),
      wordOrder: form.wordOrder,
      scaleFactor: num(form.scaleFactor),
      offset: num(form.offset),
      counterRole: form.tagType === 'COUNTER' ? form.counterRole : 'NONE',
      edgeType: form.edgeType,
      pollIntervalMs: num(form.pollIntervalMs),
    };
    if (editTag) updateMutation.mutate({ id: editTag.id, dto })
    else createMutation.mutate(dto)
  };

  const isValid = !!(form.code && form.name && form.dataType)
  const isCounter = form.tagType === 'COUNTER'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">IoT Tags</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor and manage data tags
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Download size={13} />
            Export
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleOpenCreate}>
            <Plus size={13} />
            Add Tag
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <InlineFormSlot className="mb-6 empty:mb-0" />

        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">All Tags</h3>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tags..."
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
                  <TableHead className="text-[11px] font-semibold">Tag</TableHead>
                  <TableHead className="text-[11px] font-semibold">Device</TableHead>
                  <TableHead className="text-[11px] font-semibold">Type / Role</TableHead>
                  <TableHead className="text-[11px] font-semibold">Data Type</TableHead>
                  <TableHead className="text-[11px] font-semibold">Current Value</TableHead>
                  <TableHead className="text-[11px] font-semibold">Unit</TableHead>
                  <TableHead className="text-[11px] font-semibold">Quality</TableHead>
                  <TableHead className="text-[11px] font-semibold">Last Update</TableHead>
                  <TableHead className="text-[11px] font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="shimmer h-3.5 rounded w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : tagList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                      No tags found
                    </TableCell>
                  </TableRow>
                ) : (
                  tagList.map((tag: any) => (
                    <TableRow key={tag.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                      <TableCell className="text-xs">
                        <div className="font-mono font-semibold text-primary">{tag.code}</div>
                        <div className="text-muted-foreground">{tag.name}</div>
                      </TableCell>
                      <TableCell className="text-xs">{tag.device?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] h-5">{tag.tagType}</Badge>
                        {tag.counterRole && tag.counterRole !== 'NONE' && (
                          <Badge variant="secondary" className="text-[10px] h-5 ml-1">{tag.counterRole}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tag.dataType}</TableCell>
                      <TableCell className="text-xs font-semibold">{tag.currentValue?.value ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tag.unit ?? '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={tag.currentValue?.quality === 'GOOD' ? 'default' : 'outline'}
                          className="text-[10px] h-5"
                        >
                          {tag.currentValue?.quality ?? '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tag.currentValue?.timestamp ? formatDate(tag.currentValue.timestamp) : '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={tag.isActive ? 'default' : 'secondary'}
                          className="text-[10px] h-5"
                        >
                          {tag.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(tag)}>
                              <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ id: tag.id, name: tag.name })}>
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
            <TablePagination page={page} total={total} limit={20} onPageChange={setPage} isLoading={isLoading} />
          </div>
        </div>
      </div>

      <FormDialog
        open={formOpen}
        onClose={handleCloseForm}
        title={editTag ? 'Edit Tag' : 'Create Tag'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tag Code *</Label>
            <Input value={form.code} onChange={e => setForm(v => ({ ...v, code: e.target.value }))} className="mt-1" placeholder="e.g. CNT_GOOD_01" />
          </div>
          <div>
            <Label>Tag Name *</Label>
            <Input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className="mt-1" placeholder="e.g. Good count" />
          </div>
          <div>
            <Label>Tag Type</Label>
            <Select value={form.tagType} onValueChange={v => setForm(f => ({ ...f, tagType: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MEASUREMENT">Measurement</SelectItem>
                <SelectItem value="COUNTER">Counter</SelectItem>
                <SelectItem value="STATUS">Status</SelectItem>
                <SelectItem value="SETPOINT">Setpoint</SelectItem>
                <SelectItem value="ALARM">Alarm</SelectItem>
                <SelectItem value="EVENT">Event</SelectItem>
                <SelectItem value="ENERGY">Energy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data Type *</Label>
            <Select value={form.dataType} onValueChange={v => setForm(f => ({ ...f, dataType: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INT">Integer</SelectItem>
                <SelectItem value="FLOAT">Float</SelectItem>
                <SelectItem value="BOOL">Boolean</SelectItem>
                <SelectItem value="STRING">String</SelectItem>
                <SelectItem value="TIMESTAMP">Timestamp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Source Device</Label>
            <Select value={form.deviceId || 'none'} onValueChange={v => setForm(f => ({ ...f, deviceId: v === 'none' ? '' : v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select device" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {deviceOptions.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unit</Label>
            <Input value={form.unit} onChange={e => setForm(v => ({ ...v, unit: e.target.value }))} className="mt-1" placeholder="e.g. °C, pcs, RPM" />
          </div>

          {/* ── Modbus register binding ── */}
          <div className="col-span-2 pt-2 mt-1 border-t border-border/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Modbus binding
          </div>
          <div>
            <Label>Register Address</Label>
            <Input value={form.address} onChange={e => setForm(v => ({ ...v, address: e.target.value }))} className="mt-1" placeholder="e.g. 100" />
          </div>
          <div>
            <Label>Register Type</Label>
            <Select value={form.registerType} onValueChange={v => setForm(f => ({ ...f, registerType: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HOLDING">Holding Register</SelectItem>
                <SelectItem value="INPUT">Input Register</SelectItem>
                <SelectItem value="COIL">Coil</SelectItem>
                <SelectItem value="DISCRETE">Discrete Input</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Word Count</Label>
            <Select value={form.wordCount} onValueChange={v => setForm(f => ({ ...f, wordCount: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 (16-bit)</SelectItem>
                <SelectItem value="2">2 (32-bit)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Word Order (32-bit)</Label>
            <Select value={form.wordOrder} onValueChange={v => setForm(f => ({ ...f, wordOrder: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BIG">Big-endian</SelectItem>
                <SelectItem value="LITTLE">Little-endian</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Scale Factor</Label>
            <Input value={form.scaleFactor} onChange={e => setForm(v => ({ ...v, scaleFactor: e.target.value }))} className="mt-1" placeholder="e.g. 0.1" />
          </div>
          <div>
            <Label>Offset</Label>
            <Input value={form.offset} onChange={e => setForm(v => ({ ...v, offset: e.target.value }))} className="mt-1" placeholder="e.g. 0" />
          </div>

          {/* ── Counter mapping (only for COUNTER tags) ── */}
          {isCounter && (
            <>
              <div className="col-span-2 pt-2 mt-1 border-t border-border/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Counter mapping — +1 per edge, applied to the machine&apos;s running Job Order
              </div>
              <div>
                <Label>Counter Role</Label>
                <Select value={form.counterRole} onValueChange={v => setForm(f => ({ ...f, counterRole: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="TOTAL">Total (Bad = Total − Good)</SelectItem>
                    <SelectItem value="GOOD">Good</SelectItem>
                    <SelectItem value="BAD">Bad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Edge Trigger</Label>
                <Select value={form.edgeType} onValueChange={v => setForm(f => ({ ...f, edgeType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RISING">Rising (0→1)</SelectItem>
                    <SelectItem value="FALLING">Falling (1→0)</SelectItem>
                    <SelectItem value="CHANGE">Any change</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

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
        title={`Delete tag ${deleteDialog?.name}?`}
        description="This will permanently delete this tag and all historical data."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
