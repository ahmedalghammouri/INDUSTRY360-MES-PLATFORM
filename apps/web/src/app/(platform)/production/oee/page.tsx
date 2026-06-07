import type { Metadata } from 'next';
import { ProductionOEEView } from '@/features/production/production-oee-view';

export const metadata: Metadata = { title: 'OEE Analysis | STAR-MES' };

export default function OEEPage() {
  return <ProductionOEEView />;
}
