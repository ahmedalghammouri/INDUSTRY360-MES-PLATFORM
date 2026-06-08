import type { Metadata } from 'next';
import { QualityPlansView } from '@/features/quality/quality-plans-view';

export const metadata: Metadata = { title: 'Quality Plans — ISA-95 Configuration' };

export default function QualityPlansPage() {
  return <QualityPlansView />;
}
