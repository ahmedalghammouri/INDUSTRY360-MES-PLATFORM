import type { Metadata } from 'next';
import { ProductionReportView } from '@/features/reports/production-report-view';

export const metadata: Metadata = { title: 'Production Reports | STAR-MES' };

export default function ProductionReportPage() {
  return <ProductionReportView />;
}
