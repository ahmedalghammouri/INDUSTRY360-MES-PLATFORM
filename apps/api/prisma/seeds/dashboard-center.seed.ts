// ============================================================
// STAR-MES — Dashboard Center seed
// Seeds system categories + a built-in catalog that points at the
// existing STAR-MES module dashboards/analytics/reports, plus a few
// Grafana dashboard templates. Fully idempotent (slug-keyed upserts).
// ============================================================

import { PrismaClient, DashboardSource, DashboardType, DashboardVisibility } from '@prisma/client';

interface CategorySeed {
  key: string; name: string; icon: string; color: string; sortOrder: number;
}

interface DashboardSeed {
  slug: string;
  title: string;
  description: string;
  source: DashboardSource;
  type: DashboardType;
  categoryKey: string;
  icon: string;
  route?: string;
  grafanaUid?: string;
  grafanaSlug?: string;
  externalUrl?: string;
  tags: string[];
  isTemplate?: boolean;
  supportedScopes?: string[];
  visibility?: DashboardVisibility;
}

const CATEGORIES: CategorySeed[] = [
  { key: 'overview',     name: 'Overview',      icon: 'LayoutDashboard', color: '#6175f4', sortOrder: 1 },
  { key: 'production',   name: 'Production',    icon: 'Factory',         color: '#22c55e', sortOrder: 2 },
  { key: 'manufacturing',name: 'Manufacturing', icon: 'Cog',             color: '#14b8a6', sortOrder: 3 },
  { key: 'quality',      name: 'Quality',       icon: 'ShieldCheck',     color: '#a855f7', sortOrder: 4 },
  { key: 'maintenance',  name: 'Maintenance',   icon: 'Wrench',          color: '#f59e0b', sortOrder: 5 },
  { key: 'energy',       name: 'Energy',        icon: 'Zap',             color: '#eab308', sortOrder: 6 },
  { key: 'inventory',    name: 'Inventory',     icon: 'Package',         color: '#0ea5e9', sortOrder: 7 },
  { key: 'reports',      name: 'Reports',       icon: 'FileText',        color: '#64748b', sortOrder: 8 },
  { key: 'analytics',    name: 'Analytics',     icon: 'BarChart3',       color: '#ec4899', sortOrder: 9 },
];

