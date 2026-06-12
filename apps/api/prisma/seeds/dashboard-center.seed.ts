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
  { key: 'iiot',         name: 'IIoT & Devices', icon: 'Cpu',            color: '#06b6d4', sortOrder: 10 },
  { key: 'traceability', name: 'Traceability',  icon: 'GitBranch',       color: '#f97316', sortOrder: 11 },
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

// Grafana dashboards — the provisioned STAR-MES Grafana suite (grafana/dashboards/*,
// generate.mjs is source of truth). Cataloged by real UID so they are published and
// launchable from the Dashboard Center. Folder → category; tags carried from the JSON.
const GRAFANA_DASHBOARDS: DashboardSeed[] = [
  { slug: 'gf-mes-energy-air', title: 'Compressed Air', description: 'Compressed Air (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.ENERGY, categoryKey: 'energy', icon: 'Zap', grafanaUid: 'mes-energy-air', grafanaSlug: 'mes-energy-air', tags: ['star-mes', 'energy', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-energy-cost', title: 'Utility Cost Analysis', description: 'Utility Cost Analysis (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.ENERGY, categoryKey: 'energy', icon: 'Zap', grafanaUid: 'mes-energy-cost', grafanaSlug: 'mes-energy-cost', tags: ['star-mes', 'energy', 'cost', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-energy-electricity', title: 'Electricity Monitoring', description: 'Electricity Monitoring (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.ENERGY, categoryKey: 'energy', icon: 'Zap', grafanaUid: 'mes-energy-electricity', grafanaSlug: 'mes-energy-electricity', tags: ['star-mes', 'energy', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-energy-overview', title: 'Energy Overview', description: 'Energy Overview (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.ENERGY, categoryKey: 'energy', icon: 'Zap', grafanaUid: 'mes-energy-overview', grafanaSlug: 'mes-energy-overview', tags: ['star-mes', 'energy', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-energy-water', title: 'Water Monitoring', description: 'Water Monitoring (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.ENERGY, categoryKey: 'energy', icon: 'Zap', grafanaUid: 'mes-energy-water', grafanaSlug: 'mes-energy-water', tags: ['star-mes', 'energy', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-exec-cockpit', title: 'Executive Manufacturing Cockpit', description: 'Executive Manufacturing Cockpit (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.EXECUTIVE, categoryKey: 'overview', icon: 'BarChart3', grafanaUid: 'mes-exec-cockpit', grafanaSlug: 'mes-exec-cockpit', tags: ['star-mes', 'executive', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-exec-corporate-kpi', title: 'Corporate KPI Dashboard', description: 'Corporate KPI Dashboard (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.EXECUTIVE, categoryKey: 'overview', icon: 'BarChart3', grafanaUid: 'mes-exec-corporate-kpi', grafanaSlug: 'mes-exec-corporate-kpi', tags: ['star-mes', 'executive', 'kpi', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-exec-factory-compare', title: 'Factory Comparison', description: 'Factory Comparison (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.EXECUTIVE, categoryKey: 'overview', icon: 'BarChart3', grafanaUid: 'mes-exec-factory-compare', grafanaSlug: 'mes-exec-factory-compare', tags: ['star-mes', 'executive', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-exec-multiplant', title: 'Multi-Plant Performance', description: 'Multi-Plant Performance (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.EXECUTIVE, categoryKey: 'overview', icon: 'BarChart3', grafanaUid: 'mes-exec-multiplant', grafanaSlug: 'mes-exec-multiplant', tags: ['star-mes', 'executive', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-iiot-device-health', title: 'Device Health', description: 'Device Health (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'iiot', icon: 'Cpu', grafanaUid: 'mes-iiot-device-health', grafanaSlug: 'mes-iiot-device-health', tags: ['star-mes', 'iiot', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-iiot-gateway', title: 'Gateway Status', description: 'Gateway Status (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'iiot', icon: 'Cpu', grafanaUid: 'mes-iiot-gateway', grafanaSlug: 'mes-iiot-gateway', tags: ['star-mes', 'iiot', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-iiot-mqtt', title: 'MQTT Monitoring', description: 'MQTT Monitoring (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'iiot', icon: 'Cpu', grafanaUid: 'mes-iiot-mqtt', grafanaSlug: 'mes-iiot-mqtt', tags: ['star-mes', 'iiot', 'mqtt', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-iiot-sensor', title: 'Sensor Analytics', description: 'Sensor Analytics (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'iiot', icon: 'Cpu', grafanaUid: 'mes-iiot-sensor', grafanaSlug: 'mes-iiot-sensor', tags: ['star-mes', 'iiot', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-inv-lots', title: 'Material Lots', description: 'Material Lots (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'inventory', icon: 'Package', grafanaUid: 'mes-inv-lots', grafanaSlug: 'mes-inv-lots', tags: ['star-mes', 'inventory', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-inv-movement', title: 'Stock Movement', description: 'Stock Movement (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'inventory', icon: 'Package', grafanaUid: 'mes-inv-movement', grafanaSlug: 'mes-inv-movement', tags: ['star-mes', 'inventory', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-inv-overview', title: 'Inventory Overview', description: 'Inventory Overview (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'inventory', icon: 'Package', grafanaUid: 'mes-inv-overview', grafanaSlug: 'mes-inv-overview', tags: ['star-mes', 'inventory', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-inv-raw', title: 'Raw Materials', description: 'Raw Materials (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'inventory', icon: 'Package', grafanaUid: 'mes-inv-raw', grafanaSlug: 'mes-inv-raw', tags: ['star-mes', 'inventory', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-inv-spares', title: 'Spare Parts', description: 'Spare Parts (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'inventory', icon: 'Package', grafanaUid: 'mes-inv-spares', grafanaSlug: 'mes-inv-spares', tags: ['star-mes', 'inventory', 'maintenance', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-inv-turnover', title: 'Inventory Turnover', description: 'Inventory Turnover (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'inventory', icon: 'Package', grafanaUid: 'mes-inv-turnover', grafanaSlug: 'mes-inv-turnover', tags: ['star-mes', 'inventory', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-maint-asset-health', title: 'Asset Health', description: 'Asset Health (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.MAINTENANCE, categoryKey: 'maintenance', icon: 'Wrench', grafanaUid: 'mes-maint-asset-health', grafanaSlug: 'mes-maint-asset-health', tags: ['star-mes', 'maintenance', 'asset', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-maint-kpi', title: 'Maintenance KPI Dashboard', description: 'Maintenance KPI Dashboard (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.MAINTENANCE, categoryKey: 'maintenance', icon: 'Wrench', grafanaUid: 'mes-maint-kpi', grafanaSlug: 'mes-maint-kpi', tags: ['star-mes', 'maintenance', 'kpi', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-maint-mtbf', title: 'MTBF', description: 'MTBF (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.MAINTENANCE, categoryKey: 'maintenance', icon: 'Wrench', grafanaUid: 'mes-maint-mtbf', grafanaSlug: 'mes-maint-mtbf', tags: ['star-mes', 'maintenance', 'reliability', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-maint-mttr', title: 'MTTR', description: 'MTTR (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.MAINTENANCE, categoryKey: 'maintenance', icon: 'Wrench', grafanaUid: 'mes-maint-mttr', grafanaSlug: 'mes-maint-mttr', tags: ['star-mes', 'maintenance', 'reliability', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-maint-overview', title: 'Maintenance Overview', description: 'Maintenance Overview (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.MAINTENANCE, categoryKey: 'maintenance', icon: 'Wrench', grafanaUid: 'mes-maint-overview', grafanaSlug: 'mes-maint-overview', tags: ['star-mes', 'maintenance', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-maint-pm', title: 'Preventive Maintenance', description: 'Preventive Maintenance (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.MAINTENANCE, categoryKey: 'maintenance', icon: 'Wrench', grafanaUid: 'mes-maint-pm', grafanaSlug: 'mes-maint-pm', tags: ['star-mes', 'maintenance', 'pm', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-maint-spares', title: 'Spare Parts Analytics', description: 'Spare Parts Analytics (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.MAINTENANCE, categoryKey: 'maintenance', icon: 'Wrench', grafanaUid: 'mes-maint-spares', grafanaSlug: 'mes-maint-spares', tags: ['star-mes', 'maintenance', 'inventory', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-maint-wo', title: 'Work Orders', description: 'Work Orders (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.MAINTENANCE, categoryKey: 'maintenance', icon: 'Wrench', grafanaUid: 'mes-maint-wo', grafanaSlug: 'mes-maint-wo', tags: ['star-mes', 'maintenance', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-mfg-dispatch', title: 'Dispatch List Monitoring', description: 'Dispatch List Monitoring (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'manufacturing', icon: 'Cog', grafanaUid: 'mes-mfg-dispatch', grafanaSlug: 'mes-mfg-dispatch', tags: ['star-mes', 'manufacturing', 'isa95', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-mfg-overview', title: 'Manufacturing Overview', description: 'Manufacturing Overview (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'manufacturing', icon: 'Cog', grafanaUid: 'mes-mfg-overview', grafanaSlug: 'mes-mfg-overview', tags: ['star-mes', 'manufacturing', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-mfg-process-perf', title: 'Process Performance', description: 'Process Performance (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'manufacturing', icon: 'Cog', grafanaUid: 'mes-mfg-process-perf', grafanaSlug: 'mes-mfg-process-perf', tags: ['star-mes', 'manufacturing', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-mfg-recipe', title: 'Recipe Execution', description: 'Recipe Execution (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'manufacturing', icon: 'Cog', grafanaUid: 'mes-mfg-recipe', grafanaSlug: 'mes-mfg-recipe', tags: ['star-mes', 'manufacturing', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-mfg-shopfloor', title: 'Shopfloor Live', description: 'Shopfloor Live (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'manufacturing', icon: 'Cog', grafanaUid: 'mes-mfg-shopfloor', grafanaSlug: 'mes-mfg-shopfloor', tags: ['star-mes', 'manufacturing', 'live', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-mfg-wo-status', title: 'Work Order Status', description: 'Work Order Status (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'manufacturing', icon: 'Cog', grafanaUid: 'mes-mfg-wo-status', grafanaSlug: 'mes-mfg-wo-status', tags: ['star-mes', 'manufacturing', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-dt-heatmap', title: 'Downtime Heatmap', description: 'Downtime Heatmap (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-dt-heatmap', grafanaSlug: 'mes-dt-heatmap', tags: ['star-mes', 'downtime', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-dt-overview', title: 'Downtime Overview', description: 'Downtime Overview (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-dt-overview', grafanaSlug: 'mes-dt-overview', tags: ['star-mes', 'downtime', 'production', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-dt-pareto', title: 'Downtime Pareto', description: 'Downtime Pareto (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-dt-pareto', grafanaSlug: 'mes-dt-pareto', tags: ['star-mes', 'downtime', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-dt-rca', title: 'Root Cause Analysis', description: 'Root Cause Analysis (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-dt-rca', grafanaSlug: 'mes-dt-rca', tags: ['star-mes', 'downtime', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-mtbf', title: 'MTBF Analytics', description: 'MTBF Analytics (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-mtbf', grafanaSlug: 'mes-mtbf', tags: ['star-mes', 'downtime', 'reliability', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-mttr', title: 'MTTR Analytics', description: 'MTTR Analytics (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-mttr', grafanaSlug: 'mes-mttr', tags: ['star-mes', 'downtime', 'reliability', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-oee-executive', title: 'OEE Executive', description: 'OEE Executive (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-oee-executive', grafanaSlug: 'mes-oee-executive', tags: ['star-mes', 'oee', 'production', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-oee-factory', title: 'OEE by Factory', description: 'OEE by Factory (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-oee-factory', grafanaSlug: 'mes-oee-factory', tags: ['star-mes', 'oee', 'production', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-oee-line', title: 'OEE by Line', description: 'OEE by Line (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-oee-line', grafanaSlug: 'mes-oee-line', tags: ['star-mes', 'oee', 'production', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-oee-machine', title: 'OEE by Machine', description: 'OEE by Machine (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-oee-machine', grafanaSlug: 'mes-oee-machine', tags: ['star-mes', 'oee', 'production', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-oee-trend', title: 'OEE Trend Analysis', description: 'OEE Trend Analysis (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-oee-trend', grafanaSlug: 'mes-oee-trend', tags: ['star-mes', 'oee', 'production', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-prod-batch', title: 'Batch Performance', description: 'Batch Performance (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-prod-batch', grafanaSlug: 'mes-prod-batch', tags: ['star-mes', 'production', 'batch', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-prod-kpi', title: 'Production KPI Dashboard', description: 'Production KPI Dashboard (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-prod-kpi', grafanaSlug: 'mes-prod-kpi', tags: ['star-mes', 'production', 'kpi', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-prod-orders', title: 'Production Orders', description: 'Production Orders (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-prod-orders', grafanaSlug: 'mes-prod-orders', tags: ['star-mes', 'production', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-prod-overview', title: 'Production Overview', description: 'Production Overview (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-prod-overview', grafanaSlug: 'mes-prod-overview', tags: ['star-mes', 'production', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-prod-scheduling', title: 'Production Scheduling', description: 'Production Scheduling (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-prod-scheduling', grafanaSlug: 'mes-prod-scheduling', tags: ['star-mes', 'production', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-prod-scrap', title: 'Scrap Analysis', description: 'Scrap Analysis (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-prod-scrap', grafanaSlug: 'mes-prod-scrap', tags: ['star-mes', 'production', 'quality', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-prod-shift', title: 'Shift Performance', description: 'Shift Performance (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-prod-shift', grafanaSlug: 'mes-prod-shift', tags: ['star-mes', 'production', 'shift', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-prod-throughput', title: 'Throughput Monitoring', description: 'Throughput Monitoring (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'Gauge', grafanaUid: 'mes-prod-throughput', grafanaSlug: 'mes-prod-throughput', tags: ['star-mes', 'production', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-qual-capa', title: 'CAPA Tracking', description: 'CAPA Tracking (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.QUALITY, categoryKey: 'quality', icon: 'ShieldCheck', grafanaUid: 'mes-qual-capa', grafanaSlug: 'mes-qual-capa', tags: ['star-mes', 'quality', 'capa', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-qual-defects', title: 'Defect Analytics', description: 'Defect Analytics (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.QUALITY, categoryKey: 'quality', icon: 'ShieldCheck', grafanaUid: 'mes-qual-defects', grafanaSlug: 'mes-qual-defects', tags: ['star-mes', 'quality', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-qual-inspections', title: 'Inspection Results', description: 'Inspection Results (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.QUALITY, categoryKey: 'quality', icon: 'ShieldCheck', grafanaUid: 'mes-qual-inspections', grafanaSlug: 'mes-qual-inspections', tags: ['star-mes', 'quality', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-qual-ncr', title: 'Non-Conformance', description: 'Non-Conformance (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.QUALITY, categoryKey: 'quality', icon: 'ShieldCheck', grafanaUid: 'mes-qual-ncr', grafanaSlug: 'mes-qual-ncr', tags: ['star-mes', 'quality', 'ncr', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-qual-overview', title: 'Quality Overview', description: 'Quality Overview (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.QUALITY, categoryKey: 'quality', icon: 'ShieldCheck', grafanaUid: 'mes-qual-overview', grafanaSlug: 'mes-qual-overview', tags: ['star-mes', 'quality', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-qual-spc', title: 'SPC Dashboard', description: 'SPC Dashboard (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.QUALITY, categoryKey: 'quality', icon: 'ShieldCheck', grafanaUid: 'mes-qual-spc', grafanaSlug: 'mes-qual-spc', tags: ['star-mes', 'quality', 'spc', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-tpl-blank-factory', title: 'TEMPLATE — Blank Factory-Aware', description: 'Blank factory-aware Grafana template.', source: DashboardSource.GRAFANA, type: DashboardType.EXECUTIVE, categoryKey: 'overview', icon: 'LayoutDashboard', grafanaUid: 'mes-tpl-blank-factory', grafanaSlug: 'mes-tpl-blank-factory', tags: ['star-mes', 'template', 'grafana'], isTemplate: true, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-tpl-line-performance', title: 'TEMPLATE — Line Performance', description: 'Per-line performance Grafana template.', source: DashboardSource.GRAFANA, type: DashboardType.PRODUCTION, categoryKey: 'production', icon: 'LayoutDashboard', grafanaUid: 'mes-tpl-line-performance', grafanaSlug: 'mes-tpl-line-performance', tags: ['star-mes', 'template', 'grafana'], isTemplate: true, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-tpl-machine-detail', title: 'TEMPLATE — Machine Detail', description: 'Per-machine detail Grafana template.', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'manufacturing', icon: 'LayoutDashboard', grafanaUid: 'mes-tpl-machine-detail', grafanaSlug: 'mes-tpl-machine-detail', tags: ['star-mes', 'template', 'grafana'], isTemplate: true, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-trace-genealogy', title: 'Batch Genealogy', description: 'Batch Genealogy (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'traceability', icon: 'GitBranch', grafanaUid: 'mes-trace-genealogy', grafanaSlug: 'mes-trace-genealogy', tags: ['star-mes', 'traceability', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-trace-material', title: 'Material Traceability', description: 'Material Traceability (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'traceability', icon: 'GitBranch', grafanaUid: 'mes-trace-material', grafanaSlug: 'mes-trace-material', tags: ['star-mes', 'traceability', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-trace-product', title: 'Product Traceability', description: 'Product Traceability (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'traceability', icon: 'GitBranch', grafanaUid: 'mes-trace-product', grafanaSlug: 'mes-trace-product', tags: ['star-mes', 'traceability', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
  { slug: 'gf-mes-trace-recall', title: 'Recall Analysis', description: 'Recall Analysis (Grafana)', source: DashboardSource.GRAFANA, type: DashboardType.OPERATIONAL, categoryKey: 'traceability', icon: 'GitBranch', grafanaUid: 'mes-trace-recall', grafanaSlug: 'mes-trace-recall', tags: ['star-mes', 'traceability', 'grafana'], isTemplate: false, supportedScopes: ['FACTORY','AREA','LINE','MACHINE','SHIFT'] },
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
  const all = [...NATIVE, ...GRAFANA_DASHBOARDS];
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
