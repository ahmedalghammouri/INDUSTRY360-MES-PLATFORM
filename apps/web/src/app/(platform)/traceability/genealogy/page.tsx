import { TraceabilityView } from '@/features/traceability/traceability-view';

export const metadata = { title: 'Genealogy | STAR-MES' };

export default function GenealogyPage() {
  return <TraceabilityView fixedTab="genealogy" />;
}
