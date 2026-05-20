import type { Metadata } from 'next';
import { ProductionOverview } from '@/features/production/production-overview';

export const metadata: Metadata = { title: 'Production' };

export default function ProductionPage() {
  return <ProductionOverview />;
}
