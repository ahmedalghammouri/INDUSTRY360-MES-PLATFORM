'use client';

import React, { useState } from 'react';
import { Plus, Download, Search, Package, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KPICard } from '@/components/widgets/kpi-card';
import { api } from '@/services/api.client';

export function MaintenanceSparePartsView() {
  const [search, setSearch] = useState('');

  const { data: spareParts, isLoading } = useQuery({
    queryKey: ['maintenance', 'spare-parts', { search }],
    queryFn: () => api.get('/maintenance/spare-parts', { params: { search } }),
    staleTime: 30_000,
  });

  const { data: kpis } = useQuery({
    queryKey: ['maintenance', 'spare-parts-kpis'],
    queryFn: () => api.get('/maintenance/spare-parts/kpis'),
  });

  const parts = spareParts?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Spare Parts Inventory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage spare parts and inventory levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Download size={13} />
            Export
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs">
            <Plus size={13} />
            Add Part
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Total Parts" value={kpis?.total ?? 0} isLoading={isLoading} />
          <KPICard title="Low Stock" value={kpis?.lowStock ?? 0} colorMode="warning" isLoading={isLoading} />
          <KPICard title="Out of Stock" value={kpis?.outOfStock ?? 0} colorMode="error" isLoading={isLoading} />
          <KPICard title="Total Value" value={kpis?.totalValue ?? 0} unit="SAR" isLoading={isLoading} />
        </div>

        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Spare Parts</h3>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search parts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 w-48 text-xs"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <TableHead className="text-[11px] font-semibold">Part Number</TableHead>
                  <TableHead className="text-[11px] font-semibold">Description</TableHead>
                  <TableHead className="text-[11px] font-semibold">Category</TableHead>
                  <TableHead className="text-[11px] font-semibold">Quantity</TableHead>
                  <TableHead className="text-[11px] font-semibold">Min Stock</TableHead>
                  <TableHead className="text-[11px] font-semibold">Unit Price</TableHead>
                  <TableHead className="text-[11px] font-semibold">Location</TableHead>
                  <TableHead className="text-[11px] font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="shimmer h-3.5 rounded w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : parts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      No spare parts found
                    </TableCell>
                  </TableRow>
                ) : (
                  parts.map((part: any) => (
                    <TableRow key={part.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                      <TableCell className="font-mono text-xs font-semibold text-primary">{part.partNumber}</TableCell>
                      <TableCell className="text-xs">{part.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{part.category}</TableCell>
                      <TableCell className="text-xs font-semibold">{part.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{part.minStock}</TableCell>
                      <TableCell className="text-xs">{part.unitPrice} SAR</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{part.location}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={part.quantity === 0 ? 'destructive' : part.quantity <= part.minStock ? 'outline' : 'secondary'}
                          className="text-[10px] h-5"
                        >
                          {part.quantity === 0 ? 'Out of Stock' : part.quantity <= part.minStock ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
