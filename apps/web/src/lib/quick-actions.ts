import type { LucideIcon } from 'lucide-react';
import {
  SlidersHorizontal, GitCommit, ClipboardList, Layers, Monitor, AlertTriangle,
  Boxes, CalendarRange, CalendarClock, Calendar, Factory, Gauge,
  ShieldCheck, ClipboardCheck, LineChart, FlaskConical,
  Wrench, PackageSearch, Cpu, BoxesIcon, GitMerge, Workflow, GitPullRequest, MapPin,
  GitBranch, Activity, Network, Radio, Zap, BarChart3, FileText, Sparkles, Bell,
  Cog, BookOpen, Truck, Layers3,
} from 'lucide-react';

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Tailwind text color class for the glyph. */
  tone: string;
  /** Open in a new browser tab (e.g. the live shop-floor board). */
  newTab?: boolean;
}

export interface QuickActionGroup {
  /** Category label shown above the group / in the dock separator. */
  category: string;
  /** Accent color class for the category header + separator. */
  accent: string;
  icon: LucideIcon;
  actions: QuickAction[];
}

/**
 * Single source of truth for the project-wide quick actions, organised into the
 * same mental model as the sidebar. Consumed by both the Home quick-launcher grid
 * and the global macOS-style dock so they never drift apart.
 */
