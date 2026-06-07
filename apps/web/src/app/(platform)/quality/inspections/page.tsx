import type { Metadata } from 'next';
import { QualityInspectionsView } from '@/features/quality/quality-inspections-view';
export const metadata: Metadata = { title: 'Quality Inspections | STAR-MES' };
export default function InspectionsPage() { return <QualityInspectionsView />; }
