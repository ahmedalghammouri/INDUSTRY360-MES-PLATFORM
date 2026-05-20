import type { Metadata } from 'next';
import { MaintenanceWorkOrdersView } from '@/features/maintenance/maintenance-work-orders-view';
export const metadata: Metadata = { title: 'Maintenance Work Orders | INDUSTRY360 MES' };
export default function MaintenanceWOPage() { return <MaintenanceWorkOrdersView />; }
