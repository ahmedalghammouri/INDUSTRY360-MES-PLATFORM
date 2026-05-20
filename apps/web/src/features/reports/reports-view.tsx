'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileBarChart,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  Activity,
  Shield,
  Wrench,
  ChevronRight,
  FileText,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const REPORT_TEMPLATES = [
  {
    id: 'oee-daily',
    name: 'OEE Daily Summary',
    description: 'Overall Equipment Effectiveness metrics broken down by shift and equipment',
    category: 'Production',
    icon: TrendingUp,
    color: 'text-brand-400',
    bg: 'bg-brand-500/20',
    lastGenerated: '2 hours ago',
    schedule: 'Daily 06:00',
  },
  {
    id: 'production-shift',
    name: 'Shift Production Report',
    description: 'Actual vs target production counts, downtime events, and quality metrics per shift',
    category: 'Production',
    icon: Activity,
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    lastGenerated: '6 hours ago',
    schedule: 'Every shift',
  },
  {
    id: 'quality-ncr',
    name: 'Non-Conformance Report',
    description: 'Summary of NCRs, defect categories, Pareto analysis, and CAPA status',
    category: 'Quality',
    icon: Shield,
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    lastGenerated: '1 day ago',
    schedule: 'Weekly Monday',
  },
  {
    id: 'maintenance-pm',
    name: 'Preventive Maintenance',
    description: 'PM completion rates, upcoming schedules, MTTR and MTBF trends',
    category: 'Maintenance',
    icon: Wrench,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    lastGenerated: '3 days ago',
    schedule: 'Monthly 1st',
  },
  {
    id: 'downtime-pareto',
    name: 'Downtime Pareto Analysis',
    description: 'Top downtime causes ranked by frequency and duration with trend analysis',
    category: 'Production',
    icon: FileBarChart,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
    lastGenerated: '1 day ago',
    schedule: 'Weekly',
  },
  {
    id: 'quality-spc',
    name: 'SPC Control Charts',
    description: 'Statistical process control charts for monitored quality parameters',
    category: 'Quality',
    icon: TrendingUp,
    color: 'text-pink-400',
    bg: 'bg-pink-500/20',
    lastGenerated: '4 hours ago',
    schedule: 'Daily',
  },
];

const RECENT_REPORTS = [
  { name: 'OEE Daily Summary - 2026-05-14', size: '2.4 MB', format: 'PDF', generated: '2 hours ago', status: 'ready' },
  { name: 'Shift Production Report - Night', size: '1.1 MB', format: 'XLSX', generated: '6 hours ago', status: 'ready' },
  { name: 'NCR Summary - Week 19', size: '856 KB', format: 'PDF', generated: '1 day ago', status: 'ready' },
  { name: 'Downtime Pareto - May 2026', size: '3.2 MB', format: 'PDF', generated: '2 days ago', status: 'ready' },
];

const categories = ['All', 'Production', 'Quality', 'Maintenance'];

export function ReportsView() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [generating, setGenerating] = useState<string | null>(null);

  const filtered = REPORT_TEMPLATES.filter(
    (r) => selectedCategory === 'All' || r.category === selectedCategory,
  );

  const handleGenerate = (reportId: string) => {
    setGenerating(reportId);
    setTimeout(() => setGenerating(null), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate, schedule, and download production reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule
          </Button>
          <Button size="sm">
            <FileBarChart className="w-4 h-4 mr-2" />
            Custom Report
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Report Templates</TabsTrigger>
          <TabsTrigger value="recent">Recent Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((report, i) => {
              const Icon = report.icon;
              const isGenerating = generating === report.id;
              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card rounded-xl p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${report.bg}`}>
                      <Icon className={`w-5 h-5 ${report.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{report.name}</div>
                      <Badge variant="outline" className="text-[10px] mt-1">
                        {report.category}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {report.description}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {report.lastGenerated}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {report.schedule}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleGenerate(report.id)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? 'Generating...' : 'Generate'}
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Report Name</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Format</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Size</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Generated</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_REPORTS.map((report) => (
                  <tr key={report.name} className="border-b border-border/50 hover:bg-white/5">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {report.name}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">{report.format}</Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">{report.size}</td>
                    <td className="p-4 text-muted-foreground">{report.generated}</td>
                    <td className="p-4 text-right">
                      <Button size="sm" variant="ghost">
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <div className="font-medium">Scheduled reports coming soon</div>
            <div className="text-sm mt-1">Configure automated report generation and delivery</div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
