'use client';

import React, { useState } from 'react';
import { Plus, Download, Search, Wifi, WifiOff, Activity, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FormDialog } from '@/components/ui/form-dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { KPICard } from '@/components/widgets/kpi-card';
import { TablePagination } from '@/components/ui/table-pagination';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import { formatDate } from '@/lib/utils';

export function IotDevicesView() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editDevice, setEditDevice] = useState<any | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState({
    deviceId: '', name: '', type: '', protocol: 'MQTT', location: '', ipAddress: '',
  })

  const { data: devices, isLoading } = useQuery({
    queryKey: ['iot', 'devices', { search, page }],
    queryFn: () => api.get('/iot/devices', { params: { search, limit: 20, page } }),
    staleTime: 15_000,
  })

  const { data: kpis } = useQuery({
    queryKey: ['iot', 'devices-kpis'],
    queryFn: () => api.get('/iot/devices/kpis'),
    refetchInterval: 30_000,
  })

  const deviceList = (devices as any)?.data ?? [];
  const total: number = (devices as any)?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/iot/devices', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot', 'devices'] })
      toast({ title: 'Device created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create device', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/iot/devices/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot', 'devices'] })
      toast({ title: 'Device updated successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update device', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/iot/devices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot', 'devices'] })
      toast({ title: 'Device deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete device', variant: 'destructive' }),
  })

  const handleOpenCreate = () => {
    setEditDevice(null)
    setForm({ deviceId: '', name: '', type: '', protocol: 'MQTT', location: '', ipAddress: '' })
    setFormOpen(true)
  };

  const handleOpenEdit = (device: any) => {
    setEditDevice(device)
    setForm({
      deviceId: device.deviceId,
      name: device.name,
      type: device.type,
      protocol: device.protocol,
      location: device.location || '',
      ipAddress: device.ipAddress || '',
    })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditDevice(null)
  };

  const handleSubmit = () => {
    if (editDevice) {
      updateMutation.mutate({ id: editDevice.id, dto: form })
    } else {
      createMutation.mutate(form)
    }
  };

  const isValid = !!(form.deviceId && form.name && form.type && form.protocol)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">IoT Devices</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage connected devices and sensors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Download size={13} />
            Export
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleOpenCreate}>
            <Plus size={13} />
            Add Device
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Total Devices" value={(kpis as any)?.total ?? 0} isLoading={isLoading} />
          <KPICard title="Online" value={(kpis as any)?.online ?? 0} colorMode="default" isLoading={isLoading} />
          <KPICard title="Offline" value={(kpis as any)?.offline ?? 0} colorMode="alarm" isLoading={isLoading} />
          <KPICard title="Warnings" value={(kpis as any)?.warnings ?? 0} colorMode="alarm" isLoading={isLoading} />
        </div>

        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Connected Devices</h3>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
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
                  <TableHead className="text-[11px] font-semibold">Device ID</TableHead>
                  <TableHead className="text-[11px] font-semibold">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold">Type</TableHead>
                  <TableHead className="text-[11px] font-semibold">Protocol</TableHead>
                  <TableHead className="text-[11px] font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold">Last Seen</TableHead>
                  <TableHead className="text-[11px] font-semibold">Tags</TableHead>
                  <TableHead className="text-[11px] font-semibold">Location</TableHead>
                  <TableHead className="text-[11px] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="shimmer h-3.5 rounded w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : deviceList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                      No devices found
                    </TableCell>
                  </TableRow>
                ) : (
                  deviceList.map((device: any) => (
                    <TableRow key={device.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                      <TableCell className="font-mono text-xs font-semibold text-primary">{device.deviceId}</TableCell>
                      <TableCell className="text-xs font-medium">{device.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{device.type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{device.protocol}</TableCell>
                      <TableCell>
                        <Badge
                          variant={device.status === 'ONLINE' ? 'default' : 'destructive'}
                          className="text-[10px] h-5 gap-1"
                        >
                          {device.status === 'ONLINE' ? <Wifi size={10} /> : <WifiOff size={10} />}
                          {device.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(device.lastSeen)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{device.tagCount} tags</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{device.location}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(device)}>
                              <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ id: device.id, name: device.name })}>
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
        title={editDevice ? 'Edit Device' : 'Create Device'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Device ID *</Label>
            <Input value={form.deviceId} onChange={e => setForm(v => ({ ...v, deviceId: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Type *</Label>
            <Input value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value }))} className="mt-1" placeholder="e.g. PLC, Sensor, Gateway" />
          </div>
          <div>
            <Label>Protocol *</Label>
            <Select value={form.protocol} onValueChange={v => setForm(f => ({ ...f, protocol: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MQTT">MQTT</SelectItem>
                <SelectItem value="MODBUS_TCP">Modbus TCP</SelectItem>
                <SelectItem value="OPCUA">OPC UA</SelectItem>
                <SelectItem value="HTTP">HTTP/REST</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm(v => ({ ...v, location: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>IP Address</Label>
            <Input value={form.ipAddress} onChange={e => setForm(v => ({ ...v, ipAddress: e.target.value }))} className="mt-1" placeholder="e.g. 192.168.1.100" />
          </div>
        </div>
      </FormDialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete ${deleteDialog?.name}?`}
        description="This will permanently delete this device and all related data."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
