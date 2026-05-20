import type { Metadata } from 'next';
import { QualityCapaView } from '@/features/quality/quality-capa-view';
export const metadata: Metadata = { title: 'CAPA Management | INDUSTRY360 MES' };
export default function CapaPage() { return <QualityCapaView />; }
