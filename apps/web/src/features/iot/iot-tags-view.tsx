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
  const [form, setForm] = useState({
    name: '', deviceId: '', dataType: 'FLOAT', unit: '', description: '',
  })

  const { data: tags, isLoading } = useQuery({
    queryKey: ['iot', 'tags', { search, page }],
    queryFn: () => api.get('/iot/tags', { params: { search, limit: 20, page } }),
    staleTime: 10_000,
  })

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
    setForm({ name: '', deviceId: '', dataType: 'FLOAT', unit: '', description: '' })
    setFormOpen(true)
  };

  const handleOpenEdit = (tag: any) => {
    setEditTag(tag)
    setForm({
      name: tag.name,
      deviceId: tag.deviceId || '',
      dataType: tag.dataType,
      unit: tag.unit || '',
      description: tag.description || '',
    })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditTag(null)
  };

  const handleSubmit = () => {
    if (editTag) {
      updateMutation.mutate({ id: editTag.id, dto: form })
    } else {
      createMutation.mutate(form)
    }
  };

  const isValid = !!(form.name && form.dataType)

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
                  <TableHead className="text-[11px] font-semibold">Tag Name</TableHead>
                  <TableHead className="text-[11px] font-semibold">Device</TableHead>
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
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="shimmer h-3.5 rounded w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : tagList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                      No tags found
                    </TableCell>
                  </TableRow>
                ) : (
                  tagList.map((tag: any) => (
                    <TableRow key={tag.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                      <TableCell className="font-mono text-xs font-semibold text-primary">{tag.name}</TableCell>
                      <TableCell className="text-xs">{tag.deviceName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tag.dataType}</TableCell>
                      <TableCell className="text-xs font-semibold">{tag.value}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tag.unit}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={tag.quality === 'GOOD' ? 'default' : 'outline'}
                          className="text-[10px] h-5"
                        >
                          {tag.quality}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(tag.lastUpdate)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={tag.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className="text-[10px] h-5"
                        >
                          {tag.status}
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
          <div className="col-span-2">
            <Label>Tag Name *</Label>
            <Input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className="mt-1" placeholder="e.g. TEMP_01" />
          </div>
          <div>
            <Label>Device ID</Label>
            <Input value={form.deviceId} onChange={e => setForm(v => ({ ...v, deviceId: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Data Type *</Label>
            <Select value={form.dataType} onValueChange={v => setForm(f => ({ ...f, dataType: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FLOAT">Float</SelectItem>
                <SelectItem value="INTEGER">Integer</SelectItem>
                <SelectItem value="BOOLEAN">Boolean</SelectItem>
                <SelectItem value="STRING">String</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unit</Label>
            <Input value={form.unit} onChange={e => setForm(v => ({ ...v, unit: e.target.value }))} className="mt-1" placeholder="e.g. °C, bar, RPM" />
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
        title={`Delete tag ${deleteDialog?.name}?`}
        description="This will permanently delete this tag and all historical data."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
