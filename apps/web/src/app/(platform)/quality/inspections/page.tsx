import type { Metadata } from 'next';
import { QualityInspectionsView } from '@/features/quality/quality-inspections-view';
export const metadata: Metadata = { title: 'Quality Inspections | INDUSTRY360 MES' };
export default function InspectionsPage() { return <QualityInspectionsView />; }
