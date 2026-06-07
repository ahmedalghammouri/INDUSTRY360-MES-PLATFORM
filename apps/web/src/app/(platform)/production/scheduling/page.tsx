import type { Metadata } from 'next';
import { ProductionSchedulingView } from '@/features/production/production-scheduling-view';

export const metadata: Metadata = { title: 'Production Scheduling | STAR-MES' };

export default function ProductionSchedulingPage() {
  return <ProductionSchedulingView />;
}
