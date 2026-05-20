import type { Metadata } from 'next';
import { MaintenanceSparePartsView } from '@/features/maintenance/maintenance-spare-parts-view';
export const metadata: Metadata = { title: 'Spare Parts | INDUSTRY360 MES' };
export default function SparePartsPage() { return <MaintenanceSparePartsView />; }
