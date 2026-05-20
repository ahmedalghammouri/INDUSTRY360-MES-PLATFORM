import type { Metadata } from 'next';
import { MaintenanceReportView } from '@/features/reports/maintenance-report-view';
export const metadata: Metadata = { title: 'Maintenance Reports | INDUSTRY360 MES' };
export default function MaintenanceReportPage() { return <MaintenanceReportView />; }
