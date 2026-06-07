'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Factory, LayoutGrid, GitBranch, Cpu, X, Search } from 'lucide-react';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';

export interface WorkCenterNode {
  id: string;
  code: string;
  name: string;
  level: 'PLANT' | 'AREA' | 'LINE' | 'CELL';
  parentId: string | null;
  children: WorkCenterNode[];
  _count?: { routingSteps: number };
}

const LEVEL_ICON: Record<string, React.ElementType> = {
  PLANT: Factory,
  AREA: LayoutGrid,
  LINE: GitBranch,
  CELL: Cpu,
};

const LEVEL_COLOR: Record<string, string> = {
  PLANT: 'text-blue-500',
  AREA: 'text-violet-500',
  LINE: 'text-orange-500',
  CELL: 'text-green-500',
};

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: WorkCenterNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: WorkCenterNode) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const Icon = LEVEL_ICON[node.level] ?? Cpu;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-sm transition-colors select-none',
          selectedId === node.id
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            className="shrink-0 p-0.5 rounded hover:bg-black/10"
            onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <Icon size={13} className={cn('shrink-0', selectedId === node.id ? 'text-primary-foreground' : LEVEL_COLOR[node.level])} />
        <span className="font-medium truncate">{node.name}</span>
        <span className={cn('text-[10px] ml-auto shrink-0', selectedId === node.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {node.code}
        </span>
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface WorkCenterPickerProps {
  value: string | null;
  onChange: (id: string | null, node: WorkCenterNode | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function WorkCenterPicker({
  value,
  onChange,
  placeholder = 'Select work center...',
  className,
  disabled,
}: WorkCenterPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const { data: tree = [] } = useQuery<WorkCenterNode[]>({
    queryKey: ['workcenter-tree'],
    queryFn: () => api.get('/hierarchy/workcenters/tree') as any,
    staleTime: 60_000,
  });

  // Flat list for search
  const flat: WorkCenterNode[] = [];
  function flatten(nodes: WorkCenterNode[]) {
    for (const n of nodes) { flat.push(n); flatten(n.children); }
  }
  flatten(tree);

  const selected = flat.find(n => n.id === value) ?? null;
  const filtered = search
    ? flat.filter(n =>
        n.name.toLowerCase().includes(search.toLowerCase()) ||
        n.code.toLowerCase().includes(search.toLowerCase()),
      )
    : null;

  // Close on outside click (accounts for fixed-position dropdown)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = ref.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inTrigger && !inDropdown) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (node: WorkCenterNode) => {
    onChange(node.id, node);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
  };

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  };

  const Icon = selected ? (LEVEL_ICON[selected.level] ?? Cpu) : null;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'w-full h-8 px-2.5 flex items-center gap-2 rounded-md border bg-background text-sm text-left transition-colors',
          'hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary',
          disabled && 'opacity-50 cursor-not-allowed',
          open && 'ring-1 ring-primary border-primary/50',
        )}
      >
        {Icon && <Icon size={13} className={LEVEL_COLOR[selected!.level]} />}
        <span className={cn('flex-1 truncate', !selected && 'text-muted-foreground')}>
          {selected ? `${selected.name} (${selected.code})` : placeholder}
        </span>
        {selected && !disabled && (
          <span onClick={handleClear} className="p-0.5 rounded hover:bg-muted">
            <X size={11} />
          </span>
        )}
        <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
      </button>

      {open && dropdownPos && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: Math.max(dropdownPos.width, 240),
            zIndex: 9999,
          }}
          className="rounded-lg border bg-background shadow-xl"
        >
          <div className="p-2 border-b">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search work centers..."
                className="w-full h-7 pl-6 pr-2 text-xs rounded-md border bg-muted/50 outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="p-1 max-h-72 overflow-y-auto">
            {filtered ? (
              filtered.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No results</div>
              ) : (
                filtered.map(node => {
                  const NIcon = LEVEL_ICON[node.level] ?? Cpu;
                  return (
                    <div
                      key={node.id}
                      onClick={() => handleSelect(node)}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer text-sm hover:bg-muted',
                        value === node.id && 'bg-primary text-primary-foreground',
                      )}
                    >
                      <NIcon size={12} className={value === node.id ? 'text-primary-foreground' : LEVEL_COLOR[node.level]} />
                      <span className="flex-1 truncate font-medium">{node.name}</span>
                      <span className="text-[10px] text-muted-foreground">{node.level}</span>
                    </div>
                  );
                })
              )
            ) : (
              tree.map(root => (
                <TreeNode
                  key={root.id}
                  node={root}
                  depth={0}
                  selectedId={value}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
