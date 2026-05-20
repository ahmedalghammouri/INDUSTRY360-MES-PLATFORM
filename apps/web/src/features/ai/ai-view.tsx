'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Zap,
  ChevronRight,
  Sparkles,
  Target,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const AI_INSIGHTS = [
  {
    id: '1',
    type: 'anomaly',
    severity: 'high',
    title: 'Mixer M-101 bearing vibration anomaly detected',
    description: 'Vibration pattern deviates 2.3σ from baseline. Predictive model indicates 78% probability of bearing failure within 5-7 days.',
    recommendation: 'Schedule preventive bearing replacement during next planned shutdown.',
    confidence: 92,
    impact: 'Prevents ~4.5h unplanned downtime',
    equipmentId: 'M-101',
    detectedAt: '35 minutes ago',
  },
  {
    id: '2',
    type: 'optimization',
    severity: 'medium',
    title: 'OEE improvement opportunity on Filling Line 01',
    description: 'Changeover time analysis shows 18% reduction possible by reordering SKU sequence based on container size.',
    recommendation: 'Implement optimized production sequence for tomorrow\'s shift.',
    confidence: 87,
    impact: '+3.2% OEE improvement, +145 units/shift',
    equipmentId: 'F-301',
    detectedAt: '2 hours ago',
  },
  {
    id: '3',
    type: 'prediction',
    severity: 'low',
    title: 'Quality drift predicted on Packaging Line',
    description: 'Seal temperature trending toward lower control limit. Model predicts UCL breach within 2 shifts at current trajectory.',
    recommendation: 'Calibrate heat seal temperature controller before next shift.',
    confidence: 74,
    impact: 'Prevents potential NCR and 200+ unit rework',
    equipmentId: 'W-501',
    detectedAt: '1 hour ago',
  },
  {
    id: '4',
    type: 'energy',
    severity: 'low',
    title: 'Energy consumption optimization identified',
    description: 'Compressed air system shows 12% overconsumption vs benchmark. Likely cause: leak in Zone B distribution line.',
    recommendation: 'Perform leak detection survey in Mixing Area Zone B.',
    confidence: 81,
    impact: 'SAR 3,200/month energy savings',
    equipmentId: 'Utility',
    detectedAt: '4 hours ago',
  },
];

