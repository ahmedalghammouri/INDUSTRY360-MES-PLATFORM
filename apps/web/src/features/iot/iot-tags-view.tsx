'use client';

import React, { useState } from 'react';
import { Plus, Download, Search, Tag, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/services/api.client';
import { formatDate } from '@/lib/utils';

export function IotTagsView() {
  const [search, setSearch] = useState('');

  const { data: tags, isLoading } = useQuery({
    queryKey: ['iot', 'tags', { search }],
    queryFn: () => api.get('/iot/tags', { params: { search } }),
    staleTime: 10_000,
  });

  const tagList = tags?.data ?? [];

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
          <Button size="sm" className="gap-1.5 h-8 text-xs">
            <Plus size={13} />
            Add Tag
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">All Tags</h3>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tags..."
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
                  <TableHead className="text-[11px] font-semibold">Tag Name</TableHead>
                  <TableHead className="text-[11px] font-semibold">Device</TableHead>
                  <TableHead className="text-[11px] font-semibold">Data Type</TableHead>
                  <TableHead className="text-[11px] font-semibold">Current Value</TableHead>
                  <TableHead className="text-[11px] font-semibold">Unit</TableHead>
                  <TableHead className="text-[11px] font-semibold">Quality</TableHead>
                  <TableHead className="text-[11px] font-semibold">Last Update</TableHead>
                  <TableHead className="text-[11px] font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="shimmer h-3.5 rounded w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : tagList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
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
