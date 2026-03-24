import { Card, MetricRow } from "@/components/ui/card";

export default function PlannerPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Planner</h2>
        <p className="mt-1 text-sm text-slate-500">Organize weekly priorities and time blocks.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Weekly planning layout" className="xl:col-span-2" subtitle="Mon → Sun overview">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
              "Sun",
            ].map((day) => (
              <div key={day} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-4 text-center text-xs text-slate-500">
                {day}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Upcoming tasks" subtitle="Next 3 days">
          <MetricRow label="Draft econ memo" value="Today" />
          <MetricRow label="Calc practice set" value="Tomorrow" />
          <MetricRow label="Club budget review" value="Thu" />
        </Card>

        <Card title="Priority tasks" subtitle="High impact first">
          <MetricRow label="Biochem report" value="P1" />
          <MetricRow label="Resume update" value="P2" />
          <MetricRow label="Apartment call" value="P3" />
        </Card>

        <Card title="Time-block placeholder area" className="xl:col-span-2" subtitle="Visual schedule canvas">
          <div className="h-56 rounded-xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-slate-100 p-4 text-sm text-slate-500">
            Drag-and-drop time blocks will live here.
          </div>
        </Card>
      </section>
    </div>
  );
}
