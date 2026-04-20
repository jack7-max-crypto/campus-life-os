import { Card, MetricRow } from "@/components/ui/card";
import { CanvasSyncCard } from "@/components/settings/canvas-sync-card";

export default function SettingsPage() {
  return (
    <div className="animate-fadeIn space-y-6 sm:space-y-7">
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Settings</h2>
        <p className="mt-1 text-sm text-white/50">Personalization and account preferences.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 md:gap-5">
        <Card title="Profile preferences" subtitle="Display and academic defaults" variant="dark">
          <MetricRow label="Semester" value="Spring 2026" variant="dark" />
          <MetricRow label="Theme" value="Light" variant="dark" />
          <MetricRow label="Notifications" value="Enabled" variant="dark" />
        </Card>
        <Card title="Connected tools" subtitle="Integrations placeholder" variant="dark">
          <MetricRow label="Calendar sync" value="Not connected" variant="dark" />
          <MetricRow label="Fitness sync" value="Not connected" variant="dark" />
          <MetricRow label="Bank sync" value="Not connected" variant="dark" />
        </Card>

        <CanvasSyncCard />
      </section>
    </div>
  );
}
