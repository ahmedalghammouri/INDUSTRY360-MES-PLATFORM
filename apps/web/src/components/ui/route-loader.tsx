'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const MESSAGES = [
  'Loading module...',
  'Fetching production data...',
  'Syncing shop floor...',
  'Connecting to IIoT...',
  'Building workspace...',
];

type Phase = 'idle' | 'enter' | 'exit';

export function RouteLoader() {
  const pathname            = usePathname();
  const [phase, setPhase]   = useState<Phase>('idle');
  const [msgIdx, setMsgIdx] = useState(0);
  const prevPath            = useRef(pathname);
  const timers              = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearT = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  /* ── Intercept link clicks ───────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      try {
        const dest = new URL(a.href, location.href);
        if (dest.origin !== location.origin) return;
        // ignore fragment-only links, same page
        if (dest.pathname === location.pathname && dest.hash) return;
        if (dest.pathname === location.pathname) return;
      } catch { return; }

      clearT();
      setMsgIdx(Math.floor(Math.random() * MESSAGES.length));
      setPhase('enter');
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  /* ── Dismiss when pathname changes ──────────────────────── */
  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;
    if (phase === 'idle') return;

    setPhase('exit');
    const t = setTimeout(() => setPhase('idle'), 380);
    timers.current = [t];
    return clearT;
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'idle') return null;

  const visible = phase === 'enter';

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden pointer-events-none"
      style={{
        background: 'rgba(7, 8, 13, 0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 320ms ease',
      }}
    >
      {/* Animated grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.12) 1px,transparent 1px),' +
            'linear-gradient(90deg,rgba(99,102,241,0.12) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
          animation: 'mes-grid-drift 18s linear infinite',
          opacity: 0.06,
        }}
      />

      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg,transparent,rgba(99,102,241,0.45) 30%,rgba(167,139,250,0.7) 50%,rgba(99,102,241,0.45) 70%,transparent)',
          animation: 'mes-scan 4s ease-in-out infinite',
          top: 0,
        }}
      />

      {/* Corner brackets */}
      {[
        'top-4 left-4 border-l border-t',
        'top-4 right-4 border-r border-t',
        'bottom-4 left-4 border-l border-b',
        'bottom-4 right-4 border-r border-b',
      ].map(cls => (
        <div
          key={cls}
          className={`absolute w-5 h-5 ${cls}`}
          style={{ borderColor: 'rgba(99,102,241,0.2)' }}
        />
      ))}

      {/* Content card */}
      <div
        className="relative flex flex-col items-center gap-7"
        style={{ animation: visible ? 'mes-fade-up 0.35s ease forwards' : 'none' }}
      >
        {/* Logo + spinner ring */}
        <div className="relative" style={{ width: 88, height: 88 }}>
          {/* Outer spinning ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '2px solid transparent',
              borderTopColor: '#6366f1',
              borderRightColor: '#a78bfa',
              animation: 'spin 0.9s linear infinite',
            }}
          />
          {/* Inner reverse ring */}
          <div
            className="absolute inset-[12px] rounded-full"
            style={{
              border: '1.5px solid transparent',
              borderBottomColor: '#60a5fa',
              borderLeftColor: '#06b6d4',
              animation: 'spin 1.4s linear infinite reverse',
            }}
          />
          {/* Pulse rings */}
          {[0, 0.9].map(delay => (
            <div
              key={delay}
              className="absolute rounded-full"
              style={{
                inset: -10,
                border: '1px solid rgba(99,102,241,0.2)',
                animation: `mes-pulse-ring 2.2s ease-out ${delay}s infinite`,
              }}
            />
          ))}
          {/* Center logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="STAR-MES"
              className="w-[48px] h-[48px] rounded-[13px] object-cover"
              style={{
                boxShadow:
                  '0 0 0 1px rgba(255,255,255,0.08) inset,' +
                  '0 0 18px rgba(99,102,241,0.45)',
                animation: 'mes-float 3s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* Brand text */}
        <div className="text-center -mt-1 flex flex-col items-center gap-1.5">
          <div
            className="font-black text-[22px] tracking-tight"
            style={{
              background: 'linear-gradient(90deg,#818cf8,#a78bfa,#60a5fa,#818cf8)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'mes-shimmer-sweep 2.4s linear infinite',
            }}
          >
            STAR-MES
          </div>
          <div
            className="text-[10px] font-mono tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.22)' }}
          >
            {MESSAGES[msgIdx]}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-[200px] flex flex-col gap-2">
          <div
            className="relative h-[2px] rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg,#6366f1,#a78bfa,#60a5fa)',
                boxShadow: '0 0 8px rgba(99,102,241,0.8)',
                animation: 'mes-progress-fill 6s ease forwards',
              }}
            />
            <div
              className="absolute top-0 h-full w-10"
              style={{
                background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)',
                animation: 'nav-bar-shimmer 1.2s ease-in-out infinite',
              }}
            />
          </div>
          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1 h-1 rounded-full"
                style={{
                  background: '#6366f1',
                  animation: `mes-dot-bounce 1.3s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom label */}
      <div
        className="absolute bottom-4 text-[8px] font-mono tracking-widest uppercase"
        style={{ color: 'rgba(255,255,255,0.1)' }}
      >
        STAR-MES v1.0 · NCC/SIDCO PoC
      </div>
    </div>
  );
}
