'use client';

import React, { useEffect, useState } from 'react';
import { Cpu, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const CYCLE_MESSAGES = [
  'Initializing production modules...',
  'Loading quality management...',
  'Connecting to shop floor...',
  'Syncing IIoT sensor data...',
  'Calibrating OEE analytics...',
  'Building your workspace...',
];

interface StarLoaderProps {
  /** Fill the entire viewport — default true */
  fullscreen?: boolean;
  /** Override the cycling message */
  message?: string;
}

export function StarLoader({ fullscreen = true, message }: StarLoaderProps) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [dots, setDots]     = useState('');

  useEffect(() => {
    const msgT = setInterval(() => setMsgIdx(i => (i + 1) % CYCLE_MESSAGES.length), 1600);
    const dotT = setInterval(() => setDots(d => (d.length >= 3 ? '' : d + '.')),    380);
    return () => { clearInterval(msgT); clearInterval(dotT); };
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center overflow-hidden select-none',
        fullscreen
          ? 'fixed inset-0 z-[9999] bg-[#07080d]'
          : 'relative w-full min-h-[420px] bg-[#07080d] rounded-xl',
      )}
    >
      {/* ── Animated grid background ─────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.18) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(99,102,241,0.18) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          animation: 'mes-grid-drift 18s linear infinite',
          opacity: 0.045,
        }}
      />

      {/* ── Radial vignette glow ─────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 50%,' +
            ' rgba(99,102,241,0.09) 0%, transparent 70%)',
        }}
      />

      {/* ── Scan line ────────────────────────────────────────── */}
      <div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg,transparent 0%,' +
            'rgba(99,102,241,0.5) 20%,' +
            'rgba(167,139,250,0.7) 50%,' +
            'rgba(99,102,241,0.5) 80%,' +
            'transparent 100%)',
          animation: 'mes-scan 5s ease-in-out infinite',
          top: 0,
        }}
      />

      {/* ── Corner HMI brackets ──────────────────────────────── */}
      <Corner pos="top-5 left-5"    borders="border-l border-t" />
      <Corner pos="top-5 right-5"   borders="border-r border-t" />
      <Corner pos="bottom-5 left-5"  borders="border-l border-b" />
      <Corner pos="bottom-5 right-5" borders="border-r border-b" />

      {/* ── Live status indicator (top-right) ────────────────── */}
      <div className="absolute top-6 right-14 flex items-center gap-1.5 opacity-40">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[9px] font-mono text-emerald-400/70 tracking-widest uppercase">
          System Live
        </span>
      </div>

      {/* ── Main content ─────────────────────────────────────── */}
      <div
        className="relative flex flex-col items-center gap-9"
        style={{ animation: 'mes-fade-up 0.6s ease forwards' }}
      >

        {/* ── 3-D ring system ────────────────────────────────── */}
        <div className="relative" style={{ perspective: '700px' }}>

          {/* Expanding pulse rings */}
          <PulseRing delay={0}   size="inset-[-28px]" />
          <PulseRing delay={1.1} size="inset-[-28px]" />

          {/* Orbiting micro-dots */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <OrbitDot delay={0}   color="#6366f1" speed="mes-orbit 8s linear infinite" />
            <OrbitDot delay={0.5} color="#a78bfa" speed="mes-orbit-rev 6s linear infinite" />
          </div>

          {/* Outer 3-D spinning disc */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg,' +
                ' transparent 0%,' +
                ' transparent 38%,' +
                ' #6366f1 52%,' +
                ' #a78bfa 62%,' +
                ' #60a5fa 70%,' +
                ' transparent 82%)',
              animation: 'mes-disc-spin 3.2s linear infinite',
            }}
          />

          {/* Inner 3-D reverse disc */}
          <div
            className="absolute inset-[16px] rounded-full"
            style={{
              background:
                'conic-gradient(from 200deg,' +
                ' transparent 0%,' +
                ' transparent 40%,' +
                ' #06b6d4 54%,' +
                ' #3b82f6 64%,' +
                ' transparent 78%)',
              animation: 'mes-disc-spin-rev 2.1s linear infinite',
            }}
          />

          {/* Container for logo + glow */}
          <div className="relative w-[128px] h-[128px] flex items-center justify-center">

            {/* Blurred glow behind the logo */}
            <div
              className="absolute w-16 h-16 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
                filter: 'blur(14px)',
                animation: 'mes-glow-blur 2.2s ease-in-out infinite',
              }}
            />

            {/* Logo tile */}
            <img
              src="/logo.png"
              alt="STAR-MES"
              className="relative z-10 w-[66px] h-[66px] rounded-[18px] object-cover"
              style={{
                boxShadow:
                  '0 0 0 1px rgba(255,255,255,0.10) inset,' +
                  '0 0 28px rgba(99,102,241,0.45),' +
                  '0 4px 24px rgba(0,0,0,0.5)',
                animation: 'mes-float 3.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* ── Brand name ─────────────────────────────────────── */}
        <div className="text-center -mt-1">
          <div className="flex items-baseline justify-center gap-1.5">
            <span
              className="font-black text-[34px] tracking-tight leading-none"
              style={{
                background: 'linear-gradient(90deg,#818cf8 0%,#a78bfa 35%,#60a5fa 65%,#818cf8 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'mes-shimmer-sweep 2.8s linear infinite',
              }}
            >
              STAR
            </span>
            <span className="font-bold text-[34px] tracking-tight leading-none text-white/30">
              -MES
            </span>
          </div>
          <div
            className="text-[9px] font-semibold tracking-[0.28em] uppercase mt-2"
            style={{ color: 'rgba(255,255,255,0.2)' }}
          >
            Manufacturing Execution System
          </div>
        </div>

        {/* ── Progress bar ───────────────────────────────────── */}
        <div className="w-[272px] flex flex-col gap-2.5">
          <div
            className="relative h-[2px] rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg,#6366f1,#a78bfa,#60a5fa)',
                boxShadow: '0 0 8px rgba(99,102,241,0.9)',
                animation: 'mes-progress-fill 9s ease forwards',
              }}
            />
            {/* Shimmer spark */}
            <div
              className="absolute top-0 h-full w-12 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)',
                animation: 'nav-bar-shimmer 1.6s ease-in-out infinite',
              }}
            />
          </div>

          {/* Message + dots row */}
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-mono truncate pr-2"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              {message ?? CYCLE_MESSAGES[msgIdx]}{dots}
            </span>
            <div className="flex gap-1 shrink-0">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: '#6366f1',
                    opacity: 0.6,
                    animation: `mes-dot-bounce 1.4s ease-in-out ${i * 0.22}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Floating micro-particles ────────────────────────── */}
        <div className="absolute pointer-events-none" style={{ bottom: -20, left: '50%', transform: 'translateX(-50%)', width: 180, height: 80, overflow: 'hidden' }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: i % 2 === 0 ? 3 : 2,
                height: i % 2 === 0 ? 3 : 2,
                background: i % 3 === 0 ? '#6366f1' : i % 3 === 1 ? '#a78bfa' : '#06b6d4',
                left: `${8 + i * 16}%`,
                bottom: `${10 + (i % 3) * 8}%`,
                opacity: 0.5,
                animation: `mes-particle-rise ${2.2 + i * 0.45}s ease-out ${i * 0.35}s infinite`,
              }}
            />
          ))}
        </div>

        {/* ── Module icons row ────────────────────────────────── */}
        <div className="flex items-center gap-5 -mt-2">
          {[
            { Icon: Cpu,      label: 'IIoT',        delay: 0    },
            { Icon: Activity, label: 'OEE',         delay: 0.2  },
            { Icon: Zap,      label: 'Energy',      delay: 0.4  },
          ].map(({ Icon, label, delay }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1"
              style={{
                animation: `mes-fade-up 0.5s ease ${delay}s both`,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.15)',
                }}
              >
                <Icon size={14} style={{ color: 'rgba(129,140,248,0.6)' }} />
              </div>
              <span
                className="text-[8px] font-mono tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.18)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom info bar ──────────────────────────────────── */}
      <div
        className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-3"
        style={{ animation: 'mes-fade-up 0.8s ease 0.4s both' }}
      >
        <div className="h-px w-10" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <span
          className="text-[8px] font-mono tracking-[0.18em] uppercase"
          style={{ color: 'rgba(255,255,255,0.12)' }}
        >
          STAR-MES v1.0 · NCC / SIDCO PoC · Dammam Industrial City
        </span>
        <div className="h-px w-10" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function Corner({ pos, borders }: { pos: string; borders: string }) {
  return (
    <div
      className={`absolute w-6 h-6 pointer-events-none ${pos} ${borders}`}
      style={{ borderColor: 'rgba(99,102,241,0.22)' }}
    />
  );
}

function PulseRing({ delay, size }: { delay: number; size: string }) {
  return (
    <div
      className={`absolute ${size} rounded-full pointer-events-none`}
      style={{
        border: '1px solid rgba(99,102,241,0.25)',
        animation: `mes-pulse-ring 2.4s ease-out ${delay}s infinite`,
      }}
    />
  );
}

function OrbitDot({ delay, color, speed }: { delay: number; color: string; speed: string }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full pointer-events-none"
      style={{
        background: color,
        opacity: 0.65,
        boxShadow: `0 0 6px ${color}`,
        animation: speed,
        animationDelay: `${delay}s`,
      }}
    />
  );
}
