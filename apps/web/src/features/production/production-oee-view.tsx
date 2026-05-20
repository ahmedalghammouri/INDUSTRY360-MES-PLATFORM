'use client';

import React from 'react';
import { Download, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/widgets/kpi-card';
import { OEEGauge } from '@/components/charts/oee-gauge';
import { api } from '@/services/api.client';

export function ProductionOEEView() {
  const { data: oeeData, isLoading } = useQuery({
    queryKey: ['production', 'oee'],
    queryFn: () => api.get<{
      current: { oee: number; availability: number; performance: number; quality: number };
      trend: { period: string; oee: number }[];
      byEquipment: { name: string; oee: number; availability: number; performance: number; quality: number }[];
    }>('/production/oee/calculate'),
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold">OEE Analysis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overall Equipment Effectiveness monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <RefreshCw size={13} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Download size={13} />
            Export
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard 
            title="OEE" 
            value={oeeData?.current.oee ?? 0} 
            unit="%" 
            target={85} 
            colorMode="oee" 
            isLoading={isLoading} 
          />
          <KPICard 
            title="Availability" 
            value={oeeData?.current.availability ?? 0} 
            unit="%" 
            colorMode="default" 
            isLoading={isLoading} 
          />
          <KPICard 
            title="Performance" 
            value={oeeData?.current.performance ?? 0} 
            unit="%" 
            colorMode="default" 
            isLoading={isLoading} 
          />
          <KPICard 
            title="Quality" 
            value={oeeData?.current.quality ?? 0} 
            unit="%" 
            colorMode="default" 
            isLoading={isLoading} 
          />
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-6">
            <OEEGauge
              oee={oeeData?.current.oee ?? 0}
              availability={oeeData?.current.availability ?? 0}
              performance={oeeData?.current.performance ?? 0}
              quality={oeeData?.current.quality ?? 0}
              isLoading={isLoading}
            />
          </div>

          <div className="col-span-12 lg:col-span-6">
            <div className="industrial-card p-4 h-full">
              <h3 className="text-sm font-semibold mb-4">OEE by Equipment</h3>
              <div className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="shimmer h-16 rounded" />
                  ))
                ) : (
                  oeeData?.byEquipment.map((eq) => (
                    <div key={eq.name} className="p-3 rounded-lg border border-border/30 hover:bg-muted/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">{eq.name}</span>
                        <span className="text-sm font-bold text-primary">{eq.oee.toFixed(1)}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div>
                          <span className="text-muted-foreground">Avail:</span>
                          <span className="ml-1 font-semibold">{eq.availability.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Perf:</span>
                          <span className="ml-1 font-semibold">{eq.performance.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Qual:</span>
                          <span className="ml-1 font-semibold">{eq.quality.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
