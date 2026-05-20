'use client';

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';

interface MTTRMTBFChartProps {
  isLoading?: boolean;
}

export function MTTRMTBFChart({ isLoading }: MTTRMTBFChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const mockData = [
    { month: 'Jan', mttr: 4.2, mtbf: 480 },
    { month: 'Feb', mttr: 3.8, mtbf: 520 },
    { month: 'Mar', mttr: 5.1, mtbf: 440 },
    { month: 'Apr', mttr: 3.5, mtbf: 560 },
    { month: 'May', mttr: 2.9, mtbf: 610 },
    { month: 'Jun', mttr: 3.2, mtbf: 590 },
  ];

  const option = useMemo(() => {
    const textColor = isDark ? '#ffffff50' : '#00000050';
    const gridColor = isDark ? '#ffffff10' : '#00000010';

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: isDark ? '#1a1f2e' : '#ffffff',
        borderColor: isDark ? '#ffffff10' : '#00000010',
        textStyle: { color: isDark ? '#ffffff90' : '#000000', fontSize: 11 },
      },
      legend: {
        data: ['MTTR (hours)', 'MTBF (hours)'],
        textStyle: { color: textColor, fontSize: 10 },
        right: 0, top: 0,
        icon: 'circle',
        itemWidth: 8, itemHeight: 8,
      },
      grid: { top: 36, left: 10, right: 50, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: mockData.map((d) => d.month),
        axisLabel: { color: textColor, fontSize: 10 },
        axisLine: { lineStyle: { color: gridColor } },
      },
      yAxis: [
        {
          type: 'value',
          name: 'MTTR (h)',
          nameTextStyle: { color: textColor, fontSize: 10 },
          axisLabel: { color: textColor, fontSize: 10 },
          splitLine: { lineStyle: { color: gridColor } },
          axisLine: { show: false },
        },
        {
          type: 'value',
          name: 'MTBF (h)',
          nameTextStyle: { color: textColor, fontSize: 10 },
          axisLabel: { color: textColor, fontSize: 10 },
          splitLine: { show: false },
          axisLine: { show: false },
        },
      ],
      series: [
        {
          name: 'MTTR (hours)',
          type: 'bar',
          data: mockData.map((d) => d.mttr),
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: '#f43f5e' }, { offset: 1, color: '#f43f5e40' }] },
            borderRadius: [3, 3, 0, 0],
          },
          barMaxWidth: 28,
        },
        {
          name: 'MTBF (hours)',
          type: 'line',
          yAxisIndex: 1,
          data: mockData.map((d) => d.mtbf),
          lineStyle: { color: '#22c55e', width: 2 },
          symbol: 'circle',
          symbolSize: 5,
          smooth: true,
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: '#22c55e20' }, { offset: 1, color: 'transparent' }] },
          },
        },
      ],
    };
  }, [isDark]);

  return (
    <div className="industrial-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">MTTR & MTBF Trends</h3>
        <p className="text-xs text-muted-foreground">Mean Time to Repair vs Mean Time Between Failures</p>
      </div>
      {isLoading ? (
        <div className="shimmer h-40 rounded-lg" />
      ) : (
        <ReactECharts option={option} style={{ height: '160px' }} notMerge />
      )}
    </div>
  );
}
