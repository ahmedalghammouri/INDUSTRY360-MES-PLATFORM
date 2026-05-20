import type { Metadata } from 'next';
import { QualityNcrView } from '@/features/quality/quality-ncr-view';
export const metadata: Metadata = { title: 'NCR Management | INDUSTRY360 MES' };
export default function NcrPage() { return <QualityNcrView />; }
