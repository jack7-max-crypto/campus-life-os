import { Card, MetricRow } from "@/components/ui/card";

export default function FitnessPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Fitness</h2>
        <p className="mt-1 text-sm text-slate-500">Nutrition, progress, and training snapshots.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Calorie target card" subtitle="Daily budget">
          <MetricRow label="Target" value="2,100 kcal" />
          <MetricRow label="Consumed" value="1,620 kcal" />
          <MetricRow label="Remaining" value="480 kcal" />
        </Card>

        <Card title="Protein card" subtitle="Macro tracking">
          <MetricRow label="Target" value="130 g" />
          <MetricRow label="Current" value="92 g" />
          <MetricRow label="Remaining" value="38 g" />
        </Card>

        <Card title="Workout log section" subtitle="Recent sessions">
          <MetricRow label="Mon" value="Upper body • 50 min" />
          <MetricRow label="Wed" value="Run • 4.2 mi" />
          <MetricRow label="Fri" value="Leg day • 55 min" />
        </Card>

        <Card title="Weight trend placeholder chart" className="xl:col-span-3" subtitle="Last 8 weeks">
          <div className="h-56 rounded-xl border border-dashed border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 p-4 text-sm text-slate-500">
            Placeholder chart: 168 lb → 163 lb trendline.
          </div>
        </Card>
      </section>
    </div>
  );
}
