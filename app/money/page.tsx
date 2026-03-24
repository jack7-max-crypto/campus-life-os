import { Card, MetricRow } from "@/components/ui/card";

export default function MoneyPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Money</h2>
        <p className="mt-1 text-sm text-slate-500">Spending awareness and savings momentum.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Weekly spending card" subtitle="Current week">
          <MetricRow label="Spent" value="$186" />
          <MetricRow label="Budget" value="$240" />
          <MetricRow label="Remaining" value="$54" />
        </Card>

        <Card title="Category breakdown" subtitle="Top categories">
          <MetricRow label="Dining" value="$68" />
          <MetricRow label="Transport" value="$42" />
          <MetricRow label="Groceries" value="$38" />
        </Card>

        <Card title="Savings goal" subtitle="Summer internship fund">
          <MetricRow label="Goal" value="$2,000" />
          <MetricRow label="Saved" value="$1,180" />
          <MetricRow label="Progress" value="59%" />
        </Card>

        <Card title="Monthly spending chart placeholder" className="xl:col-span-3" subtitle="6-month trend">
          <div className="h-56 rounded-xl border border-dashed border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 p-4 text-sm text-slate-500">
            Placeholder chart: Jan $710, Feb $640, Mar $588...
          </div>
        </Card>
      </section>
    </div>
  );
}
