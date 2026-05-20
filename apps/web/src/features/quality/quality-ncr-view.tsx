'use client';

import { useState } from 'react';
import { Plus, Search, Download, ChevronRight, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatDate } from '@/lib/utils';

type Severity = 'MINOR' | 'MAJOR' | 'CRITICAL';
type NcrStatus = 'OPEN' | 'IN_REVIEW' | 'CAPA_PENDING' | 'RESOLVED' | 'CLOSED';

interface NCR {
  id: string; number: string; title: string; severity: Severity;
  status: NcrStatus; product: string; batch: string;
  detectedBy: string; detectedAt: string; dueDate: string; defectCategory: string; qty: number;
}

const SEV: Record<Severity, { label:string; color:string; bg:string }> = {
  MINOR:    { label:'Minor',    color:'text-brand-400',   bg:'bg-brand-500/10'   },
  MAJOR:    { label:'Major',    color:'text-amber-400',   bg:'bg-amber-500/10'   },
  CRITICAL: { label:'Critical', color:'text-red-400',     bg:'bg-red-500/10'     },
};

const STAT: Record<NcrStatus, 'default'|'secondary'|'destructive'|'outline'> = {
  OPEN:'destructive', IN_REVIEW:'secondary', CAPA_PENDING:'outline', RESOLVED:'default', CLOSED:'secondary',
};

const DATA: NCR[] = [
  { id:'1', number:'NCR-2026-0089', title:'Bore diameter OOT on Motor Bracket',    severity:'MAJOR',    status:'CAPA_PENDING', product:'Motor Bracket D1',   batch:'B-2026-0478', detectedBy:'Qc. Fatima', detectedAt:'2026-05-14T16:30:00Z', dueDate:'2026-05-21', defectCategory:'Dimensional', qty:32 },
  { id:'2', number:'NCR-2026-0088', title:'Surface finish deviation – Steel Rods', severity:'MINOR',    status:'RESOLVED',     product:'Steel Rods Lot-44',  batch:'RM-2026-0144',detectedBy:'Qc. Khalid', detectedAt:'2026-05-15T14:00:00Z', dueDate:'2026-05-18', defectCategory:'Surface',     qty:20 },
  { id:'3', number:'NCR-2026-0087', title:'Weld porosity on Valve Body',           severity:'CRITICAL', status:'OPEN',         product:'Valve Assembly A1',  batch:'B-2026-0476', detectedBy:'Qc. Ahmed',  detectedAt:'2026-05-13T09:00:00Z', dueDate:'2026-05-16', defectCategory:'Welding',     qty:5  },
  { id:'4', number:'NCR-2026-0086', title:'Thread pitch non-conformance',          severity:'MAJOR',    status:'IN_REVIEW',    product:'Coupling Flange A3', batch:'B-2026-0474', detectedBy:'Qc. Omar',   detectedAt:'2026-05-12T11:00:00Z', dueDate:'2026-05-19', defectCategory:'Threading',   qty:14 },
  { id:'5', number:'NCR-2026-0085', title:'Assembly torque below spec',            severity:'MINOR',    status:'CLOSED',       product:'Pump Housing B3',    batch:'B-2026-0471', detectedBy:'Qc. Sara',   detectedAt:'2026-05-10T08:00:00Z', dueDate:'2026-05-17', defectCategory:'Assembly',    qty:8  },
];

export function QualityNcrView() {
  const [search, setSearch] = useState('');
  const filtered = DATA.filter(n =>
    n.number.toLowerCase().includes(search.toLowerCase()) ||
    n.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">NCR Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Non-conformance reports, root cause, and disposition</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Download size={13}/>Export</Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs"><Plus size={13}/>New NCR</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label:'Open NCRs',    value: DATA.filter(n=>n.status==='OPEN').length,            color:'text-red-400'    },
            { label:'In Review',    value: DATA.filter(n=>['IN_REVIEW','CAPA_PENDING'].includes(n.status)).length, color:'text-amber-400' },
            { label:'Resolved',     value: DATA.filter(n=>['RESOLVED','CLOSED'].includes(n.status)).length,        color:'text-green-400' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
              className="industrial-card rounded-xl p-4">
              <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="relative w-64">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input placeholder="Search NCR..." value={search} onChange={e=>setSearch(e.target.value)} className="h-8 pl-7 text-xs"/>
        </div>

        <div className="industrial-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/30">
                {['NCR #','Title','Severity','Status','Product','Defect Category','Qty','Detected','Due',''].map(h => (
                  <TableHead key={h} className="text-[11px]">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ncr => {
                const sev = SEV[ncr.severity];
                const overdue = new Date(ncr.dueDate) < new Date() && !['RESOLVED','CLOSED'].includes(ncr.status);
                return (
                  <TableRow key={ncr.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                    <TableCell className="font-mono text-xs font-semibold text-primary">{ncr.number}</TableCell>
                    <TableCell className="text-xs max-w-[160px]"><span className="truncate block">{ncr.title}</span></TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold', sev.bg, sev.color)}>
                        <AlertTriangle size={9}/>{sev.label}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant={STAT[ncr.status]} className="text-[10px] h-5">{ncr.status.replace('_',' ')}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ncr.product}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ncr.defectCategory}</TableCell>
                    <TableCell className="text-xs font-medium">{ncr.qty}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(ncr.detectedAt)}</TableCell>
                    <TableCell className={cn('text-xs', overdue && 'text-red-400 font-medium')}>
                      {ncr.dueDate}{overdue && ' ⚠'}
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
