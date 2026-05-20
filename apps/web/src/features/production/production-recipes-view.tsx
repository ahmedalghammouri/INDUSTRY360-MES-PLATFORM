'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Download, ChevronRight, BookOpen, FlaskConical, Settings2, Copy, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Recipe {
  id: string; code: string; name: string; product: string; version: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'LOCKED';
  cycleTime: number; yield: number; steps: number; materials: number;
  lastModified: string; modifiedBy: string;
}

const RECIPES: Recipe[] = [
  { id:'1', code:'RCP-001', name:'Valve Assembly Standard',   product:'Valve Assembly A1',  version:'v3.2', status:'ACTIVE',   cycleTime:12.5, yield:99.2, steps:18, materials:7,  lastModified:'2026-05-10', modifiedBy:'Eng. Hassan' },
  { id:'2', code:'RCP-002', name:'Pump Housing Full Cycle',   product:'Pump Housing B3',    version:'v1.8', status:'ACTIVE',   cycleTime:22.0, yield:98.8, steps:24, materials:11, lastModified:'2026-05-08', modifiedBy:'Eng. Fatima' },
  { id:'3', code:'RCP-003', name:'Gear Set Machining',        product:'Gear Set C2',        version:'v4.1', status:'LOCKED',   cycleTime:35.0, yield:99.5, steps:32, materials:4,  lastModified:'2026-04-22', modifiedBy:'Eng. Hassan' },
  { id:'4', code:'RCP-004', name:'Motor Bracket Stamping',    product:'Motor Bracket D1',   version:'v2.0', status:'ACTIVE',   cycleTime:8.0,  yield:97.4, steps:12, materials:3,  lastModified:'2026-05-12', modifiedBy:'Eng. Omar'   },
  { id:'5', code:'RCP-005', name:'Coupling Flange v2 Beta',   product:'Coupling Flange A3', version:'v2.0b',status:'DRAFT',    cycleTime:16.0, yield:0,    steps:20, materials:8,  lastModified:'2026-05-15', modifiedBy:'Eng. Sara'   },
  { id:'6', code:'RCP-006', name:'Bearing Housing Legacy',    product:'Bearing Housing E2', version:'v1.0', status:'ARCHIVED', cycleTime:28.0, yield:96.1, steps:26, materials:9,  lastModified:'2025-11-30', modifiedBy:'Eng. Khalid' },
  { id:'7', code:'RCP-007', name:'Impeller Precision Set',    product:'Impeller Set C4',    version:'v1.3', status:'ACTIVE',   cycleTime:19.5, yield:99.0, steps:22, materials:6,  lastModified:'2026-05-01', modifiedBy:'Eng. Hassan' },
];

const STATUS_CONFIG = {
  ACTIVE:   { label:'Active',   color:'text-green-400',  bg:'bg-green-500/10' },
  DRAFT:    { label:'Draft',    color:'text-amber-400',  bg:'bg-amber-500/10' },
  ARCHIVED: { label:'Archived', color:'text-slate-400',  bg:'bg-slate-500/10' },
  LOCKED:   { label:'Locked',   color:'text-purple-400', bg:'bg-purple-500/10'},
};

export function ProductionRecipesView() {
  const [search, setSearch] = useState('');
  const filtered = RECIPES.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase()) ||
    r.product.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Recipe Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Define, version, and manage production process recipes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Download size={13} />Export</Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs"><Plus size={13} />New Recipe</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:'Total Recipes', value: RECIPES.length, icon: BookOpen, color:'text-brand-400' },
            { label:'Active',        value: RECIPES.filter(r=>r.status==='ACTIVE').length,   icon: FlaskConical, color:'text-green-400' },
            { label:'Draft',         value: RECIPES.filter(r=>r.status==='DRAFT').length,    icon: Settings2,    color:'text-amber-400' },
            { label:'Locked',        value: RECIPES.filter(r=>r.status==='LOCKED').length,   icon: Lock,         color:'text-purple-400'},
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.label} initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.05 }}
                className="industrial-card rounded-xl p-4 flex items-center gap-3">
                <Icon className={cn('w-8 h-8', s.color)} />
                <div><div className="text-2xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
              </motion.div>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search recipe or product..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 text-xs" />
          </div>
        </div>

        {/* Recipe cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((recipe, i) => {
            const cfg = STATUS_CONFIG[recipe.status];
            return (
              <motion.div key={recipe.id} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.04 }}
                className="industrial-card rounded-xl p-4 flex flex-col gap-3 hover:border-brand-500/40 cursor-pointer transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[10px] text-muted-foreground">{recipe.code} · {recipe.version}</div>
                    <div className="font-semibold text-sm mt-0.5 leading-tight">{recipe.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{recipe.product}</div>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0', cfg.bg, cfg.color)}>
                    {recipe.status === 'LOCKED' ? <Lock size={9}/> : <Unlock size={9}/>}
                    {cfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label:'Cycle Time', value:`${recipe.cycleTime}s` },
                    { label:'Steps',      value:recipe.steps },
                    { label:'Materials',  value:recipe.materials },
                  ].map(m => (
                    <div key={m.label} className="bg-muted/30 rounded-lg p-2">
                      <div className="text-sm font-bold">{m.value}</div>
                      <div className="text-[10px] text-muted-foreground">{m.label}</div>
                    </div>
                  ))}
                </div>

                {recipe.yield > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Expected Yield</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width:`${recipe.yield}%` }} />
                    </div>
                    <span className="text-green-400 font-medium">{recipe.yield}%</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground">Modified {recipe.lastModified} by {recipe.modifiedBy}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6"><Copy size={11}/></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6"><ChevronRight size={11}/></Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
