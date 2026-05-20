'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, CheckCircle2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

interface ChartParam {
  id: string; name: string; unit: string; ucl: number; lcl: number; mean: number;
  cpk: number; status: 'IN_CONTROL' | 'WARNING' | 'OUT_OF_CONTROL';
  data: { sample: number; value: number }[];
}

function generateSpcData(mean: number, sigma: number, n = 20) {
  return Array.from({ length: n }, (_, i) => ({
    sample: i + 1,
    value: parseFloat((mean + (Math.random() - 0.5) * sigma * 2).toFixed(3)),
  }));
}

const PARAMS: ChartParam[] = [
  { id:'1', name:'Bore Diameter',     unit:'mm',  ucl:25.05, lcl:24.95, mean:25.00, cpk:1.42, status:'IN_CONTROL',     data:generateSpcData(25.00,0.015) },
  { id:'2', name:'Surface Roughness', unit:'Ra',  ucl:1.60,  lcl:0.80,  mean:1.20,  cpk:0.98, status:'WARNING',        data:generateSpcData(1.20,0.12)   },
  { id:'3', name:'Thread Pitch',      unit:'mm',  ucl:1.515, lcl:1.485, mean:1.500, cpk:0.72, status:'OUT_OF_CONTROL', data:generateSpcData(1.500,0.01)  },
  { id:'4', name:'Tensile Strength',  unit:'MPa', ucl:620,   lcl:560,   mean:590,   cpk:1.78, status:'IN_CONTROL',     data:generateSpcData(590,8)        },
];

const STATUS_CFG = {
  IN_CONTROL:     { label:'In Control',       color:'text-green-400', icon:CheckCircle2  },
  WARNING:        { label:'Warning',           color:'text-amber-400', icon:AlertTriangle },
  OUT_OF_CONTROL: { label:'Out of Control',    color:'text-red-400',   icon:AlertTriangle },
};

export function QualitySpcView() {
  const [selected, setSelected] = useState(PARAMS[0].id);
  const param = PARAMS.find(p => p.id === selected)!;
  const StatusIcon = STATUS_CFG[param.status].icon;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">SPC Control Charts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Statistical process control — monitor process stability and capability</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Settings2 size={13}/>Configure</Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Parameter selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {PARAMS.map((p, i) => {
            const cfg = STATUS_CFG[p.status];
            const Icon = cfg.icon;
            return (
              <motion.button key={p.id} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
                onClick={() => setSelected(p.id)}
                className={cn(
                  'industrial-card rounded-xl p-4 text-left transition-all',
                  selected === p.id && 'border-brand-500/60 bg-brand-500/5',
                )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">{p.name}</span>
                  <Icon size={13} className={cfg.color}/>
                </div>
                <div className="text-xs text-muted-foreground">Cpk</div>
                <div className={cn('text-2xl font-bold', p.cpk>=1.33?'text-green-400':p.cpk>=1.0?'text-amber-400':'text-red-400')}>{p.cpk}</div>
                <div className={cn('text-[10px] font-semibold mt-1', cfg.color)}>{cfg.label}</div>
              </motion.button>
            );
          })}
        </div>

        {/* Main chart */}
        <div className="industrial-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">{param.name} — X-bar Control Chart</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                UCL: {param.ucl} {param.unit} &nbsp;|&nbsp; Mean: {param.mean} {param.unit} &nbsp;|&nbsp; LCL: {param.lcl} {param.unit}
              </p>
            </div>
            <div className={cn('flex items-center gap-1.5 text-xs font-semibold', STATUS_CFG[param.status].color)}>
              <StatusIcon size={13}/>
              {STATUS_CFG[param.status].label}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={param.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="sample" tick={{fontSize:11,fill:'#94a3b8'}} label={{value:'Sample',position:'insideBottom',offset:-2,fontSize:11,fill:'#64748b'}}/>
              <YAxis tick={{fontSize:11,fill:'#94a3b8'}} domain={['auto','auto']} unit={` ${param.unit}`}/>
              <Tooltip contentStyle={{background:'#0f172a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px'}} formatter={(v:number)=>[`${v} ${param.unit}`,'Value']}/>
              <ReferenceLine y={param.ucl}  stroke="#ef4444" strokeDasharray="6 3" label={{value:'UCL',fill:'#ef4444',fontSize:10}}/>
              <ReferenceLine y={param.mean} stroke="#6366f1" strokeDasharray="4 4" label={{value:'CL', fill:'#6366f1',fontSize:10}}/>
              <ReferenceLine y={param.lcl}  stroke="#ef4444" strokeDasharray="6 3" label={{value:'LCL',fill:'#ef4444',fontSize:10}}/>
              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={{r:3,fill:'#22c55e'}} activeDot={{r:5}} name="Value"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Capability summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:'Cpk',  value:param.cpk,  good: param.cpk >= 1.33  },
            { label:'UCL',  value:`${param.ucl} ${param.unit}`,  good:true },
            { label:'Mean', value:`${param.mean} ${param.unit}`, good:true },
            { label:'LCL',  value:`${param.lcl} ${param.unit}`,  good:true },
          ].map(s => (
            <div key={s.label} className="industrial-card rounded-xl p-3 text-center">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={cn('text-lg font-bold mt-0.5', typeof s.good === 'boolean' && !s.good ? 'text-red-400' : 'text-foreground')}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
