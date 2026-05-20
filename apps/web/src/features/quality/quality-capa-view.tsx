'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, ChevronRight, ShieldCheck, Clock, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatDate } from '@/lib/utils';

type CapaType = 'CORRECTIVE' | 'PREVENTIVE';
type CapaStatus = 'OPEN' | 'IN_PROGRESS' | 'VERIFICATION' | 'CLOSED' | 'OVERDUE';

interface Capa {
  id: string; number: string; title: string; type: CapaType; status: CapaStatus;
  relatedNcr: string; rootCause: string; owner: string; openDate: string;
  dueDate: string; effectiveness: number | null;
}

const TYPE_CFG: Record<CapaType,{label:string;color:string}> = {
  CORRECTIVE: { label:'Corrective', color:'text-red-400'   },
  PREVENTIVE: { label:'Preventive', color:'text-brand-400' },
};

const STAT_CFG: Record<CapaStatus,'default'|'secondary'|'destructive'|'outline'> = {
  OPEN:'destructive', IN_PROGRESS:'default', VERIFICATION:'secondary', CLOSED:'secondary', OVERDUE:'destructive',
};

const DATA: Capa[] = [
  { id:'1', number:'CAPA-2026-0041', title:'Update machining fixture for Motor Bracket bore',    type:'CORRECTIVE', status:'IN_PROGRESS', relatedNcr:'NCR-2026-0089', rootCause:'Fixture wear',          owner:'Eng. Hassan',  openDate:'2026-05-14', dueDate:'2026-05-21', effectiveness:null },
  { id:'2', number:'CAPA-2026-0040', title:'Supplier qualification for Steel Rods surface',      type:'CORRECTIVE', status:'VERIFICATION', relatedNcr:'NCR-2026-0088', rootCause:'Supplier process',      owner:'Eng. Sara',    openDate:'2026-05-15', dueDate:'2026-05-22', effectiveness:null },
  { id:'3', number:'CAPA-2026-0039', title:'Weld procedure re-qualification',                    type:'CORRECTIVE', status:'OPEN',         relatedNcr:'NCR-2026-0087', rootCause:'Welder qualification',  owner:'Eng. Khalid',  openDate:'2026-05-13', dueDate:'2026-05-16', effectiveness:null },
  { id:'4', number:'CAPA-2026-0038', title:'Implement SPC on thread pitch measurement',          type:'PREVENTIVE', status:'IN_PROGRESS', relatedNcr:'NCR-2026-0086', rootCause:'Process variation',     owner:'Eng. Omar',    openDate:'2026-05-12', dueDate:'2026-05-26', effectiveness:null },
  { id:'5', number:'CAPA-2026-0035', title:'Torque wrench calibration procedure update',         type:'CORRECTIVE', status:'CLOSED',       relatedNcr:'NCR-2026-0085', rootCause:'Calibration lapse',     owner:'Eng. Fatima',  openDate:'2026-05-01', dueDate:'2026-05-10', effectiveness:94   },
  { id:'6', number:'CAPA-2026-0030', title:'Preventive control plan for flange concentricity',   type:'PREVENTIVE', status:'CLOSED',       relatedNcr:'—',             rootCause:'Proactive improvement', owner:'Eng. Hassan',  openDate:'2026-04-15', dueDate:'2026-05-01', effectiveness:88   },
];

export function QualityCapaView() {
  const [search, setSearch] = useState('');
  const filtered = DATA.filter(c =>
    c.number.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = [
    { label:'Open',         value:DATA.filter(c=>c.status==='OPEN').length,          color:'text-red-400'    },
    { label:'In Progress',  value:DATA.filter(c=>c.status==='IN_PROGRESS').length,   color:'text-brand-400'  },
    { label:'Verification', value:DATA.filter(c=>c.status==='VERIFICATION').length,  color:'text-amber-400'  },
    { label:'Closed',       value:DATA.filter(c=>c.status==='CLOSED').length,        color:'text-green-400'  },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">CAPA Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Corrective and Preventive Actions — root cause to effectiveness</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Download size={13}/>Export</Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs"><Plus size={13}/>New CAPA</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
              className="industrial-card rounded-xl p-4">
              <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="relative w-64">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input placeholder="Search CAPA..." value={search} onChange={e=>setSearch(e.target.value)} className="h-8 pl-7 text-xs"/>
        </div>

        <div className="industrial-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/30">
                {['CAPA #','Title','Type','Status','Related NCR','Root Cause','Owner','Due Date','Effectiveness',''].map(h=>(
                  <TableHead key={h} className="text-[11px]">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(capa => {
                const typeCfg = TYPE_CFG[capa.type];
                const overdue = new Date(capa.dueDate) < new Date() && capa.status !== 'CLOSED';
                return (
                  <TableRow key={capa.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                    <TableCell className="font-mono text-xs font-semibold text-primary">{capa.number}</TableCell>
                    <TableCell className="text-xs max-w-[180px]"><span className="truncate block">{capa.title}</span></TableCell>
                    <TableCell><span className={cn('text-[10px] font-semibold', typeCfg.color)}>{typeCfg.label}</span></TableCell>
                    <TableCell><Badge variant={STAT_CFG[capa.status]} className="text-[10px] h-5">{capa.status.replace('_',' ')}</Badge></TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{capa.relatedNcr}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[100px]"><span className="truncate block">{capa.rootCause}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{capa.owner}</TableCell>
                    <TableCell className={cn('text-xs', overdue && 'text-red-400 font-medium')}>{capa.dueDate}{overdue&&' ⚠'}</TableCell>
                    <TableCell className="text-xs">
                      {capa.effectiveness != null
                        ? <span className={capa.effectiveness>=90?'text-green-400':'text-amber-400'}>{capa.effectiveness}%</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7"><ChevronRight size={13}/></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
