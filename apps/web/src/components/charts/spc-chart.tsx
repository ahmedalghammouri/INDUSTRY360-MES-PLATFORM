'use client';

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';

interface SPCChartProps {
  title?: string;
  data?: Array<{ sample: number; value: number; time: string }>;
  ucl?: number;
  lcl?: number;
  mean?: number;
  usl?: number;
  lsl?: number;
  isLoading?: boolean;
}

function generateSPCData() {
  const mean = 50;
  const stdDev = 3;
  return Array.from({ length: 30 }, (_, i) => ({
    sample: i + 1,
    value: mean + (Math.random() - 0.5) * stdDev * 4 + Math.sin(i / 5) * 2,
    time: `Sample ${i + 1}`,
  }));
}

export function SPCChart({
  title = 'Statistical Process Control (X-Bar Chart)',
  data,
  ucl = 59,
  lcl = 41,
  mean = 50,
  usl = 62,
  lsl = 38,
  isLoading,
}: SPCChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const chartData = data ?? generateSPCData();

  const option = useMemo(() => {
    const textColor = isDark ? '#ffffff50' : '#00000050';
    const gridColor = isDark ? '#ffffff10' : '#00000010';
    const values = chartData.map((d) => d.value);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params: Array<{ name: string; value: number }>) => {
          const pt = params[0];
          const isOOC = pt.value > ucl || pt.value < lcl;
          return `${pt.name}<br/>Value: <b>${pt.value.toFixed(3)}</b>${isOOC ? ' ⚠️ OOC' : ''}`;
        },
        backgroundColor: isDark ? '#1a1f2e' : '#ffffff',
        borderColor: isDark ? '#ffffff10' : '#00000010',
        textStyle: { color: isDark ? '#ffffff90' : '#000000', fontSize: 11 },
      },
      grid: { top: 36, left: 50, right: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: chartData.map((d) => d.time),
        axisLabel: { color: textColor, fontSize: 9, rotate: 30 },
        axisLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: gridColor } },
        min: Math.min(...values, lsl) - 5,
        max: Math.max(...values, usl) + 5,
      },
      series: [
        // Data line
        {
          type: 'line',
          data: values,
          lineStyle: { color: '#6175f4', width: 2 },
          symbol: 'circle',
          symbolSize: (val: number) => (val > ucl || val < lcl ? 8 : 4),
          itemStyle: {
            color: (params: { data: number }) =>
              params.data > ucl || params.data < lcl ? '#f43f5e' : '#6175f4',
          },
          smooth: false,
          markLine: {
            silent: true,
            lineStyle: { width: 1.5 },
            data: [
              { yAxis: mean, name: 'Mean', lineStyle: { color: '#22c55e', type: 'solid' } },
              { yAxis: ucl, name: 'UCL', lineStyle: { color: '#f59e0b', type: 'dashed' } },
              { yAxis: lcl, name: 'LCL', lineStyle: { color: '#f59e0b', type: 'dashed' } },
              { yAxis: usl, name: 'USL', lineStyle: { color: '#f43f5e', type: 'dotted' } },
              { yAxis: lsl, name: 'LSL', lineStyle: { color: '#f43f5e', type: 'dotted' } },
            ],
            label: {
              formatter: (p: { name: string; value: number }) => `${p.name}: ${p.value.toFixed(1)}`,
              fontSize: 9,
              color: textColor,
            },
          },
        },
      ],
    };
  }, [chartData, ucl, lcl, mean, usl, lsl, isDark]);

  return (
    <div className="industrial-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">
            UCL: {ucl} | Mean: {mean} | LCL: {lcl}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-success-400 inline-block" />Mean
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-warning-400 border-dashed inline-block" />Control Limits
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-danger-400 inline-block" />Spec Limits
          </span>
        </div>
      </div>
      {isLoading ? (
        <div className="shimmer h-48 rounded-lg" />
      ) : (
        <ReactECharts option={option} style={{ height: '200px' }} notMerge />
      )}
    </div>
  );
}