const NATIVE: DashboardSeed[] = [
  // Overview
  { slug: 'operations-overview', title: 'Operations Overview', description: 'Real-time plant operations, OEE, machines and alarms.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.OPERATIONAL, categoryKey: 'overview', icon: 'LayoutDashboard', route: '/dashboard', tags: ['oee', 'realtime', 'operations'] },
  { slug: 'ai-intelligence', title: 'AI Intelligence', description: 'Rule-based insights, anomaly detection, equipment health.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.ANALYTICS, categoryKey: 'analytics', icon: 'Sparkles', route: '/ai', tags: ['ai', 'insights', 'predictive'] },

  // Production
  { slug: 'production-overview', title: 'Production Overview', description: 'Work orders, batches and OEE monitoring.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', route: '/production', tags: ['production', 'work-orders'] },
  { slug: 'production-kpi', title: 'Production KPI Analytics', description: 'Production KPIs and trends.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.KPI, categoryKey: 'production', icon: 'TrendingUp', route: '/production/kpi', tags: ['kpi', 'production'] },
  { slug: 'production-oee', title: 'OEE Analytics', description: 'Availability, performance and quality breakdown.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.ANALYTICS, categoryKey: 'production', icon: 'LineChart', route: '/production/oee', tags: ['oee', 'analytics'] },
  { slug: 'production-downtime', title: 'Downtime Analytics', description: 'Downtime Pareto and loss analysis.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.ANALYTICS, categoryKey: 'production', icon: 'AlertTriangle', route: '/production/downtime', tags: ['downtime', 'losses'] },

  // Manufacturing
  { slug: 'manufacturing-overview', title: 'Manufacturing Overview', description: 'Execution, dispatch and shop-floor status.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.OPERATIONAL, categoryKey: 'manufacturing', icon: 'Cog', route: '/manufacturing', tags: ['mrp', 'execution'] },
  { slug: 'manufacturing-oee', title: 'Manufacturing OEE', description: 'OEE analytics for the execution layer.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.ANALYTICS, categoryKey: 'manufacturing', icon: 'LineChart', route: '/manufacturing/oee', tags: ['oee'] },

  // Quality
  { slug: 'quality-overview', title: 'Quality Overview', description: 'Inspections, NCR, CAPA and SPC.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.QUALITY, categoryKey: 'quality', icon: 'ShieldCheck', route: '/quality', tags: ['quality', 'spc', 'ncr'] },
  { slug: 'quality-spc', title: 'SPC Charts', description: 'Statistical process control charts.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.ANALYTICS, categoryKey: 'quality', icon: 'LineChart', route: '/quality/spc', tags: ['spc', 'control'] },

  // Maintenance
  { slug: 'maintenance-overview', title: 'Maintenance Overview', description: 'Work orders, MTTR/MTBF and PM compliance.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.MAINTENANCE, categoryKey: 'maintenance', icon: 'Wrench', route: '/maintenance', tags: ['maintenance', 'mttr', 'mtbf'] },

  // Energy
  { slug: 'energy-overview', title: 'Energy Overview', description: 'Consumption, cost and waste analysis.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.ENERGY, categoryKey: 'energy', icon: 'Zap', route: '/energy', tags: ['energy', 'kwh', 'cost'] },

  // Inventory
  { slug: 'inventory-overview', title: 'Inventory Overview', description: 'Stock, spare parts and storage.', source: DashboardSource.STAR_MES_NATIVE, type: DashboardType.OPERATIONAL, categoryKey: 'inventory', icon: 'Package', route: '/inventory', tags: ['inventory', 'stock'] },

  // Reports
  { slug: 'report-production', title: 'Production Report', description: 'Production reporting & exports.', source: DashboardSource.REPORT, type: DashboardType.REPORT, categoryKey: 'reports', icon: 'Factory', route: '/reports/production', tags: ['report', 'production'] },
  { slug: 'report-quality', title: 'Quality Report', description: 'Quality reporting & exports.', source: DashboardSource.REPORT, type: DashboardType.REPORT, categoryKey: 'reports', icon: 'ShieldCheck', route: '/reports/quality', tags: ['report', 'quality'] },
  { slug: 'report-maintenance', title: 'Maintenance Report', description: 'Maintenance reporting & exports.', source: DashboardSource.REPORT, type: DashboardType.REPORT, categoryKey: 'reports', icon: 'Wrench', route: '/reports/maintenance', tags: ['report', 'maintenance'] },
];

// Grafana templates — disabled (isPublished=false) until a real Grafana UID is mapped.
// They appear under Templates and become live once an admin sets the grafanaUid.
const GRAFANA_TEMPLATES: DashboardSeed[] = [
  { slug: 'tpl-plant-executive', title: 'Plant Executive (Grafana)', description: 'Executive KPI rollup template — map to a Grafana dashboard UID to activate.', source: DashboardSource.GRAFANA, type: DashboardType.EXECUTIVE, categoryKey: 'overview', icon: 'BarChart3', grafanaUid: '', grafanaSlug: 'plant-executive', tags: ['grafana', 'executive', 'template'], isTemplate: true, supportedScopes: ['FACTORY', 'AREA', 'LINE', 'SHIFT'] },
  { slug: 'tpl-line-performance', title: 'Line Performance (Grafana)', description: 'Per-line OEE/throughput template.', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Activity', grafanaUid: '', grafanaSlug: 'line-performance', tags: ['grafana', 'oee', 'template'], isTemplate: true, supportedScopes: ['FACTORY', 'LINE', 'MACHINE', 'SHIFT', 'PRODUCT'] },
  { slug: 'tpl-energy-monitoring', title: 'Energy Monitoring (Grafana)', description: 'Real-time energy/power template.', source: DashboardSource.GRAFANA, type: DashboardType.ENERGY, categoryKey: 'energy', icon: 'Zap', grafanaUid: '', grafanaSlug: 'energy-monitoring', tags: ['grafana', 'energy', 'template'], isTemplate: true, supportedScopes: ['FACTORY', 'AREA', 'MACHINE'] },
];

export async function seedDashboardCenter(prisma: PrismaClient) {
  // 1. Categories (global / enterprise-wide → factoryId null).
  // Use findFirst (not composite upsert) because the unique includes a nullable
  // factoryId, which Postgres treats as distinct → not reliably idempotent.
  const catIdByKey = new Map<string, string>();
  for (const c of CATEGORIES) {
    const existing = await prisma.dashboardCategory.findFirst({
      where: { factoryId: null, key: c.key },
    });
    const cat = existing
      ? await prisma.dashboardCategory.update({
          where: { id: existing.id },
          data: { name: c.name, icon: c.icon, color: c.color, sortOrder: c.sortOrder, isSystem: true },
        })
      : await prisma.dashboardCategory.create({
          data: { factoryId: null, key: c.key, name: c.name, icon: c.icon, color: c.color, sortOrder: c.sortOrder, isSystem: true },
        });
    catIdByKey.set(c.key, cat.id);
  }

  // 2. Built-in dashboards — keyed by slug, global (factoryId null), system, published.
  const all = [...NATIVE, ...GRAFANA_TEMPLATES];
  let created = 0;
  for (const d of all) {
    const existing = await prisma.dashboard.findFirst({ where: { slug: d.slug, isSystem: true } });
    const data = {
      factoryId: null,
      categoryId: catIdByKey.get(d.categoryKey) ?? null,
      slug: d.slug,
      title: d.title,
      description: d.description,
      source: d.source,
      type: d.type,
      visibility: d.visibility ?? DashboardVisibility.PUBLIC,
      route: d.route ?? null,
      externalUrl: d.externalUrl ?? null,
      grafanaUid: d.grafanaUid || null,
      grafanaSlug: d.grafanaSlug ?? null,
      icon: d.icon,
      tags: d.tags,
      isFactoryAware: true,
      supportedScopes: d.supportedScopes ?? ['FACTORY'],
      isTemplate: d.isTemplate ?? false,
      // Grafana entries without a UID are parked as unpublished until mapped.
      isPublished: d.source === DashboardSource.GRAFANA ? !!d.grafanaUid : true,
      isSystem: true,
    };
    if (existing) {
      await prisma.dashboard.update({ where: { id: existing.id }, data });
    } else {
      await prisma.dashboard.create({ data });
      created++;
    }
  }

  console.log(`  📊 Dashboard Center: ${CATEGORIES.length} categories, ${all.length} catalog entries (${created} new)`);
}
