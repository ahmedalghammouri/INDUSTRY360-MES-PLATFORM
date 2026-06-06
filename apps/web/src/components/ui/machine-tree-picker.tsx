'use client';

import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Search, Factory, Layers, Activity, Cpu, Check, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type NodeType = 'FACTORY' | 'AREA' | 'PRODUCTION_LINE' | 'MACHINE';

interface TreeNode {
  id: string;
  type: NodeType;
  code: string;
  name: string;
  machineType?: string;
  state?: string;
  children?: TreeNode[];
}

interface MachineTreePickerProps {
  value?: string;
  valueName?: string;
  onSelect: (id: string, type: 'MACHINE' | 'PRODUCTION_LINE', name: string, code: string) => void;
  onClear?: () => void;
  placeholder?: string;
  allowLineSelection?: boolean;
  disabled?: boolean;
}

const NODE_ICONS: Record<NodeType, React.ElementType> = {
  FACTORY: Factory, AREA: Layers, PRODUCTION_LINE: Activity, MACHINE: Cpu,
};

const NODE_COLORS: Record<NodeType, string> = {
  FACTORY: 'text-blue-400', AREA: 'text-purple-400',
  PRODUCTION_LINE: 'text-brand-400', MACHINE: 'text-green-400',
};

function flattenTree(nodes: TreeNode[], acc: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    acc.push(n);
    if (n.children) flattenTree(n.children, acc);
  }
  return acc;
}

function matchesSearch(node: TreeNode, q: string): boolean {
  return (
    node.name.toLowerCase().includes(q) ||
    node.code.toLowerCase().includes(q) ||
    (node.machineType?.toLowerCase().includes(q) ?? false)
  );
}

function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  return nodes.reduce<TreeNode[]>((acc, node) => {
    const filteredChildren = node.children ? filterTree(node.children, q) : [];
    if (matchesSearch(node, q) || filteredChildren.length > 0) {
      acc.push({ ...node, children: filteredChildren });
    }
    return acc;
  }, []);
}

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  selected: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNode) => void;
  allowLine: boolean;
  searchActive: boolean;
}

function TreeNodeRow({ node, depth, selected, expanded, onToggle, onSelect, allowLine, searchActive }: TreeNodeRowProps) {
  const isExpanded = searchActive || expanded.has(node.id);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isSelectable = node.type === 'MACHINE' || (allowLine && node.type === 'PRODUCTION_LINE');
  const isSelected = selected === node.id;
  const Icon = NODE_ICONS[node.type];

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors group',
          isSelectable ? 'hover:bg-muted/60' : 'hover:bg-muted/30 cursor-default',
          isSelected && 'bg-primary/10 ring-1 ring-primary/30',
        )}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => {
          if (isSelectable) onSelect(node);
          else if (hasChildren) onToggle(node.id);
        }}
      >
        <button
          onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(node.id); }}
          className={cn('w-4 h-4 shrink-0 flex items-center justify-center', !hasChildren && 'opacity-0 pointer-events-none')}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        <Icon size={13} className={cn('shrink-0', NODE_COLORS[node.type])} />

        <div className="flex-1 min-w-0">
          <div className={cn('text-xs font-medium truncate', isSelectable ? 'group-hover:text-foreground' : 'text-muted-foreground')}>
            {node.name}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">{node.code}</div>
        </div>

        {node.state && node.type === 'MACHINE' && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
            node.state === 'RUNNING' ? 'bg-green-500/20 text-green-400' :
            node.state === 'IDLE' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-muted text-muted-foreground',
          )}>
            {node.state}
          </span>
        )}

        {isSelected && <Check size={13} className="shrink-0 text-primary" />}
      </div>

      {isExpanded && hasChildren && node.children?.map(child => (
        <TreeNodeRow key={child.id} node={child} depth={depth + 1}
          selected={selected} expanded={expanded}
          onToggle={onToggle} onSelect={onSelect}
          allowLine={allowLine} searchActive={searchActive}
        />
      ))}
    </>
  );
}

export function MachineTreePicker({
  value = '',
  valueName = '',
  onSelect,
  onClear,
  placeholder = 'Select machine or line…',
  allowLineSelection = false,
  disabled = false,
}: MachineTreePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: treeData, isLoading } = useQuery({
    queryKey: ['hierarchy', 'tree'],
    queryFn: () => api.get<TreeNode[]>('/hierarchy/tree'),
    staleTime: 60_000,
    enabled: open,
  });

  const tree: TreeNode[] = Array.isArray(treeData) ? treeData : [];

  const q = search.toLowerCase().trim();
  const displayTree = useMemo(() => q ? filterTree(tree, q) : tree, [tree, q]);

  const allFactoryIds = useMemo(() => tree.map(n => n.id), [tree]);

  const handleOpen = () => {
    setOpen(true);
    setSearch('');
    setExpanded(new Set(allFactoryIds));
  };

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelect = (node: TreeNode) => {
    if (node.type !== 'MACHINE' && !(allowLineSelection && node.type === 'PRODUCTION_LINE')) return;
    onSelect(node.id, node.type as 'MACHINE' | 'PRODUCTION_LINE', node.name, node.code);
    setOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={handleOpen}
          className={cn(
            'w-full flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm transition-colors',
            'hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            disabled && 'opacity-50 cursor-not-allowed',
            !valueName && 'text-muted-foreground',
          )}
        >
          {valueName ? (
            <>
              <Cpu size={13} className="text-green-400 shrink-0" />
              <span className="flex-1 text-left text-xs truncate">{valueName}</span>
            </>
          ) : (
            <span className="flex-1 text-left text-xs">{placeholder}</span>
          )}
          {valueName && onClear && (
            <span
              onClick={e => { e.stopPropagation(); onClear(); }}
              className="p-0.5 rounded hover:bg-muted-foreground/20 transition-colors"
            >
              <X size={11} className="text-muted-foreground" />
            </span>
          )}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/50">
            <DialogTitle className="text-sm">Select Machine or Line</DialogTitle>
            <div className="relative mt-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or code…"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[420px] p-2">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shimmer h-8 rounded" />
                ))}
              </div>
            ) : displayTree.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                {q ? `No machines match "${search}"` : 'No hierarchy data found'}
              </div>
            ) : (
              displayTree.map(factory => (
                <TreeNodeRow
                  key={factory.id} node={factory} depth={0}
                  selected={value} expanded={expanded}
                  onToggle={toggle} onSelect={handleSelect}
                  allowLine={allowLineSelection} searchActive={!!q}
                />
              ))
            )}
          </div>

          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {allowLineSelection ? 'Click a machine or production line to select' : 'Click a machine to select'}
            </p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
