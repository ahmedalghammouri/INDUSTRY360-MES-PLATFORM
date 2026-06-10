import { TraceabilityView } from '@/features/traceability/traceability-view';

export const metadata = { title: 'Trace Log | STAR-MES' };

export default function TraceabilityPage() {
  return <TraceabilityView fixedTab="log" />;
}
