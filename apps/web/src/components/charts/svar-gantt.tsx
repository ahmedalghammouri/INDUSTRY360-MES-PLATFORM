'use client';

import dynamic from 'next/dynamic';
import type { SvarGanttProps } from './svar-gantt-inner';

/**
 * SSR-safe wrapper around the SVAR Gantt. The library reads the DOM at module
 * load, so it must only run on the client.
 */
const SvarGanttInner = dynamic(() => import('./svar-gantt-inner'), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2" style={{ minHeight: 320 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="shimmer h-7 rounded" />
      ))}
    </div>
  ),
});

export type { SvarGanttProps };

export function SvarGantt(props: SvarGanttProps) {
  return <SvarGanttInner {...props} />;
}
