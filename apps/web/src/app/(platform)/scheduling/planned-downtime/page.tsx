import { ScheduleView } from '@/features/scheduling/schedule-view';

export const metadata = { title: 'Planned Downtime Schedule | Industry360' };

export default function PlannedDowntimeSchedulePage() {
  return (
    <div className="max-w-[1800px] mx-auto">
      <ScheduleView
        title="Planned Downtime Schedule"
        subtitle="Gantt of scheduled breaks, cleaning and planned stops per machine."
        defaultTypes={['PLANNED_DOWNTIME']}
      />
    </div>
  );
}
