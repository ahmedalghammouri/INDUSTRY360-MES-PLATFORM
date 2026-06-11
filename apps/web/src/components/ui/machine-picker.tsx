'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Factory, LayoutGrid, GitBranch, Cpu, X, Search } from 'lucide-react';
import { api } from '@/services/api.client';
import { cn } from '@/lib/utils';

/**
 * Machine picker with the plant hierarchy tree (Factory → Area → Line → Machine),
 * same visual language as WorkCenterPicker. Only MACHINE nodes are selectable.
 */

export interface MachineNode {
  id: string;
  code: string;
  name: string;
  type: 'FACTORY' | 'AREA' | 'PRODUCTION_LINE' | 'MACHINE';
  children?: MachineNode[];
}

const TYPE_ICON: Record<string, React.ElementType> = {
  FACTORY: Factory,
  AREA: LayoutGrid,
  PRODUCTION_LINE: GitBranch,
  MACHINE: Cpu,
};

const TYPE_COLOR: Record<string, string> = {
  FACTORY: 'text-blue-500',
  AREA: 'text-violet-500',
  PRODUCTION_LINE: 'text-orange-500',
  MACHINE: 'text-green-500',
};

function TreeNode({
  node,
  depth,
  selectedId,
  excludeIds,
  onSelect,
}: {
  node: MachineNode;
  depth: number;
  selectedId: string | null;
  excludeIds: string[];
  onSelect: (node: MachineNode) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const children = (node.children ?? []).filter(
    c => c.type !== 'MACHINE' || !excludeIds.includes(c.id),
  );
  const hasChildren = children.length > 0;
  const isMachine = node.type === 'MACHINE';
  const Icon = TYPE_ICON[node.type] ?? Cpu;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm transition-colors select-none',
          isMachine
            ? selectedId === node.id
              ? 'bg-primary text-primary-foreground cursor-pointer'
              : 'hover:bg-muted cursor-pointer'
            : 'cursor-default',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => (isMachine ? onSelect(node) : setOpen(o => !o))}
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
        <Icon size={13} className={cn('shrink-0', selectedId === node.id ? 'text-primary-foreground' : TYPE_COLOR[node.type])} />
        <span className={cn('truncate', isMachine ? 'font-medium' : 'font-semibold text-muted-foreground text-xs uppercase tracking-wide')}>
          {node.name}
        </span>
        <span className={cn('text-[10px] ml-auto shrink-0', selectedId === node.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {node.code}
        </span>
      </div>
      {open && hasChildren && (
        <div>
          {children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              excludeIds={excludeIds}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MachinePickerProps {
  value: string | null;
  onChange: (id: string | null, node: MachineNode | null) => void;
  /** Machines to hide from the tree (e.g. already chosen as default/alternative). */
  excludeIds?: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MachinePicker({
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Select machine...',
  className,
  disabled,
}: MachinePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const { data: treeData } = useQuery({
    queryKey: ['hierarchy-tree'],
    queryFn: () => api.get('/hierarchy/tree'),
    staleTime: 60_000,
  });
  const tree: MachineNode[] = (() => {
    const d = (treeData as any)?.data ?? treeData;
    return Array.isArray(d) ? d : d ? [d] : [];
  })();

  // Flat machine list for search + label resolution
  const machines: MachineNode[] = [];
  (function flatten(nodes: MachineNode[]) {
    for (const n of nodes) {
      if (n.type === 'MACHINE') machines.push(n);
      if (n.children?.length) flatten(n.children);
    }
  })(tree);

  const selected = machines.find(m => m.id === value) ?? null;
  const filtered = search
    ? machines.filter(m =>
        !excludeIds.includes(m.id) && (
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.code.toLowerCase().includes(search.toLowerCase())
        ),
      )
    : null;

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

  const handleSelect = (node: MachineNode) => {
    onChange(node.id, node);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  };

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'w-full h-7 px-2.5 flex items-center gap-2 rounded-md border bg-background text-xs text-left transition-colors',
          'hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary',
          disabled && 'opacity-50 cursor-not-allowed',
          open && 'ring-1 ring-primary border-primary/50',
        )}
      >
        {selected && <Cpu size={12} className="text-green-500 shrink-0" />}
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
            width: Math.max(dropdownPos.width, 260),
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
                placeholder="Search machines..."
                className="w-full h-7 pl-6 pr-2 text-xs rounded-md border bg-muted/50 outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="p-1 max-h-72 overflow-y-auto">
            {filtered ? (
              filtered.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No machines found</div>
              ) : (
                filtered.map(m => (
                  <div
                    key={m.id}
                    onClick={() => handleSelect(m)}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer text-sm hover:bg-muted',
                      value === m.id && 'bg-primary text-primary-foreground',
                    )}
                  >
                    <Cpu size={12} className={value === m.id ? 'text-primary-foreground' : 'text-green-500'} />
                    <span className="flex-1 truncate font-medium">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground">{m.code}</span>
                  </div>
                ))
              )
            ) : (
              tree.map(root => (
                <TreeNode
                  key={root.id}
                  node={root}
                  depth={0}
                  selectedId={value}
                  excludeIds={excludeIds}
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
