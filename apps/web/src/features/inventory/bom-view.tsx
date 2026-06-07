'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, ChevronDown, ChevronRight, CheckCircle2,
  Package, Layers, Edit2, Trash2, X, AlertCircle,
  GitBranch, FlaskConical, FileCheck2, Info,
} from 'lucide-react';
import { api } from '@/services/api.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TablePagination } from '@/components/ui/table-pagination';

interface BOMItem {
  id: string;
  rawMaterialId: string;
  quantityPer: number;
  unit: string;
  scrapFactor: number;
  isOptional: boolean;
  notes?: string;
  rawMaterial: { id: string; code: string; name: string; unit: string; unitCost?: number };
}

interface BOM {
  id: string;
  skuId: string;
  version: string;
  isActive: boolean;
  approvedAt?: string;
  notes?: string;
  sku: { id: string; code: string; name: string; itemNumber: string; category?: string };
  items: BOMItem[];
}

interface RawMaterial {
  id: string;
  code: string;
  name: string;
  unit: string;
  unitCost?: number;
}

const UNITS = ['KG', 'G', 'L', 'ML', 'PCS', 'BOX', 'ROLL', 'M', 'CM', 'BAG', 'DRUM', 'PALLET'];

export function BOMView() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBOM, setEditBOM] = useState<BOM | null>(null);
  const [addItemBOM, setAddItemBOM] = useState<BOM | null>(null);

  const [newBOM, setNewBOM] = useState({ skuId: '', version: '1.0', notes: '' });
  const [newItems, setNewItems] = useState<Array<{
    rawMaterialId: string; quantityPer: string; unit: string; scrapFactor: string; isOptional: boolean; notes: string;
  }>>([{ rawMaterialId: '', quantityPer: '', unit: 'KG', scrapFactor: '0', isOptional: false, notes: '' }]);

  const [addItem, setAddItem] = useState({ rawMaterialId: '', quantityPer: '', unit: 'KG', scrapFactor: '0', notes: '' });

  const { data: bomData, isLoading } = useQuery({
    queryKey: ['bom', page],
    queryFn: () => api.get(`/inventory/bom?page=${page}&limit=20`),
  });

  const { data: skusData } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/inventory/products?limit=200'),
    staleTime: 60_000,
  });

  const { data: rawMatsData } = useQuery({
    queryKey: ['raw-materials-list'],
    queryFn: () => api.get('/inventory/raw-materials?limit=500'),
    staleTime: 60_000,
  });

  const boms: BOM[] = (bomData as any)?.data ?? [];
  const total: number = (bomData as any)?.total ?? 0;
  const skus: any[] = (skusData as any)?.data ?? [];
  const rawMaterials: RawMaterial[] = (rawMatsData as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/inventory/bom', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom'] });
      setCreateOpen(false);
      setNewBOM({ skuId: '', version: '1.0', notes: '' });
      setNewItems([{ rawMaterialId: '', quantityPer: '', unit: 'KG', scrapFactor: '0', isOptional: false, notes: '' }]);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/inventory/bom/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bom'] }),
  });

  const addItemMutation = useMutation({
    mutationFn: ({ bomId, dto }: { bomId: string; dto: any }) =>
      api.post(`/inventory/bom/${bomId}/items`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom'] });
      setAddItemBOM(null);
      setAddItem({ rawMaterialId: '', quantityPer: '', unit: 'KG', scrapFactor: '0', notes: '' });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ bomId, itemId }: { bomId: string; itemId: string }) =>
      api.delete(`/inventory/bom/${bomId}/items/${itemId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bom'] }),
  });

  const filteredBOMs = boms.filter(b =>
    !search ||
    b.sku.name.toLowerCase().includes(search.toLowerCase()) ||
    b.sku.code.toLowerCase().includes(search.toLowerCase()) ||
    b.sku.itemNumber.toLowerCase().includes(search.toLowerCase()),
  );

  const addNewItemRow = () =>
    setNewItems(prev => [...prev, { rawMaterialId: '', quantityPer: '', unit: 'KG', scrapFactor: '0', isOptional: false, notes: '' }]);

  const removeItemRow = (i: number) =>
    setNewItems(prev => prev.filter((_, idx) => idx !== i));

  const handleCreate = () => {
    if (!newBOM.skuId || newItems.some(i => !i.rawMaterialId || !i.quantityPer)) return;
    createMutation.mutate({
      skuId: newBOM.skuId,
      version: newBOM.version,
      notes: newBOM.notes || undefined,
      items: newItems.map(i => ({
        rawMaterialId: i.rawMaterialId,
        quantityPer: parseFloat(i.quantityPer),
        unit: i.unit,
        scrapFactor: parseFloat(i.scrapFactor) || 0,
        isOptional: i.isOptional,
        notes: i.notes || undefined,
      })),
    });
  };

  const calcBOMCost = (bom: BOM) =>
    bom.items.reduce((sum, item) => {
      const cost = item.rawMaterial.unitCost ?? 0;
      const qty = item.quantityPer * (1 + item.scrapFactor);
      return sum + cost * qty;
    }, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Bill of Materials</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define raw material requirements for each finished product
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1.5" />
          New BOM
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
        <Info size={15} className="mt-0.5 text-primary shrink-0" />
        <span>
          A <strong className="text-foreground">BOM</strong> links a finished product (SKU) to the raw materials, packaging and consumables needed to make one unit.
          The <strong className="text-foreground">scrap factor</strong> adds a buffer (e.g. 0.05 = 5% extra). Approved BOMs are used by production to auto-calculate material requirements.
        </span>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by product name or code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* BOM list */}
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground p-8 text-center">Loading BOMs...</div>
        ) : filteredBOMs.length === 0 ? (
          <div className="text-sm text-muted-foreground p-12 text-center border rounded-xl">
            <GitBranch size={32} className="mx-auto mb-3 opacity-20" />
            No BOMs found. Create the first one.
          </div>
        ) : filteredBOMs.map(bom => (
          <BOMCard
            key={bom.id}
            bom={bom}
            isExpanded={expandedId === bom.id}
            onToggle={() => setExpandedId(expandedId === bom.id ? null : bom.id)}
            onApprove={() => approveMutation.mutate(bom.id)}
            onAddItem={() => setAddItemBOM(bom)}
            onDeleteItem={(itemId) => deleteItemMutation.mutate({ bomId: bom.id, itemId })}
            bomCost={calcBOMCost(bom)}
          />
        ))}
      </div>

      <TablePagination page={page} total={total} limit={20} onPageChange={setPage} />

      {/* Create BOM Dialog */}
      <AnimatePresence>
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5 border-b flex items-center justify-between">
                <h2 className="font-semibold text-base">Create Bill of Materials</h2>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreateOpen(false)}>
                  <X size={14} />
                </Button>
              </div>
              <div className="p-5 flex flex-col gap-5">
                {/* BOM header fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Product (SKU) *</Label>
                    <Select value={newBOM.skuId} onValueChange={v => setNewBOM(p => ({ ...p, skuId: v }))}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select product..." />
                      </SelectTrigger>
                      <SelectContent>
                        {skus.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.itemNumber} — {s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Version</Label>
                    <Input
                      value={newBOM.version}
                      onChange={e => setNewBOM(p => ({ ...p, version: e.target.value }))}
                      placeholder="1.0"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                {/* BOM items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Raw Material Components *</Label>
                    <Button size="sm" variant="outline" onClick={addNewItemRow} className="h-7 text-xs">
                      <Plus size={12} className="mr-1" />
                      Add Row
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Material</th>
                          <th className="text-left p-2 font-medium w-24">Qty / Unit</th>
                          <th className="text-left p-2 font-medium w-20">Unit</th>
                          <th className="text-left p-2 font-medium w-20">Scrap %</th>
                          <th className="w-8 p-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {newItems.map((item, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-1.5">
                              <Select
                                value={item.rawMaterialId}
                                onValueChange={v => setNewItems(prev => prev.map((it, idx) => idx === i ? { ...it, rawMaterialId: v } : it))}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Select material..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {rawMaterials.map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.code} — {m.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-1.5">
                              <Input
                                type="number"
                                min="0"
                                step="0.001"
                                value={item.quantityPer}
                                onChange={e => setNewItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantityPer: e.target.value } : it))}
                                className="h-7 text-xs"
                                placeholder="0.000"
                              />
                            </td>
                            <td className="p-1.5">
                              <Select
                                value={item.unit}
                                onValueChange={v => setNewItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit: v } : it))}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-1.5">
                              <Input
                                type="number"
                                min="0"
                                max="1"
                                step="0.01"
                                value={item.scrapFactor}
                                onChange={e => setNewItems(prev => prev.map((it, idx) => idx === i ? { ...it, scrapFactor: e.target.value } : it))}
                                className="h-7 text-xs"
                                placeholder="0.05"
                              />
                            </td>
                            <td className="p-1.5">
                              {newItems.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  onClick={() => removeItemRow(i)}
                                >
                                  <Trash2 size={11} />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={newBOM.notes}
                    onChange={e => setNewBOM(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Engineering change notes..."
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="p-5 border-t flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !newBOM.skuId}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create BOM'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Item Dialog */}
      <AnimatePresence>
        {addItemBOM && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border rounded-xl shadow-2xl w-full max-w-md"
            >
              <div className="p-5 border-b flex items-center justify-between">
                <h2 className="font-semibold text-sm">Add Material to BOM</h2>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddItemBOM(null)}>
                  <X size={14} />
                </Button>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Raw Material *</Label>
                  <Select value={addItem.rawMaterialId} onValueChange={v => setAddItem(p => ({ ...p, rawMaterialId: v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rawMaterials
                        .filter(m => !addItemBOM.items.some(i => i.rawMaterialId === m.id))
                        .map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.code} — {m.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Quantity per unit *</Label>
                    <Input type="number" min="0" step="0.001" value={addItem.quantityPer}
                      onChange={e => setAddItem(p => ({ ...p, quantityPer: e.target.value }))}
                      className="h-8 text-sm" placeholder="0.000" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Unit</Label>
                    <Select value={addItem.unit} onValueChange={v => setAddItem(p => ({ ...p, unit: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Scrap Factor (e.g. 0.05 = 5%)</Label>
                  <Input type="number" min="0" max="1" step="0.01" value={addItem.scrapFactor}
                    onChange={e => setAddItem(p => ({ ...p, scrapFactor: e.target.value }))}
                    className="h-8 text-sm" placeholder="0.00" />
                </div>
              </div>
              <div className="p-5 border-t flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAddItemBOM(null)}>Cancel</Button>
                <Button size="sm"
                  disabled={addItemMutation.isPending || !addItem.rawMaterialId || !addItem.quantityPer}
                  onClick={() => addItemMutation.mutate({
                    bomId: addItemBOM.id,
                    dto: {
                      rawMaterialId: addItem.rawMaterialId,
                      quantityPer: parseFloat(addItem.quantityPer),
                      unit: addItem.unit,
                      scrapFactor: parseFloat(addItem.scrapFactor) || 0,
                    },
                  })}
                >
                  {addItemMutation.isPending ? 'Adding...' : 'Add Material'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BOMCard({
  bom, isExpanded, onToggle, onApprove, onAddItem, onDeleteItem, bomCost,
}: {
  bom: BOM;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onAddItem: () => void;
  onDeleteItem: (itemId: string) => void;
  bomCost: number;
}) {
  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
          <GitBranch size={12} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{bom.sku.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{bom.sku.itemNumber}</span>
            <Badge variant="outline" className="text-[10px] h-4">v{bom.version}</Badge>
            {bom.isActive && bom.approvedAt && (
              <Badge className="text-[10px] h-4 bg-success-500/10 text-success-400 border-success-500/20">
                <CheckCircle2 size={8} className="mr-1" />
                Approved
              </Badge>
            )}
            {bom.isActive && !bom.approvedAt && (
              <Badge variant="outline" className="text-[10px] h-4 text-amber-500 border-amber-500/30">Draft</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {bom.items.length} component{bom.items.length !== 1 ? 's' : ''} · Est. cost: {bomCost > 0 ? `SAR ${bomCost.toFixed(3)} / unit` : 'N/A'}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!bom.approvedAt && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={e => { e.stopPropagation(); onApprove(); }}
            >
              <FileCheck2 size={12} className="mr-1" />
              Approve
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={e => { e.stopPropagation(); onAddItem(); }}
          >
            <Plus size={12} className="mr-1" />
            Add Item
          </Button>
          {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded items */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t">
              {bom.items.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  No materials defined. Add the first component.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-2.5 font-medium text-muted-foreground">Material</th>
                      <th className="text-left p-2.5 font-medium text-muted-foreground">Code</th>
                      <th className="text-right p-2.5 font-medium text-muted-foreground">Qty / Unit</th>
                      <th className="text-right p-2.5 font-medium text-muted-foreground">Scrap</th>
                      <th className="text-right p-2.5 font-medium text-muted-foreground">Total Qty</th>
                      <th className="text-right p-2.5 font-medium text-muted-foreground">Unit Cost</th>
                      <th className="text-right p-2.5 font-medium text-muted-foreground">Line Cost</th>
                      <th className="w-8 p-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {bom.items.map(item => {
                      const totalQty = item.quantityPer * (1 + item.scrapFactor);
                      const lineCost = totalQty * (item.rawMaterial.unitCost ?? 0);
                      return (
                        <tr key={item.id} className="border-t hover:bg-muted/20">
                          <td className="p-2.5 font-medium">{item.rawMaterial.name}</td>
                          <td className="p-2.5 font-mono text-muted-foreground">{item.rawMaterial.code}</td>
                          <td className="p-2.5 text-right tabular-nums">
                            {item.quantityPer.toFixed(3)} {item.unit}
                          </td>
                          <td className="p-2.5 text-right tabular-nums text-muted-foreground">
                            {item.scrapFactor > 0 ? `+${(item.scrapFactor * 100).toFixed(0)}%` : '—'}
                          </td>
                          <td className="p-2.5 text-right tabular-nums font-medium">
                            {totalQty.toFixed(3)} {item.unit}
                          </td>
                          <td className="p-2.5 text-right tabular-nums text-muted-foreground">
                            {item.rawMaterial.unitCost ? `SAR ${item.rawMaterial.unitCost.toFixed(3)}` : '—'}
                          </td>
                          <td className="p-2.5 text-right tabular-nums">
                            {lineCost > 0 ? `SAR ${lineCost.toFixed(3)}` : '—'}
                          </td>
                          <td className="p-2.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive opacity-50 hover:opacity-100"
                              onClick={() => onDeleteItem(item.id)}
                            >
                              <Trash2 size={11} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {bomCost > 0 && (
                    <tfoot className="bg-muted/30 border-t">
                      <tr>
                        <td colSpan={6} className="p-2.5 text-right text-xs font-medium text-muted-foreground">
                          Total Material Cost per Unit
                        </td>
                        <td className="p-2.5 text-right font-bold text-sm">
                          SAR {bomCost.toFixed(3)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
