'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package, AlertTriangle, BoxesIcon, Layers3,
  DollarSign, TrendingDown, Search, Plus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';

interface InventoryOverview {
  totalSpareParts: number;
  lowStockCount: number;
  totalSKUs: number;
  totalMaterialLots: number;
  totalStockValue: number;
}

interface SparePart {
  id: string;
  partNumber: string;
  name: string;
  category: string | null;
  stockQty: number;
  minStockQty: number;
  unitCost: number | null;
  storageLocation: string | null;
  isLowStock: boolean;
  stockValue: number;
}

export function InventoryOverview() {
  const [search, setSearch] = useState('');

  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['inventory', 'overview'],
    queryFn: () => api.get<InventoryOverview>('/inventory/overview'),
    staleTime: 30_000,
  });

  const { data: partsData, isLoading: partsLoading } = useQuery({
    queryKey: ['inventory', 'spare-parts', search],
    queryFn: () => api.get<{ data: SparePart[]; total: number }>('/inventory/spare-parts', {
      params: { search: search || undefined, limit: 10 },
    }),
    staleTime: 30_000,
  });

  const ov = (overview as any) ?? { totalSpareParts: 0, lowStockCount: 0, totalSKUs: 0, totalMaterialLots: 0, totalStockValue: 0 };
  const parts: SparePart[] = (partsData as any)?.data ?? [];

  const kpis = [
    { label: 'Total Spare Parts', value: ov.totalSpareParts, icon: Package, color: 'text-brand-400', bg: 'bg-brand-500/20' },
    { label: 'Low Stock Alerts', value: ov.lowStockCount, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20' },
    { label: 'Product SKUs', value: ov.totalSKUs, icon: BoxesIcon, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { label: 'Material Lots', value: ov.totalMaterialLots, icon: Layers3, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { label: 'Stock Value (SAR)', value: `${ov.totalStockValue.toLocaleString()}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/20' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Spare parts, products, and raw materials</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/inventory/materials">Material Lots</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/inventory/products">Products</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/inventory/spare-parts"><Plus className="w-4 h-4 mr-1" />Spare Parts</Link>
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-4 flex items-center gap-3"
            >
              {ovLoading ? (
                <div className="shimmer h-12 w-full rounded" />
              ) : (
                <>
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', kpi.bg)}>
                    <Icon className={cn('w-5 h-5', kpi.color)} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">{kpi.label}</div>
                    <div className="text-lg font-bold truncate">{kpi.value}</div>
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Spare parts quick view */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Spare Parts</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search parts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm w-56"
              />
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/inventory/spare-parts">View All</Link>
            </Button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/60">
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Part #</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Name</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Category</th>
                <th className="text-right p-3 text-muted-foreground font-medium text-xs">Stock</th>
                <th className="text-right p-3 text-muted-foreground font-medium text-xs">Min</th>
                <th className="text-right p-3 text-muted-foreground font-medium text-xs">Value (SAR)</th>
                <th className="text-left p-3 text-muted-foreground font-medium text-xs">Location</th>
                <th className="text-center p-3 text-muted-foreground font-medium text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {partsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="p-3"><div className="shimmer h-5 rounded" /></td>
                  </tr>
                ))
              ) : parts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">No spare parts found</td>
                </tr>
              ) : (
                parts.map(p => (
                  <tr key={p.id} className="border-b border-border/30 hover:bg-white/5">
                    <td className="p-3 text-xs font-mono text-muted-foreground">{p.partNumber}</td>
                    <td className="p-3 text-xs font-medium">{p.name}</td>
                    <td className="p-3 text-xs">
                      {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                    </td>
                    <td className={cn('p-3 text-xs text-right font-semibold', p.isLowStock ? 'text-red-400' : 'text-green-400')}>
                      {p.stockQty}
                    </td>
                    <td className="p-3 text-xs text-right text-muted-foreground">{p.minStockQty}</td>
                    <td className="p-3 text-xs text-right">{p.stockValue.toLocaleString()}</td>
                    <td className="p-3 text-xs text-muted-foreground">{p.storageLocation ?? '—'}</td>
                    <td className="p-3 text-center">
                      {p.isLowStock ? (
                        <Badge variant="destructive" className="text-[10px]">
                          <TrendingDown className="w-2.5 h-2.5 mr-0.5" />Low
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/40">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
