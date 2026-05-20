'use client';

import { useState } from 'react';
import { Plus, Search, Download, Filter, ChevronRight, ClipboardList, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatDate } from '@/lib/utils';

type InspType = 'INCOMING' | 'IN_PROCESS' | 'FINAL' | 'PATROL';
type InspResult = 'PASS' | 'FAIL' | 'CONDITIONAL';

interface Inspection {
  id: string; number: string; type: InspType; product: string;
  batch: string; result: InspResult; inspector: string;
  date: string; passQty: number; failQty: number; totalQty: number;
  notes: string;
}

const TYPE_CONFIG: Record<InspType, { label: string; color: string }> = {
  INCOMING:   { label:'Incoming',   color:'text-blue-400'   },
  IN_PROCESS: { label:'In-Process', color:'text-brand-400'  },
  FINAL:      { label:'Final',      color:'text-green-400'  },
  PATROL:     { label:'Patrol',     color:'text-amber-400'  },
};

const RESULT_CONFIG: Record<InspResult, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  PASS:        { label:'Pass',        color:'text-green-400', icon:CheckCircle2 },
  FAIL:        { label:'Fail',        color:'text-red-400',   icon:XCircle      },
  CONDITIONAL: { label:'Conditional', color:'text-amber-400', icon:AlertCircle  },
};

const DATA: Inspection[] = [
  { id:'1', number:'INS-2026-0921', type:'FINAL',      product:'Valve Assembly A1',  batch:'B-2026-0480', result:'PASS',        inspector:'Qc. Ahmed',   date:'2026-05-16T08:30:00Z', passQty:796, failQty:4,  totalQty:800, notes:'' },
  { id:'2', number:'INS-2026-0920', type:'IN_PROCESS', product:'Pump Housing B3',    batch:'B-2026-0481', result:'PASS',        inspector:'Qc. Sara',    date:'2026-05-16T07:00:00Z', passQty:370, failQty:2,  totalQty:372, notes:'' },
  { id:'3', number:'INS-2026-0919', type:'INCOMING',   product:'Steel Rods Lot-44',  batch:'RM-2026-0144',result:'CONDITIONAL', inspector:'Qc. Khalid',  date:'2026-05-15T14:00:00Z', passQty:480, failQty:20, totalQty:500, notes:'Surface finish deviation in 20 pcs — accepted with concession' },
  { id:'4', number:'INS-2026-0918', type:'PATROL',     product:'Gear Set C2',        batch:'B-2026-0479', result:'PASS',        inspector:'Qc. Omar',    date:'2026-05-15T10:00:00Z', passQty:300, failQty:0,  totalQty:300, notes:'' },
  { id:'5', number:'INS-2026-0917', type:'FINAL',      product:'Motor Bracket D1',   batch:'B-2026-0478', result:'FAIL',        inspector:'Qc. Fatima',  date:'2026-05-14T16:30:00Z', passQty:380, failQty:32, totalQty:412, notes:'Dimensional non-conformance on bore diameter' },
  { id:'6', number:'INS-2026-0916', type:'INCOMING',   product:'Aluminum Billets',   batch:'RM-2026-0143',result:'PASS',        inspector:'Qc. Ahmed',   date:'2026-05-14T09:00:00Z', passQty:200, failQty:0,  totalQty:200, notes:'' },
  { id:'7', number:'INS-2026-0915', type:'IN_PROCESS', product:'Coupling Flange A3', batch:'B-2026-0477', result:'PASS',        inspector:'Qc. Sara',    date:'2026-05-13T11:00:00Z', passQty:400, failQty:0,  totalQty:400, notes:'' },
];

const SUMMARY = [
  { label:'Inspections Today', value:'4',   color:'text-brand-400'  },
  { label:'Pass Rate',         value:'85%', color:'text-green-400'  },
  { label:'Conditional',       value:'1',   color:'text-amber-400'  },
  { label:'Failed',            value:'1',   color:'text-red-400'    },
];

export function QualityInspectionsView() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<InspType | 'ALL'>('ALL');

  const filtered = DATA.filter(i =>
    (typeFilter === 'ALL' || i.type === typeFilter) &&
    (i.number.toLowerCase().includes(search.toLowerCase()) || i.product.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Quality Inspections</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Incoming, in-process, final, and patrol inspection records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Download size={13}/>Export</Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs"><Plus size={13}/>New Inspection</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SUMMARY.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.05 }}
              className="industrial-card rounded-xl p-4">
              <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(['ALL','INCOMING','IN_PROCESS','FINAL','PATROL'] as const).map(t => (
            <Button key={t} variant={typeFilter===t ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
              onClick={() => setTypeFilter(t)}>
              {t === 'ALL' ? 'All Types' : TYPE_CONFIG[t as InspType]?.label ?? t}
            </Button>
          ))}
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 w-44 text-xs" />
          </div>
        </div>

        <div className="industrial-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/30">
                {['Inspection #','Type','Product','Batch','Result','Pass / Total','Inspector','Date',''].map(h => (
                  <TableHead key={h} className="text-[11px]">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ins => {
                const typeCfg = TYPE_CONFIG[ins.type];
                const resCfg  = RESULT_CONFIG[ins.result];
                const ResIcon = resCfg.icon;
                return (
                  <TableRow key={ins.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                    <TableCell className="font-mono text-xs font-semibold text-primary">{ins.number}</TableCell>
                    <TableCell><span className={cn('text-[10px] font-semibold', typeCfg.color)}>{typeCfg.label}</span></TableCell>
                    <TableCell className="text-xs">{ins.product}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{ins.batch}</TableCell>
                    <TableCell>
                      <span className={cn('flex items-center gap-1 text-xs font-semibold', resCfg.color)}>
                        <ResIcon size={12}/>{resCfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="text-green-400 font-medium">{ins.passQty}</span>
                      <span className="text-muted-foreground"> / {ins.totalQty}</span>
                      {ins.failQty > 0 && <span className="text-red-400 ml-1">({ins.failQty} fail)</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ins.inspector}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(ins.date)}</TableCell>
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
