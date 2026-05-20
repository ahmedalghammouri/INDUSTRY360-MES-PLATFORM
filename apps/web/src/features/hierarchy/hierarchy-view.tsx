'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  MapPin,
  Layers,
  Cpu,
  Activity,
  ChevronRight,
  ChevronDown,
  Circle,
} from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '@/services/api.client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HierarchyNode {
  id: string;
  name: string;
  type: 'enterprise' | 'site' | 'area' | 'workcell' | 'equipment';
  status?: string;
  children?: HierarchyNode[];
  metadata?: Record<string, string | number>;
}

const typeConfig = {
  enterprise: { icon: Building2, color: 'text-brand-400', bg: 'bg-brand-500/20', label: 'Enterprise' },
  site: { icon: MapPin, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Site' },
  area: { icon: Layers, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Area' },
  workcell: { icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Work Cell' },
  equipment: { icon: Cpu, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Equipment' },
};

const statusColors: Record<string, string> = {
  RUNNING: 'text-green-400',
  IDLE: 'text-amber-400',
  FAULT: 'text-red-400',
  MAINTENANCE: 'text-blue-400',
  OFFLINE: 'text-gray-400',
};

function TreeNode({ node, depth = 0 }: { node: HierarchyNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const config = typeConfig[node.type];
  const Icon = config.icon;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.05 }}
        className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer group',
          'hover:bg-white/5 transition-colors',
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <span className="text-muted-foreground w-4">
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', config.bg)}>
          <Icon className={cn('w-3.5 h-3.5', config.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{node.name}</span>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
              {config.label}
            </Badge>
          </div>
          {node.metadata && (
            <div className="flex gap-3 mt-0.5">
              {Object.entries(node.metadata).map(([k, v]) => (
                <span key={k} className="text-[11px] text-muted-foreground">
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
        </div>

        {node.status && (
          <div className="flex items-center gap-1.5">
            <Circle
              className={cn('w-2 h-2 fill-current', statusColors[node.status] || 'text-gray-400')}
            />
            <span
              className={cn('text-xs', statusColors[node.status] || 'text-muted-foreground')}
            >
              {node.status}
            </span>
          </div>
        )}
      </motion.div>

      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

const MOCK_HIERARCHY: HierarchyNode = {
  id: '1',
  name: 'Industry360 Manufacturing',
  type: 'enterprise',
  metadata: { Sites: 1, Areas: 3, Equipment: 8 },
  children: [
    {
      id: '2',
      name: 'Riyadh Plant',
      type: 'site',
      metadata: { Areas: 3, 'Work Cells': 5 },
      children: [
        {
          id: '3',
          name: 'Mixing Area',
          type: 'area',
          metadata: { Cells: 2, Equipment: 3 },
          children: [
            {
              id: '5',
              name: 'Mixing Cell 01',
              type: 'workcell',
              children: [
                { id: '10', name: 'Mixer M-101', type: 'equipment', status: 'RUNNING', metadata: { OEE: '87.3%', 'Cycle Time': '45s' } },
                { id: '11', name: 'Mixer M-102', type: 'equipment', status: 'IDLE', metadata: { OEE: '0%', 'Last Run': '2h ago' } },
              ],
            },
            {
              id: '6',
              name: 'Mixing Cell 02',
              type: 'workcell',
              children: [
                { id: '12', name: 'Blender B-201', type: 'equipment', status: 'RUNNING', metadata: { OEE: '91.2%' } },
              ],
            },
          ],
        },
        {
          id: '4',
          name: 'Filling Area',
          type: 'area',
          metadata: { Cells: 2, Equipment: 3 },
          children: [
            {
              id: '7',
              name: 'Filling Line 01',
              type: 'workcell',
              children: [
                { id: '13', name: 'Filler F-301', type: 'equipment', status: 'RUNNING', metadata: { OEE: '78.5%' } },
                { id: '14', name: 'Capper C-302', type: 'equipment', status: 'FAULT', metadata: { Fault: 'Jam detected' } },
              ],
            },
            {
              id: '8',
              name: 'Filling Line 02',
              type: 'workcell',
              children: [
                { id: '15', name: 'Filler F-401', type: 'equipment', status: 'MAINTENANCE' },
              ],
            },
          ],
        },
        {
          id: '9',
          name: 'Packaging Area',
          type: 'area',
          metadata: { Cells: 1, Equipment: 2 },
          children: [
            {
              id: '16',
              name: 'Packaging Line 01',
              type: 'workcell',
              children: [
                { id: '17', name: 'Wrapper W-501', type: 'equipment', status: 'RUNNING', metadata: { OEE: '82.1%' } },
                { id: '18', name: 'Palletizer P-502', type: 'equipment', status: 'RUNNING', metadata: { OEE: '94.7%' } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const SUMMARY_STATS = [
  { label: 'Total Equipment', value: '8', icon: Cpu, color: 'text-brand-400' },
  { label: 'Running', value: '5', icon: Activity, color: 'text-green-400' },
  { label: 'In Fault', value: '1', icon: Circle, color: 'text-red-400' },
  { label: 'In Maintenance', value: '1', icon: Activity, color: 'text-blue-400' },
];

export function HierarchyView() {
  const { data: tree } = useQuery({
    queryKey: ['hierarchy-tree'],
    queryFn: () => apiClient.get('/hierarchy/tree').then((r) => r.data.data),
    placeholderData: MOCK_HIERARCHY,
  });

  const hierarchyData = tree || MOCK_HIERARCHY;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plant Hierarchy</h1>
        <p className="text-muted-foreground text-sm mt-1">ISA-95 enterprise hierarchy structure</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SUMMARY_STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                  <Icon className={cn('w-4 h-4', stat.color)} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Hierarchy Tree
          </h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {Object.entries(typeConfig).map(([type, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <Icon className={cn('w-3 h-3', cfg.color)} />
                  <span>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <TreeNode node={hierarchyData} depth={0} />
      </div>
    </div>
  );
}
