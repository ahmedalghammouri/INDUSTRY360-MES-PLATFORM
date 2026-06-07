import type { Metadata } from 'next';
import { ProductionWorkOrdersView } from '@/features/production/production-work-orders-view';

export const metadata: Metadata = { title: 'Work Orders | STAR-MES' };

export default function ProductionOrdersPage() {
  return <ProductionWorkOrdersView />;
}
