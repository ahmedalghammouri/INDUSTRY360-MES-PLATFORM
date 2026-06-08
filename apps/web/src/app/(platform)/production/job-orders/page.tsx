import type { Metadata } from 'next';
import { JobOrdersView } from '@/features/production/job-orders-view';

export const metadata: Metadata = { title: 'Dispatch List (Job Orders) | STAR-MES' };

export default function JobOrdersPage() {
  return <JobOrdersView />;
}
