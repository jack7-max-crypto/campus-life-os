import { Card, MetricRow } from "@/components/ui/card";

export default function MoneyPage() {
  return (
    <div className="animate-fadeIn space-y-6 sm:space-y-7 lg:space-y-9">
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Money</h2>
        <p className="mt-1 text-sm text-white/50">Spending awareness and savings momentum.</p>
      </section>

      <section className="mt-14 grid gap-4 border-t border-white/[0.05] pt-7 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Weekly spending card" subtitle="Current week" variant="dark">
          <MetricRow label="Spent" value="$186" variant="dark" />
          <MetricRow label="Budget" value="$240" variant="dark" />
          <MetricRow label="Remaining" value="$54" variant="dark" />
        </Card>

        <Card title="Category breakdown" subtitle="Top categories" variant="dark">
          <MetricRow label="Dining" value="$68" variant="dark" />
          <MetricRow label="Transport" value="$42" variant="dark" />
          <MetricRow label="Groceries" value="$38" variant="dark" />
        </Card>

        <Card title="Savings goal" subtitle="Summer internship fund" variant="dark">
          <MetricRow label="Goal" value="$2,000" variant="dark" />
          <MetricRow label="Saved" value="$1,180" variant="dark" />
          <MetricRow label="Progress" value="59%" variant="dark" />
        </Card>

        <Card
          title="Monthly spending chart placeholder"
          className="xl:col-span-3"
          subtitle="6-month trend"
          variant="dark"
        >
          <div className="system-subtle-panel system-card-interactive h-56 rounded-[16px] border border-dashed border-white/[0.05] p-4 text-sm text-white/46">
            Placeholder chart: Jan $710, Feb $640, Mar $588...
          </div>
        </Card>
      </section>
    </div>
  );
}
