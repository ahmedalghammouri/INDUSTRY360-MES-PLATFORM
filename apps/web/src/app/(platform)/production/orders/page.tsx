import type { Metadata } from 'next';
import { ProductionWorkOrdersView } from '@/features/production/production-work-orders-view';

export const metadata: Metadata = { title: 'Work Orders | INDUSTRY360 MES' };

export default function ProductionOrdersPage() {
  return <ProductionWorkOrdersView />;
}
