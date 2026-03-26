import { Card, MetricRow } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Home</h2>
        <p className="mt-1 text-sm text-slate-500">A quick look at what matters today.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Today overview" subtitle="Tuesday, March 24">
          <MetricRow label="Classes" value="3 scheduled" />
          <MetricRow label="Focus hours" value="4h planned" />
          <MetricRow label="Wellness" value="7,860 steps" />
        </Card>

        <Card title="Upcoming deadlines" subtitle="Next 7 days">
          <MetricRow label="Biochem lab report" value="Tomorrow, 11:59 PM" />
          <MetricRow label="UX prototype review" value="Fri, 2:00 PM" />
          <MetricRow label="Calc quiz" value="Mon, 9:30 AM" />
        </Card>

        <Card title="At-risk classes" subtitle="Needs attention">
          <MetricRow label="Organic Chemistry" value="72% • +8% to goal" />
          <MetricRow label="Statistics II" value="76% • +4% to goal" />
        </Card>

        <Card title="Calorie progress" subtitle="Daily nutrition">
          <MetricRow label="Calories" value="1,620 / 2,100 kcal" />
          <MetricRow label="Protein" value="92 / 130 g" />
        </Card>

        <Card title="Weekly spending snapshot" subtitle="Budget health">
          <MetricRow label="Spent" value="$186 / $240" />
          <MetricRow label="Top category" value="Dining • $68" />
        </Card>

        <Card title="Recommended next step" subtitle="Suggested action">
          <p className="rounded-xl bg-indigo-50 px-3 py-3 text-sm text-indigo-900">
            Block 90 minutes tonight to finish the Biochem report and recover your
            academics risk score.
          </p>
        </Card>
      </section>
    </div>
  );
}
