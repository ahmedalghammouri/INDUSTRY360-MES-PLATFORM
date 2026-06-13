'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Zap, Gauge, Thermometer, Activity, Plus, Clock, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SelectMenu } from '@/components/ui/select-menu';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';
import { InlineFormPanel, InlineFormSlot } from '@/components/ui/inline-form-panel';

interface EnergyMeter {
  id: string;
  meterNumber: string;
  name: string;
  type: string;
  unit: string;
  brand: string | null;
  location: string | null;
  machine: { name: string; code: string } | null;
  area: { name: string } | null;
  lastReading: { value: number; unit: string; timestamp: string; source: string } | null;
  mtdConsumption: number;
  mtdCost: number;
}

const TYPE_COLORS: Record<string, string> = {
  ELECTRICAL: 'text-yellow-400 bg-yellow-500/20',
  NATURAL_GAS: 'text-orange-400 bg-orange-500/20',
  COMPRESSED_AIR: 'text-cyan-400 bg-cyan-500/20',
  WATER: 'text-blue-400 bg-blue-500/20',
  STEAM: 'text-purple-400 bg-purple-500/20',
  CHILLED_WATER: 'text-green-400 bg-green-500/20',
};

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  ELECTRICAL: Zap,
  NATURAL_GAS: Thermometer,
  COMPRESSED_AIR: Gauge,
  WATER: Activity,
  STEAM: Thermometer,
  CHILLED_WATER: Activity,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function EnergyMetersView() {
  const qc = useQueryClient();
  const [showReadingForm, setShowReadingForm] = useState<EnergyMeter | null>(null);
  const [readingValue, setReadingValue] = useState('');
  const [showMeterForm, setShowMeterForm] = useState(false);
  const [editMeter, setEditMeter] = useState<EnergyMeter | null>(null);
  const [deleteMeter, setDeleteMeter] = useState<EnergyMeter | null>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['energy', 'meters'],
    queryFn: () => api.get<EnergyMeter[]>('/energy/meters'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const addReadingMutation = useMutation({
    mutationFn: (dto: { meterId: string; value: number }) => api.post('/energy/readings', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['energy'] });
      toast({ title: 'Reading added successfully' });
      setShowReadingForm(null);
      setReadingValue('');
    },
  });

  const createMeterMutation = useMutation({
    mutationFn: (dto: any) => api.post('/energy/meters', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['energy'] });
      toast({ title: 'Energy meter created successfully' });
      setShowMeterForm(false);
      setEditMeter(null);
      reset();
    },
  });

  const updateMeterMutation = useMutation({
    mutationFn: ({ id, ...dto }: any) => api.patch(`/energy/meters/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['energy'] });
      toast({ title: 'Energy meter updated successfully' });
      setShowMeterForm(false);
      setEditMeter(null);
      reset();
    },
  });

  const deleteMeterMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/energy/meters/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['energy'] });
      toast({ title: 'Energy meter deleted successfully' });
      setDeleteMeter(null);
    },
  });

  const handleEdit = (meter: EnergyMeter) => {
    setEditMeter(meter);
    setValue('meterNumber', meter.meterNumber);
    setValue('name', meter.name);
    setValue('type', meter.type);
    setValue('unit', meter.unit);
    setValue('location', meter.location || '');
    setShowMeterForm(true);
  };

  const onSubmitMeter = (data: any) => {
    if (editMeter) {
      updateMeterMutation.mutate({ id: editMeter.id, ...data });
    } else {
      createMeterMutation.mutate(data);
    }
  };

  const meters: EnergyMeter[] = Array.isArray(data) ? data : [];

  const byType = meters.reduce<Record<string, EnergyMeter[]>>((acc, m) => {
    if (!acc[m.type]) acc[m.type] = [];
    acc[m.type].push(m);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Energy Meters</h1>
          <p className="text-muted-foreground text-sm mt-1">{meters.length} meters configured</p>
        </div>
        <Button onClick={() => { setShowMeterForm(true); setEditMeter(null); reset({ type: 'ELECTRICAL' }); }}>
          <Plus className="w-4 h-4 mr-2" />Add Meter
        </Button>
      </div>

      <InlineFormSlot />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5">
              <div className="shimmer h-32 rounded" />
            </div>
          ))}
        </div>
      ) : meters.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          <Gauge className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <div className="font-medium">No energy meters configured</div>
        </div>
      ) : (
        Object.entries(byType).map(([type, typeMeters]) => {
          const palette = TYPE_COLORS[type] ?? 'text-muted-foreground bg-muted/20';
          const [textColor, bgColor] = palette.split(' ');
          const Icon = TYPE_ICONS[type] ?? Zap;
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', bgColor)}>
                  <Icon className={cn('w-3.5 h-3.5', textColor)} />
                </div>
                <h2 className="font-semibold text-sm">{type.replace(/_/g, ' ')}</h2>
                <Badge variant="outline" className="text-[10px]">{typeMeters.length} meters</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {typeMeters.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">{m.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{m.meterNumber}</div>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px]', textColor, bgColor.replace('bg-', 'border-').replace('/20', '/40'))}>
                        {m.unit}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {m.machine?.name ?? m.area?.name ?? m.location ?? 'Factory level'}
                    </div>

                    <div className="border-t border-border/40 pt-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Last Reading</span>
                        {m.lastReading ? (
                          <span className="font-semibold">{m.lastReading.value} {m.lastReading.unit}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </div>
                      {m.lastReading && (
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />{timeAgo(m.lastReading.timestamp)}
                          </span>
                          <span>{m.lastReading.source}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-muted-foreground">MTD Consumption</span>
                        <span className="font-semibold">{m.mtdConsumption.toLocaleString()} {m.unit}</span>
                      </div>
                      {m.mtdCost > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">MTD Cost</span>
                          <span className="text-green-400">{m.mtdCost.toLocaleString()} SAR</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        onClick={() => { setShowReadingForm(m); setReadingValue(''); }}
                      >
                        <Plus className="w-3 h-3 mr-1" />Add Reading
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(m)}>
                            <Pencil className="w-3 h-3 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteMeter(m)} className="text-destructive">
                            <Trash2 className="w-3 h-3 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Add reading — inline form */}
      {showReadingForm && (
        <InlineFormPanel
          open={!!showReadingForm}
          onClose={() => setShowReadingForm(null)}
          icon={Activity}
          title={`Add Reading — ${showReadingForm.name}`}
          description={`Enter current meter value in ${showReadingForm.unit}`}
          footer={(
            <>
              <Button variant="outline" size="sm" onClick={() => setShowReadingForm(null)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!readingValue || addReadingMutation.isPending}
                onClick={() => addReadingMutation.mutate({
                  meterId: showReadingForm.id,
                  value: parseFloat(readingValue),
                })}
              >
                {addReadingMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        >
            <Input
              type="number"
              placeholder={`Value (${showReadingForm.unit})`}
              value={readingValue}
              onChange={e => setReadingValue(e.target.value)}
              className="h-9"
              autoFocus
            />
        </InlineFormPanel>
      )}

      {/* Create/Edit Meter — inline form */}
      <InlineFormPanel
        open={showMeterForm}
        onClose={() => { setShowMeterForm(false); setEditMeter(null); }}
        icon={editMeter ? Pencil : Plus}
        title={editMeter ? 'Edit Meter' : 'Add Energy Meter'}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => { setShowMeterForm(false); setEditMeter(null); }}>Cancel</Button>
            <Button type="button" onClick={handleSubmit(onSubmitMeter)} disabled={createMeterMutation.isPending || updateMeterMutation.isPending}>
              {createMeterMutation.isPending || updateMeterMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </>
        )}
      >
            <form onSubmit={handleSubmit(onSubmitMeter)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Meter Number *</Label>
                  <Input {...register('meterNumber', { required: true })} placeholder="MTR-001" className="mt-1" />
                </div>
                <div>
                  <Label>Type *</Label>
                  <SelectMenu
                    size="md"
                    fullWidth
                    className="mt-1"
                    value={(watch('type') as string) ?? 'ELECTRICAL'}
                    onValueChange={(v) => setValue('type', v, { shouldValidate: true })}
                    options={[
                      { value: 'ELECTRICAL', label: 'Electrical' },
                      { value: 'NATURAL_GAS', label: 'Natural Gas' },
                      { value: 'COMPRESSED_AIR', label: 'Compressed Air' },
                      { value: 'WATER', label: 'Water' },
                      { value: 'STEAM', label: 'Steam' },
                      { value: 'CHILLED_WATER', label: 'Chilled Water' },
                    ]}
                  />
                </div>
              </div>
              <div>
                <Label>Name *</Label>
                <Input {...register('name', { required: true })} placeholder="Main electrical meter" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Unit *</Label>
                  <Input {...register('unit', { required: true })} placeholder="kWh" className="mt-1" />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input {...register('location')} placeholder="Building A" className="mt-1" />
                </div>
              </div>
            </form>
      </InlineFormPanel>

      {/* Delete Dialog */}
      {deleteMeter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold">Delete Energy Meter</h3>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{deleteMeter.name}</strong>? This will also delete all associated readings.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteMeter(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteMeterMutation.mutate(deleteMeter.id)} disabled={deleteMeterMutation.isPending}>
                {deleteMeterMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
