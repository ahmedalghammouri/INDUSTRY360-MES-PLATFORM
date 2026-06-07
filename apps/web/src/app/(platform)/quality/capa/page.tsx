import type { Metadata } from 'next';
import { QualityCapaView } from '@/features/quality/quality-capa-view';
export const metadata: Metadata = { title: 'CAPA Management | STAR-MES' };
export default function CapaPage() { return <QualityCapaView />; }
