import { Card, MetricRow } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Personalization and account preferences.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card title="Profile preferences" subtitle="Display and academic defaults">
          <MetricRow label="Semester" value="Spring 2026" />
          <MetricRow label="Theme" value="Light" />
          <MetricRow label="Notifications" value="Enabled" />
        </Card>
        <Card title="Connected tools" subtitle="Integrations placeholder">
          <MetricRow label="Calendar sync" value="Not connected" />
          <MetricRow label="Fitness sync" value="Not connected" />
          <MetricRow label="Bank sync" value="Not connected" />
        </Card>
      </section>
    </div>
  );
}
