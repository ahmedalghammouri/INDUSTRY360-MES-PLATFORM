'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Download, Filter, ChevronRight, FlaskConical, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatDate } from '@/lib/utils';

type BatchStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED' | 'PENDING';

interface Batch {
  id: string; batchNumber: string; product: string; productCode: string;
  status: BatchStatus; quantity: number; actualQuantity: number | null;
  startDate: string; endDate: string | null; line: string;
  operator: string; yield: number | null; defects: number;
}

const STATUS_CONFIG: Record<BatchStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  IN_PROGRESS: { label: 'In Progress', variant: 'default' },
  COMPLETED:   { label: 'Completed',   variant: 'secondary' },
  ON_HOLD:     { label: 'On Hold',     variant: 'outline' },
  CANCELLED:   { label: 'Cancelled',   variant: 'destructive' },
  PENDING:     { label: 'Pending',     variant: 'outline' },
};

const MOCK_BATCHES: Batch[] = [
  { id:'1', batchNumber:'B-2026-0481', product:'Valve Assembly A1',  productCode:'VA-A1',  status:'IN_PROGRESS', quantity:1200, actualQuantity:748,  startDate:'2026-05-16T06:00:00Z', endDate:null,                   line:'Line A', operator:'Ahmed Al-Rashid',  yield:null,  defects:3  },
  { id:'2', batchNumber:'B-2026-0480', product:'Pump Housing B3',    productCode:'PH-B3',  status:'COMPLETED',   quantity:800,  actualQuantity:796,  startDate:'2026-05-15T06:00:00Z', endDate:'2026-05-15T18:00:00Z', line:'Line B', operator:'Sara Mohammed',     yield:99.5, defects:4  },
  { id:'3', batchNumber:'B-2026-0479', product:'Gear Set C2',        productCode:'GS-C2',  status:'COMPLETED',   quantity:600,  actualQuantity:598,  startDate:'2026-05-14T06:00:00Z', endDate:'2026-05-14T16:00:00Z', line:'Line C', operator:'Khalid Ibrahim',    yield:99.7, defects:2  },
  { id:'4', batchNumber:'B-2026-0478', product:'Motor Bracket D1',   productCode:'MB-D1',  status:'ON_HOLD',     quantity:1000, actualQuantity:412,  startDate:'2026-05-13T06:00:00Z', endDate:null,                   line:'Line D', operator:'Fatima Al-Zahra',  yield:null,  defects:8  },
  { id:'5', batchNumber:'B-2026-0477', product:'Coupling Flange A3', productCode:'CF-A3',  status:'COMPLETED',   quantity:400,  actualQuantity:400,  startDate:'2026-05-12T06:00:00Z', endDate:'2026-05-12T14:00:00Z', line:'Line A', operator:'Ahmed Al-Rashid',  yield:100,  defects:0  },
  { id:'6', batchNumber:'B-2026-0476', product:'Bearing Housing E2', productCode:'BH-E2',  status:'CANCELLED',   quantity:500,  actualQuantity:0,    startDate:'2026-05-11T06:00:00Z', endDate:null,                   line:'Line E', operator:'Omar Hassan',       yield:null,  defects:0  },
  { id:'7', batchNumber:'B-2026-0482', product:'Impeller Set C4',    productCode:'IS-C4',  status:'PENDING',     quantity:900,  actualQuantity:0,    startDate:'2026-05-17T06:00:00Z', endDate:null,                   line:'Line C', operator:'Unassigned',        yield:null,  defects:0  },
];

const SUMMARY = [
  { label:'Active Batches',    value:'2',     icon:FlaskConical,  color:'text-brand-400'  },
  { label:'Completed Today',   value:'3',     icon:CheckCircle2,  color:'text-green-400'  },
  { label:'On Hold',           value:'1',     icon:Clock,         color:'text-amber-400'  },
  { label:'Total Defects',     value:'17',    icon:AlertTriangle, color:'text-red-400'    },
];

export function ProductionBatchesView() {
  const [search, setSearch] = useState('');
  const filtered = MOCK_BATCHES.filter(b =>
    b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
    b.product.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">Production Batches</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track batch progress, yields, and quality outcomes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Download size={13} />Export</Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs"><Plus size={13} />New Batch</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SUMMARY.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.label} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }}
                className="industrial-card rounded-xl p-4 flex items-center gap-3">
                <Icon className={cn('w-8 h-8', s.color)} />
                <div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Table */}
        <div className="industrial-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search batch or product..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 w-56 text-xs" />
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"><Filter size={13} />Filter</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/30">
                {['Batch #','Product','Status','Progress','Line','Operator','Start Date','Yield','Defects',''].map(h => (
                  <TableHead key={h} className="text-[11px]">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(batch => {
                const progress = batch.actualQuantity ? Math.round((batch.actualQuantity / batch.quantity) * 100) : 0;
                const cfg = STATUS_CONFIG[batch.status];
                return (
                  <TableRow key={batch.id} className="border-border/20 hover:bg-muted/20 cursor-pointer">
                    <TableCell className="font-mono text-xs font-semibold text-primary">{batch.batchNumber}</TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{batch.product}</div>
                      <div className="text-[10px] text-muted-foreground">{batch.productCode}</div>
                    </TableCell>
                    <TableCell><Badge variant={cfg.variant} className="text-[10px] h-5">{cfg.label}</Badge></TableCell>
                    <TableCell className="min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width:`${progress}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] h-5">{batch.line}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{batch.operator}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(batch.startDate)}</TableCell>
                    <TableCell className="text-xs">
                      {batch.yield != null
                        ? <span className={batch.yield >= 99 ? 'text-green-400' : 'text-amber-400'}>{batch.yield}%</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className={batch.defects > 5 ? 'text-red-400 font-medium' : batch.defects > 0 ? 'text-amber-400' : 'text-green-400'}>
                        {batch.defects}
                      </span>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7"><ChevronRight size={13} /></Button></TableCell>
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
