'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, MapPin, Package, X, Edit2, Trash2,
  Warehouse, FlaskConical, Settings, Truck, Layers,
} from 'lucide-react';
import { api } from '@/services/api.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ZONES = [
  { value: 'RAW_MATERIAL', label: 'Raw Material Warehouse', icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { value: 'SPARE_PARTS', label: 'Spare Parts Room', icon: Settings, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  { value: 'FINISHED_GOODS', label: 'Finished Goods', icon: Warehouse, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  { value: 'QUARANTINE', label: 'Quarantine / QC Hold', icon: FlaskConical, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  { value: 'PRODUCTION', label: 'Production Floor (Line-side)', icon: Layers, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { value: 'DISPATCH', label: 'Dispatch / Shipping', icon: Truck, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
];

interface StorageLocation {
  id: string;
  code: string;
  name: string;
  zone: string;
  description?: string;
  capacity?: number;
  isActive: boolean;
  rawMaterialCount: number;
  materialLotCount: number;
  sparePartCount: number;
  totalItems: number;
  createdAt: string;
}

const EMPTY_FORM = { code: '', name: '', zone: '', description: '', capacity: '' };

export function StorageLocationsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<StorageLocation | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data, isLoading } = useQuery({
    queryKey: ['storage-locations', zoneFilter, search],
    queryFn: () => api.get(`/inventory/storage-locations?zone=${zoneFilter}&search=${search}&limit=200`),
  });

  const locations: StorageLocation[] = (data as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/inventory/storage-locations', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-locations'] });
      setFormOpen(false);
      setForm({ ...EMPTY_FORM });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) =>
      api.patch(`/inventory/storage-locations/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-locations'] });
      setEditLocation(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/storage-locations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-locations'] }),
  });

  const handleSave = () => {
    if (!form.code || !form.name || !form.zone) return;
    const dto = {
      code: form.code.toUpperCase(),
      name: form.name,
      zone: form.zone,
      description: form.description || undefined,
      capacity: form.capacity ? parseFloat(form.capacity) : undefined,
    };
    if (editLocation) {
      updateMutation.mutate({ id: editLocation.id, dto });
    } else {
      createMutation.mutate(dto);
    }
  };

  const openEdit = (loc: StorageLocation) => {
    setEditLocation(loc);
    setForm({
      code: loc.code,
      name: loc.name,
      zone: loc.zone,
      description: loc.description ?? '',
      capacity: loc.capacity?.toString() ?? '',
    });
    setFormOpen(true);
  };

  const groupedByZone = ZONES.map(zone => ({
    ...zone,
    locations: locations.filter(l => l.zone === zone.value),
  })).filter(z => !zoneFilter || z.value === zoneFilter);

  const totalLocations = locations.length;
  const totalItems = locations.reduce((s, l) => s + l.totalItems, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Storage Locations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define and manage warehouse bins, zones, and storage areas
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditLocation(null); setForm({ ...EMPTY_FORM }); setFormOpen(true); }}>
          <Plus size={14} className="mr-1.5" />
          New Location
        </Button>
      </div>

      {/* KPI chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="px-3 py-1.5 rounded-lg bg-muted/50 border text-sm">
          <span className="text-muted-foreground">Locations: </span>
          <span className="font-bold">{totalLocations}</span>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-muted/50 border text-sm">
          <span className="text-muted-foreground">Items tracked: </span>
          <span className="font-bold">{totalItems}</span>
        </div>
        {ZONES.map(z => {
          const count = locations.filter(l => l.zone === z.value).length;
          if (!count) return null;
          const Icon = z.icon;
          return (
            <div key={z.value} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium', z.bg, z.color)}>
              <Icon size={12} />
              {z.label.split(' ')[0]}: {count}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by code or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={zoneFilter || '_all'} onValueChange={v => setZoneFilter(v === '_all' ? '' : v)}>
          <SelectTrigger className="h-8 w-52 text-sm">
            <SelectValue placeholder="All zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All zones</SelectItem>
            {ZONES.map(z => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Zones + location cards */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground p-8 text-center">Loading locations...</div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedByZone.map(zone => (
            zone.locations.length > 0 && (
              <div key={zone.value}>
                <div className="flex items-center gap-2 mb-2">
                  <zone.icon size={14} className={zone.color} />
                  <span className="text-sm font-semibold">{zone.label}</span>
                  <span className="text-xs text-muted-foreground">({zone.locations.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {zone.locations.map(loc => (
                    <LocationCard
                      key={loc.id}
                      location={loc}
                      zone={zone}
                      onEdit={() => openEdit(loc)}
                      onDelete={() => deleteMutation.mutate(loc.id)}
                    />
                  ))}
                </div>
              </div>
            )
          ))}
          {groupedByZone.every(z => z.locations.length === 0) && (
            <div className="border rounded-xl p-12 text-center text-sm text-muted-foreground">
              <MapPin size={32} className="mx-auto mb-3 opacity-20" />
              No storage locations yet. Create your first location.
            </div>
          )}
        </div>
      )}

      {/* Form Dialog */}
      <AnimatePresence>
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border rounded-xl shadow-2xl w-full max-w-md"
            >
              <div className="p-5 border-b flex items-center justify-between">
                <h2 className="font-semibold text-sm">
                  {editLocation ? 'Edit Storage Location' : 'New Storage Location'}
                </h2>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => { setFormOpen(false); setEditLocation(null); }}>
                  <X size={14} />
                </Button>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Location Code *</Label>
                    <Input
                      value={form.code}
                      onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="RM-A01"
                      className="h-8 text-sm font-mono"
                      disabled={!!editLocation}
                    />
                    <span className="text-xs text-muted-foreground">e.g. RM-A01, SP-B03, FG-R12</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Zone *</Label>
                    <Select value={form.zone} onValueChange={v => setForm(p => ({ ...p, zone: v }))}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select zone..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ZONES.map(z => (
                          <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Aisle A, Shelf 1"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Optional description or notes"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Capacity (optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.capacity}
                    onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))}
                    placeholder="Max units / pallets / kg"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="p-5 border-t flex justify-end gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => { setFormOpen(false); setEditLocation(null); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!form.code || !form.name || !form.zone || createMutation.isPending || updateMutation.isPending}
                  onClick={handleSave}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editLocation ? 'Save Changes' : 'Create Location'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LocationCard({ location, zone, onEdit, onDelete }: {
  location: StorageLocation;
  zone: typeof ZONES[number];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = zone.icon;
  const usage = location.capacity && location.totalItems > 0
    ? Math.min(100, (location.totalItems / location.capacity) * 100)
    : null;

  return (
    <div className="border rounded-lg p-3 bg-card hover:bg-muted/20 transition-colors group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-7 h-7 rounded flex items-center justify-center border', zone.bg)}>
            <Icon size={13} className={zone.color} />
          </div>
          <div>
            <div className="font-mono text-sm font-bold">{location.code}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[140px]">{location.name}</div>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
            <Edit2 size={11} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}>
            <Trash2 size={11} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {location.rawMaterialCount > 0 && (
          <span><span className="font-medium text-foreground">{location.rawMaterialCount}</span> RM</span>
        )}
        {location.materialLotCount > 0 && (
          <span><span className="font-medium text-foreground">{location.materialLotCount}</span> lots</span>
        )}
        {location.sparePartCount > 0 && (
          <span><span className="font-medium text-foreground">{location.sparePartCount}</span> parts</span>
        )}
        {location.totalItems === 0 && <span>Empty</span>}
      </div>

      {usage !== null && (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full', usage > 80 ? 'bg-destructive' : usage > 60 ? 'bg-amber-400' : 'bg-success-400')}
              style={{ width: `${usage}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{usage.toFixed(0)}% capacity</div>
        </div>
      )}

      {location.capacity && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          Cap: {location.capacity}
        </div>
      )}
    </div>
  );
}