export const QUICK_ACTION_GROUPS: QuickActionGroup[] = [
  {
    category: 'Planning & Scheduling',
    accent: 'text-cyan-400',
    icon: CalendarRange,
    actions: [
      { label: 'General Schedule',   href: '/scheduling',                     icon: CalendarRange,  tone: 'text-cyan-400' },
      { label: 'Production Schedule', href: '/scheduling/production',          icon: Factory,        tone: 'text-sky-400' },
      { label: 'Order Scheduling',   href: '/production/scheduling',          icon: Calendar,       tone: 'text-blue-400' },
      { label: 'Reschedule Req.',    href: '/scheduling/reschedule-requests', icon: CalendarClock,  tone: 'text-indigo-400' },
      { label: 'Planned DT',         href: '/scheduling/planned-downtime',    icon: CalendarClock,  tone: 'text-amber-400' },
      { label: 'Shift Config',       href: '/production/shifts',              icon: Calendar,       tone: 'text-teal-400' },
    ],
  },
  {
    category: 'Production',
    accent: 'text-emerald-400',
    icon: Factory,
    actions: [
      { label: 'Control Panel',  href: '/manufacturing/control',        icon: SlidersHorizontal, tone: 'text-primary' },
      { label: 'New PO',         href: '/production/production-orders',  icon: GitCommit,         tone: 'text-sky-400' },
      { label: 'Work Orders',    href: '/production/orders',             icon: ClipboardList,     tone: 'text-indigo-400' },
      { label: 'Dispatch (JO)',  href: '/production/job-orders',         icon: Layers,            tone: 'text-violet-400' },
      { label: 'Shop Floor',     href: '/shop-floor',                    icon: Monitor,           tone: 'text-emerald-400', newTab: true },
      { label: 'Downtime',       href: '/production/downtime',           icon: AlertTriangle,     tone: 'text-red-400' },
      { label: 'Batches & Lots', href: '/production/batches',            icon: Boxes,             tone: 'text-blue-400' },
    ],
  },
  {
    category: 'Performance & KPIs',
    accent: 'text-fuchsia-400',
    icon: LineChart,
    actions: [
      { label: 'Production KPIs', href: '/production/kpi',     icon: Gauge,     tone: 'text-emerald-400' },
      { label: 'OEE Analytics',   href: '/production/oee',     icon: LineChart, tone: 'text-fuchsia-400' },
      { label: 'Machine KPIs',    href: '/manufacturing/kpi',  icon: Cpu,       tone: 'text-cyan-400' },
      { label: 'Machine OEE',     href: '/manufacturing/oee',  icon: Activity,  tone: 'text-violet-400' },
      { label: 'Manufacturing',   href: '/manufacturing',      icon: Cog,       tone: 'text-indigo-400' },
      { label: 'Energy',          href: '/energy',             icon: Zap,       tone: 'text-yellow-400' },
    ],
  },
  {
    category: 'Quality',
    accent: 'text-green-400',
    icon: ShieldCheck,
    actions: [
      { label: 'Quality Plans', href: '/quality/plans',       icon: ClipboardList,  tone: 'text-green-400' },
      { label: 'Inspections',   href: '/quality/inspections', icon: ClipboardCheck, tone: 'text-emerald-400' },
      { label: 'Non-Conformance', href: '/quality/ncr',       icon: AlertTriangle,  tone: 'text-red-400' },
      { label: 'CAPA',          href: '/quality/capa',        icon: ShieldCheck,    tone: 'text-teal-400' },
      { label: 'SPC Charts',    href: '/quality/spc',         icon: LineChart,      tone: 'text-sky-400' },
    ],
  },
  {
    category: 'Maintenance',
    accent: 'text-orange-400',
    icon: Wrench,
    actions: [
      { label: 'Maint. Orders', href: '/maintenance/work-orders', icon: ClipboardList, tone: 'text-orange-400' },
      { label: 'Preventive',    href: '/maintenance/preventive',  icon: Calendar,      tone: 'text-amber-400' },
      { label: 'Spare Parts',   href: '/maintenance/spare-parts', icon: PackageSearch, tone: 'text-yellow-400' },
      { label: 'Assets',        href: '/maintenance/assets',      icon: Cpu,           tone: 'text-rose-400' },
    ],
  },
  {
    category: 'Materials & PLM',
    accent: 'text-rose-400',
    icon: BookOpen,
    actions: [
      { label: 'Products',       href: '/inventory/products',       icon: BoxesIcon,      tone: 'text-blue-400' },
      { label: 'Raw Materials',  href: '/inventory/raw-materials',  icon: FlaskConical,   tone: 'text-cyan-400' },
      { label: 'Material Lots',  href: '/inventory/materials',      icon: Layers3,        tone: 'text-teal-400' },
      { label: 'Spare Requests', href: '/inventory/spare-requests', icon: Truck,          tone: 'text-amber-400' },
      { label: 'BOM',            href: '/inventory/bom',            icon: GitMerge,       tone: 'text-rose-400' },
      { label: 'Recipes',        href: '/production/recipes',       icon: FlaskConical,   tone: 'text-fuchsia-400' },
      { label: 'Processes',      href: '/production/processes',     icon: Workflow,       tone: 'text-violet-400' },
      { label: 'Change Requests',href: '/plm/change-requests',      icon: GitPullRequest, tone: 'text-pink-400' },
      { label: 'Storage',        href: '/inventory/storage-locations', icon: MapPin,      tone: 'text-lime-400' },
    ],
  },
  {
    category: 'Plant & Insights',
    accent: 'text-purple-400',
    icon: Sparkles,
    actions: [
      { label: 'Traceability',  href: '/traceability',  icon: GitBranch,   tone: 'text-lime-400' },
      { label: 'IoT Devices',   href: '/iot/devices',   icon: Cpu,         tone: 'text-sky-400' },
      { label: 'Tag Browser',   href: '/iot/tags',      icon: Network,     tone: 'text-cyan-400' },
      { label: 'Drivers',       href: '/iot/drivers',   icon: Radio,       tone: 'text-blue-400' },
      { label: 'Energy Meters', href: '/energy/meters', icon: Zap,         tone: 'text-yellow-400' },
      { label: 'Hierarchy',     href: '/hierarchy',     icon: GitBranch,   tone: 'text-emerald-400' },
      { label: 'Reports',       href: '/reports',       icon: FileText,    tone: 'text-purple-400' },
      { label: 'AI Insights',   href: '/ai',            icon: Sparkles,    tone: 'text-pink-400' },
      { label: 'Notifications', href: '/notifications', icon: Bell,        tone: 'text-orange-400' },
    ],
  },
];

/** Flat list of every quick action (handy for search / counts). */
export const QUICK_ACTIONS: QuickAction[] = QUICK_ACTION_GROUPS.flatMap((g) => g.actions);
