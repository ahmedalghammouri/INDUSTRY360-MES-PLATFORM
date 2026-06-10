import { ScheduleView } from '@/features/scheduling/schedule-view';

export const metadata = { title: 'Production Schedule | Industry360' };

export default function ProductionSchedulePage() {
  return (
    <div className="max-w-[1800px] mx-auto">
      <ScheduleView
        title="Production Schedule"
        subtitle="Gantt of production orders and work orders across machines."
        defaultTypes={['PRODUCTION_ORDER', 'WORK_ORDER']}
      />
    </div>
  );
}
