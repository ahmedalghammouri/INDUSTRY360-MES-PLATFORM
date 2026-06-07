'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, Zap, Users, AlertTriangle, TrendingUp,
  Clock, Building2, MapPin, ChevronRight, Shield, Wifi,
} from 'lucide-react';
import { FACTORIES, Factory } from './factories';
import { SaudiMap } from './saudi-map';
import { authService } from '@/services/auth.service';
import { useFactoryStore } from '@/store/factory-store';

function AnimatedNumber({ value, decimals = 1 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1200;
    const step = (end - start) / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
}

function OEEGauge({ value, color }: { value: number; color: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const arc = (value / 100) * circumference;
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={radius} fill="none"
        stroke={color} strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circumference}`}
        transform="rotate(-90 50 50)"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <text x="50" y="46" textAnchor="middle" fill={color} fontSize="16" fontWeight="bold" fontFamily="monospace">
        {value.toFixed(1)}
      </text>
      <text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">
        OEE %
      </text>
    </svg>
  );
}

function KPIBadge({ label, value, unit, icon: Icon, color }: {
  label: string; value: number | string; unit?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
      <Icon size={14} style={{ color }} />
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] text-white/40 uppercase tracking-wider truncate">{label}</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && <span className="text-white/40 font-normal ml-1 text-[10px]">{unit}</span>}
        </span>
      </div>
    </div>
  );
}

function GlobalStats() {
  const total = FACTORIES.reduce((acc, f) => ({
    oee: acc.oee + f.kpis.oee,
    alarms: acc.alarms + f.kpis.activeAlarms,
    employees: acc.employees + f.kpis.employees,
  }), { oee: 0, alarms: 0, employees: 0 });

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {[
        { label: 'Avg OEE', value: (total.oee / FACTORIES.length).toFixed(1), unit: '%', color: '#00d4ff', icon: Activity },
        { label: 'Factories', value: FACTORIES.length, unit: 'sites', color: '#22c55e', icon: Building2 },
        { label: 'Employees', value: total.employees, unit: 'total', color: '#a855f7', icon: Users },
        { label: 'Active Alarms', value: total.alarms, unit: '', color: total.alarms > 5 ? '#ef4444' : '#f59e0b', icon: AlertTriangle },
      ].map((s) => (
        <div key={s.label} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.03]">
          <s.icon size={20} style={{ color: s.color }} />
          <div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">{s.label}</div>
            <div className="text-lg font-bold font-mono" style={{ color: s.color }}>
              {s.value}{s.unit && <span className="text-xs text-white/40 ml-1">{s.unit}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FactorySelector() {
  const router = useRouter();
  const { setFactories } = useFactoryStore();
  const [selected, setSelected] = useState<Factory | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setTime(new Date());
    const t1 = setInterval(() => setTick((n) => n + 1), 3000);
    const t2 = setInterval(() => setTime(new Date()), 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  // Fetch factories from API and populate store for login page context
  useEffect(() => {
    authService.getFactories().then((apiFactories) => {
      setFactories(
        apiFactories.map((f) => ({
          id: f.id,
          code: f.code,
          name: f.name,
          nameAr: f.nameAr,
          city: f.city ?? undefined,
          lat: f.lat ?? undefined,
          lng: f.lng ?? undefined,
          color: f.color,
          glowColor: f.glowColor,
          isActive: f.isActive,
        })),
      );
    }).catch(() => {
      // API unavailable — login page will fall back to static FACTORIES
    });
  }, [setFactories]);

  const active = selected ?? (hovered ? FACTORIES.find((f) => f.id === hovered) ?? null : null);

  function handleSelect(factory: Factory) {
    setSelected(factory);
    setTimeout(() => {
      router.push(`/login?factory=${factory.code}`);
    }, 600);
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 60% 40%, #001428 0%, #000a18 50%, #000510 100%)',
        fontFamily: 'var(--font-geist-sans), sans-serif',
      }}
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,200,255,0.5) 2px, rgba(0,200,255,0.5) 3px)', backgroundSize: '100% 4px' }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Shield size={20} className="text-cyan-400" />
            </div>
            <div>
              <div className="text-white font-bold text-lg tracking-tight leading-none">STAR-MES</div>
              <div className="text-cyan-400/70 text-xs font-mono tracking-widest">MES PLATFORM</div>
            </div>
          </div>
          <div className="h-6 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400/80 text-xs font-mono">ALL SYSTEMS OPERATIONAL</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-white/40 text-xs font-mono">
            <Wifi size={12} />
            <span>KSA INDUSTRIAL NETWORK</span>
          </div>
          <div className="flex items-center gap-2 text-cyan-300 text-sm font-mono">
            <Clock size={14} />
            <span suppressHydrationWarning>
              {mounted && time ? time.toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
            </span>
          </div>
          <div className="text-white/40 text-xs font-mono" suppressHydrationWarning>
            {mounted && time ? time.toLocaleDateString('en-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '---'}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col px-8 py-4 gap-4 overflow-hidden">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Manufacturing Network — <span className="text-cyan-400">Kingdom of Saudi Arabia</span>
            </h1>
            <p className="text-white/40 text-sm mt-0.5">
              Select a facility to access its Manufacturing Execution System
            </p>
          </div>
          <div className="flex items-center gap-3">
            {FACTORIES.map((f) => (
              <button
                key={f.id}
                onClick={() => handleSelect(f)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all duration-200"
                style={{
                  borderColor: hovered === f.id || selected?.id === f.id ? f.color : 'rgba(255,255,255,0.1)',
                  color: hovered === f.id || selected?.id === f.id ? f.color : 'rgba(255,255,255,0.4)',
                  background: hovered === f.id || selected?.id === f.id ? `${f.color}15` : 'transparent',
                }}
                onMouseEnter={() => setHovered(f.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.color }} />
                {f.code}
              </button>
            ))}
          </div>
        </div>

        {/* Global stats bar */}
        <GlobalStats />

        {/* Map + detail panel */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left panel — factory list */}
          <div className="w-64 flex flex-col gap-2 overflow-y-auto">
            <div className="text-[11px] text-white/30 font-mono uppercase tracking-widest px-1 mb-1">
              Facilities ({FACTORIES.length})
            </div>
            {FACTORIES.map((f) => {
              const isActive = hovered === f.id || selected?.id === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => handleSelect(f)}
                  onMouseEnter={() => setHovered(f.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="text-left rounded-xl border p-3 transition-all duration-200 group"
                  style={{
                    borderColor: isActive ? f.color : 'rgba(255,255,255,0.06)',
                    background: isActive ? `${f.color}10` : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                        style={{ background: f.color, boxShadow: isActive ? `0 0 8px ${f.color}` : 'none' }}
                      />
                      <span className="text-xs font-bold font-mono" style={{ color: f.color }}>{f.code}</span>
                    </div>
                    <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors mt-0.5" />
                  </div>
                  <div className="text-[11px] text-white/70 leading-tight pl-4">{f.name}</div>
                  <div className="flex items-center gap-1 pl-4 mt-1.5">
                    <MapPin size={9} className="text-white/30" />
                    <span className="text-[10px] text-white/30">{f.city}</span>
                  </div>
                  {isActive && (
                    <div className="mt-2 pt-2 border-t border-white/5 pl-4 grid grid-cols-2 gap-1">
                      <div>
                        <div className="text-[10px] text-white/30">OEE</div>
                        <div className="text-xs font-mono font-bold" style={{ color: f.color }}>{f.kpis.oee}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/30">Quality</div>
                        <div className="text-xs font-mono font-bold text-white/70">{f.kpis.quality}%</div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Center — Map */}
          <div className="flex-1 relative rounded-2xl border border-white/[0.06] overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at center, #001830 0%, #000c1c 100%)' }}
          >
            {/* Corner decorations */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/30 rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/30 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/30 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/30 rounded-br-2xl" />

            <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/20 tracking-widest uppercase">
              Kingdom of Saudi Arabia — Industrial Network
            </div>

            <SaudiMap
              factories={FACTORIES}
              selectedId={selected?.id ?? null}
              hoveredId={hovered}
              onHover={setHovered}
              onSelect={handleSelect}
            />

            {/* Bottom coordinate display */}
            <div className="absolute bottom-3 right-4 text-[10px] font-mono text-white/20">
              23.8859° N, 45.0792° E
            </div>
          </div>

          {/* Right panel — selected factory detail */}
          <div className="w-72 flex flex-col gap-3">
            {active ? (
              <>
                {/* Factory identity */}
                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: `${active.color}40`, background: `${active.color}08` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full" style={{ background: active.color, boxShadow: `0 0 12px ${active.color}` }} />
                    <span className="text-xs font-bold font-mono" style={{ color: active.color }}>{active.code}</span>
                    <span className="ml-auto text-[10px] text-white/30 font-mono">
                      {active.kpis.activeAlarms > 0 ? (
                        <span className="text-amber-400">{active.kpis.activeAlarms} ALARMS</span>
                      ) : (
                        <span className="text-green-400">NO ALARMS</span>
                      )}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white/90 leading-tight mb-1">{active.name}</div>
                  <div className="text-xs text-white/40">{active.nameAr}</div>
                  <div className="flex items-center gap-1 mt-2">
                    <MapPin size={11} style={{ color: active.color }} />
                    <span className="text-xs text-white/50">{active.district}, {active.city}</span>
                  </div>
                </div>

                {/* OEE gauge */}
                <div className="rounded-xl border border-white/[0.06] p-4 flex items-center justify-between bg-white/[0.02]">
                  <OEEGauge value={active.kpis.oee} color={active.color} />
                  <div className="flex flex-col gap-2 flex-1 ml-3">
                    {[
                      { label: 'Availability', value: active.kpis.availability },
                      { label: 'Performance', value: active.kpis.performance },
                      { label: 'Quality', value: active.kpis.quality },
                    ].map((m) => (
                      <div key={m.label}>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-white/40 font-mono">{m.label}</span>
                          <span className="font-mono" style={{ color: active.color }}>{m.value}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${m.value}%`, background: active.color, boxShadow: `0 0 6px ${active.color}` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-2 gap-2">
                  <KPIBadge label="Production" value={active.kpis.production.toLocaleString()} unit={active.kpis.productionUnit} icon={TrendingUp} color={active.color} />
                  <KPIBadge label="Employees" value={active.kpis.employees} icon={Users} color="#a855f7" />
                  <KPIBadge label="Uptime" value={active.kpis.uptime} unit="%" icon={Zap} color="#22c55e" />
                  <KPIBadge label="Shifts Today" value={active.kpis.shiftsToday} icon={Clock} color="#f59e0b" />
                </div>

                {/* Enter button */}
                <button
                  onClick={() => handleSelect(active)}
                  className="mt-auto w-full py-3 rounded-xl font-bold text-sm tracking-wider font-mono transition-all duration-200 flex items-center justify-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${active.color}30, ${active.color}15)`,
                    border: `1px solid ${active.color}60`,
                    color: active.color,
                    boxShadow: `0 0 20px ${active.color}20`,
                  }}
                >
                  <Shield size={15} />
                  ENTER {active.code}
                  <ChevronRight size={15} />
                </button>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 rounded-xl border border-white/[0.06] p-6 bg-white/[0.01]">
                <div className="w-16 h-16 rounded-2xl border border-white/10 flex items-center justify-center">
                  <MapPin size={28} className="text-white/20" />
                </div>
                <div>
                  <div className="text-white/50 text-sm font-semibold mb-1">Select a Facility</div>
                  <div className="text-white/25 text-xs leading-relaxed">
                    Click on a factory pin on the map or choose from the list to view its KPIs
                  </div>
                </div>
                <div className="w-full space-y-2 mt-2">
                  {FACTORIES.map((f) => (
                    <div key={f.id} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.color }} />
                        <span className="text-white/40 font-mono">{f.code}</span>
                      </div>
                      <span className="text-white/25">{f.city}</span>
                      <span className="font-mono font-bold" style={{ color: f.color }}>
                        {f.kpis.oee}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-2 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[11px] text-white/20 font-mono">STAR-MES PLATFORM v1.0 — CONFIDENTIAL</span>
        <div className="flex items-center gap-4 text-[11px] text-white/20 font-mono">
          <span>5 FACILITIES</span>
          <span>•</span>
          <span>3 CITIES</span>
          <span>•</span>
          <span>KSA REGION</span>
        </div>
      </footer>
    </div>
  );
}