const typeConfig = {
  anomaly: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Anomaly' },
  optimization: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Optimization' },
  prediction: { icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Prediction' },
  energy: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Energy' },
};

const severityColors = {
  high: 'text-red-400 border-red-500/30 bg-red-500/10',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  low: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
};

const AI_METRICS = [
  { label: 'Insights Generated', value: '47', sub: 'This week', icon: Brain, color: 'text-brand-400' },
  { label: 'Anomalies Detected', value: '3', sub: 'Active', icon: AlertTriangle, color: 'text-red-400' },
  { label: 'OEE Improvement', value: '+4.2%', sub: 'Via AI recommendations', icon: TrendingUp, color: 'text-green-400' },
  { label: 'Avg. Confidence', value: '83%', sub: 'Model accuracy', icon: Target, color: 'text-purple-400' },
];

export function AIView() {
  const [activeInsight, setActiveInsight] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-400" />
            AI Intelligence
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Predictive analytics, anomaly detection, and optimization recommendations
          </p>
        </div>
        <Button size="sm">
          <Brain className="w-4 h-4 mr-2" />
          Run Analysis
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {AI_METRICS.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                  <Icon className={cn('w-4 h-4', metric.color)} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <div className="text-[11px] text-muted-foreground">{metric.sub}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{metric.label}</div>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">Active Insights</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="models">ML Models</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-4 space-y-3">
          <AnimatedInsights insights={AI_INSIGHTS} activeInsight={activeInsight} setActiveInsight={setActiveInsight} />
        </TabsContent>

        <TabsContent value="predictions" className="mt-4">
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-400" />
              Equipment Health Forecast — Next 7 Days
            </h3>
            <div className="space-y-3">
              {[
                { name: 'Mixer M-101', health: 62, trend: 'declining', risk: 'High' },
                { name: 'Filler F-301', health: 88, trend: 'stable', risk: 'Low' },
                { name: 'Blender B-201', health: 79, trend: 'stable', risk: 'Low' },
                { name: 'Wrapper W-501', health: 71, trend: 'declining', risk: 'Medium' },
                { name: 'Palletizer P-502', health: 94, trend: 'improving', risk: 'Low' },
              ].map((eq) => (
                <div key={eq.name} className="flex items-center gap-4">
                  <div className="w-36 text-sm">{eq.name}</div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          eq.health >= 80 ? 'bg-green-500' : eq.health >= 60 ? 'bg-amber-500' : 'bg-red-500',
                        )}
                        style={{ width: `${eq.health}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right text-sm font-mono">{eq.health}%</div>
                  <Badge
                    className={cn(
                      'text-[10px] w-16 justify-center',
                      eq.risk === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      eq.risk === 'Medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-green-500/20 text-green-400 border-green-500/30',
                    )}
                  >
                    {eq.risk}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="models" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Predictive Maintenance Model', type: 'Time-series LSTM', accuracy: 94.2, lastTrained: '3 days ago', status: 'active' },
              { name: 'Quality Anomaly Detector', type: 'Isolation Forest', accuracy: 87.8, lastTrained: '1 week ago', status: 'active' },
              { name: 'OEE Optimizer', type: 'Reinforcement Learning', accuracy: 82.1, lastTrained: '2 weeks ago', status: 'training' },
              { name: 'Demand Forecasting', type: 'Prophet + XGBoost', accuracy: 91.5, lastTrained: '5 days ago', status: 'active' },
            ].map((model, i) => (
              <motion.div
                key={model.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium text-sm">{model.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{model.type}</div>
                  </div>
                  <Badge
                    className={cn(
                      'text-[10px]',
                      model.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                    )}
                  >
                    {model.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Accuracy: <span className="text-foreground font-medium">{model.accuracy}%</span></span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Trained {model.lastTrained}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnimatedInsights({
  insights,
  activeInsight,
  setActiveInsight,
}: {
  insights: typeof AI_INSIGHTS;
  activeInsight: string | null;
  setActiveInsight: (id: string | null) => void;
}) {
  return (
    <>
      {insights.map((insight, i) => {
        const cfg = typeConfig[insight.type as keyof typeof typeConfig];
        const Icon = cfg.icon;
        const isActive = activeInsight === insight.id;
        return (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              'glass-card rounded-xl overflow-hidden cursor-pointer transition-all',
              isActive ? 'ring-1 ring-brand-500' : 'hover:ring-1 hover:ring-white/20',
            )}
            onClick={() => setActiveInsight(isActive ? null : insight.id)}
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
                  <Icon className={cn('w-5 h-5', cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium text-sm leading-snug">{insight.title}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={cn('text-[10px]', severityColors[insight.severity as keyof typeof severityColors])}>
                        {insight.severity}
                      </Badge>
                      <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', isActive && 'rotate-90')} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                    <span>{insight.equipmentId}</span>
                    <span>{insight.detectedAt}</span>
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {insight.confidence}% confidence
                    </span>
                  </div>
                </div>
              </div>

              {isActive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-border/50 space-y-3"
                >
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Analysis</div>
                    <p className="text-sm leading-relaxed">{insight.description}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        Recommendation
                      </div>
                      <p className="text-sm text-brand-300">{insight.recommendation}</p>
                    </div>
                    <div className="shrink-0">
                      <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Expected Impact
                      </div>
                      <p className="text-sm text-green-400">{insight.impact}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm">Accept & Schedule</Button>
                    <Button size="sm" variant="outline">Dismiss</Button>
                    <Button size="sm" variant="ghost">View Details</Button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        );
      })}
    </>
  );
}
