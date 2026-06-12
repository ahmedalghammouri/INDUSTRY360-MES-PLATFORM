'use client';

/**
 * Current-shift summary band — identity + time & output progress + quick stats.
 * Fed by GET /shifts/analysis. Shared by the Shop Floor (above the cards) and the
 * Live Dashboard (below the filters). `compact` drops the inline stat strip.
 */

import React from 'react';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const fmtMins = (m: number | null | undefined) => {
  if (m == null) return '—';
  if (m < 1) return `${Math.round(m * 60)}s`;
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
};

export function ShiftSummaryBand({ shift, compact }: { shift: any; compact?: boolean }) {
  if (!shift?.status?.active) return null;
  const s = shift.status;
  const a = s.active;
  const t = shift.totals;
  const timePct = Math.min(100, s.timeProgressPct ?? 0);
  const outPct = t?.targetProgressPct ?? null;
  const onTrack = outPct != null ? outPct >= timePct - 5 : true;
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-[180px]">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.isActiveNow ? 'bg-green-500/20 border border-green-400/30' : 'bg-muted border border-border'}`}>
            <Clock className={`w-5 h-5 ${s.isActiveNow ? 'text-green-400' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{a.name}</span>
              <Badge variant={s.isActiveNow ? 'success' : 'secondary'} className="text-[10px]">{s.isActiveNow ? 'Active' : 'Idle'}</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">{a.window} · {s.shiftsPerDay} shifts/day</div>
          </div>
        </div>
        <div className="flex-1 min-w-[260px] space-y-2">
          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-muted-foreground">Shift time · elapsed {fmtMins(s.elapsedMin)}</span>
              <span className="text-muted-foreground">{fmtMins(s.remainingMin)} left</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-brand-500/70" style={{ width: `${timePct}%` }} /></div>
          </div>
          {t?.target != null && (
            <div>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-muted-foreground">Output {t.good.toLocaleString()} / {t.target.toLocaleString()}</span>
                <span className={onTrack ? 'text-green-400' : 'text-amber-400'}>{onTrack ? 'On track' : 'Behind pace'} · {outPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${onTrack ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, outPct ?? 0)}%` }} /></div>
            </div>
          )}
        </div>
        {!compact && t && (
          <div className="flex items-center divide-x divide-border/50 text-center">
            <div className="px-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Good</div><div className="text-base font-bold tabular-nums text-green-400">{t.good.toLocaleString()}</div></div>
            {t.scrap > 0 && <div className="px-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Scrap</div><div className="text-base font-bold tabular-nums text-red-400">{t.scrap.toLocaleString()}</div></div>}
            {t.quality != null && <div className="px-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Quality</div><div className="text-base font-bold tabular-nums">{t.quality}%</div></div>}
            <div className="px-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Running</div><div className="text-base font-bold tabular-nums">{t.runningMachines}/{t.totalMachines}</div></div>
          </div>
        )}
      </div>
    </div>
  );
}
