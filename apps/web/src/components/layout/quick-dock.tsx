'use client';

/**
 * QuickDock — a macOS-style magnifying dock of project-wide quick actions.
 *
 * Fixed to the bottom-centre of every page. A small handle toggles it open/closed;
 * it also closes on outside-click, Escape, or route change. Actions are grouped by
 * category with vertical separators, and icons magnify based on cursor proximity.
 */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { Rocket, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QUICK_ACTION_GROUPS, type QuickAction } from '@/lib/quick-actions';

const BASE = 42; // resting icon box size (px)
const MAX = 60; // magnified icon box size (px)
const RANGE = 120; // px of cursor distance over which magnification falls off

function DockIcon({
  action,
  mouseX,
  active,
}: {
  action: QuickAction;
  mouseX: MotionValue<number>;
  active: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const Icon = action.icon;

  // Distance from cursor to this icon's centre (viewport coords → scroll-safe).
  const distance = useTransform(mouseX, (val) => {
    const b = ref.current?.getBoundingClientRect();
    if (!b) return RANGE + 1;
    return val - (b.x + b.width / 2);
  });

  const sizeSync = useTransform(distance, [-RANGE, 0, RANGE], [BASE, MAX, BASE], { clamp: true });
  const size = useSpring(sizeSync, { mass: 0.1, stiffness: 170, damping: 14 });
  const iconScale = useTransform(size, [BASE, MAX], [1, 1.38]);

  return (
    <Link
      ref={ref}
      href={action.href}
      target={action.newTab ? '_blank' : undefined}
      rel={action.newTab ? 'noopener noreferrer' : undefined}
      title={action.label}
      aria-label={action.label}
      className="flex shrink-0 items-center justify-center"
    >
      <motion.div
        style={{ width: size, height: size }}
        className={cn(
          'relative flex items-center justify-center rounded-2xl border transition-colors',
          active
            ? 'border-primary/60 bg-primary/15'
            : 'border-border/40 bg-card/70 hover:border-primary/40 hover:bg-muted/50',
        )}
      >
        <motion.span style={{ scale: iconScale }} className="flex items-center justify-center">
          <Icon size={18} className={action.tone} />
        </motion.span>
        {active && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />}
      </motion.div>
    </Link>
  );
}

export function QuickDock() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mouseX = useMotionValue(Infinity);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside-click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Close after navigating to a new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div
      ref={wrapRef}
      className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onMouseMove={(e) => mouseX.set(e.clientX)}
            onMouseLeave={() => mouseX.set(Infinity)}
            className="no-scrollbar flex h-[72px] max-w-[96vw] items-center gap-1.5 overflow-x-auto overflow-y-hidden rounded-2xl border border-border/60 bg-background/80 px-3 shadow-2xl backdrop-blur-xl"
          >
            {QUICK_ACTION_GROUPS.map((group, gi) => (
              <React.Fragment key={group.category}>
                {gi > 0 && <div className="mx-1 h-9 w-px shrink-0 bg-border/60" />}
                <div className="flex items-center gap-1.5" title={group.category}>
                  {group.actions.map((a) => (
                    <DockIcon
                      key={a.href + a.label}
                      action={a}
                      mouseX={mouseX}
                      active={pathname === a.href || (a.href !== '/' && pathname.startsWith(a.href + '/'))}
                    />
                  ))}
                </div>
              </React.Fragment>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle handle — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Hide quick actions' : 'Show quick actions'}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md transition-all',
          open
            ? 'border-primary/50 bg-primary/15 text-primary'
            : 'border-border/60 bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-foreground',
        )}
      >
        {open ? <X size={13} /> : <Rocket size={13} className="text-primary" />}
        <span>{open ? 'Close' : 'Quick Actions'}</span>
      </button>
    </div>
  );
}
