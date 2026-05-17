import { Suspense } from "react";
import { Card, MetricRow } from "@/components/ui/card";
import { CanvasSyncCard } from "@/components/settings/canvas-sync-card";

export default function SettingsPage() {
  return (
    <div className="animate-fadeIn space-y-2.5 sm:space-y-7">
      <section className="space-y-1 sm:space-y-2">
        <h2 className="system-page-heading text-[1.3rem] sm:text-2xl">Settings</h2>
        <p className="system-page-copy mt-0.5 text-[0.82rem] sm:mt-1 sm:text-sm">Personalization and account preferences.</p>
      </section>

      <section className="grid gap-2.5 sm:gap-4 md:grid-cols-2 md:gap-5">
        <Card title="Profile preferences" subtitle="Display and academic defaults" variant="dark">
          <MetricRow label="Semester" value="Spring 2026" variant="dark" />
          <MetricRow label="Theme" value="Midnight" variant="dark" />
          <MetricRow label="Notifications" value="Enabled" variant="dark" />
        </Card>
        <Card title="Connected tools" subtitle="Integrations placeholder" variant="dark">
          <MetricRow label="Calendar sync" value="Not connected" variant="dark" />
          <MetricRow label="Fitness sync" value="Not connected" variant="dark" />
          <MetricRow label="Bank sync" value="Not connected" variant="dark" />
        </Card>

        <Suspense
          fallback={
            <Card
              title="Canvas sync"
              subtitle="Read-only course and assignment import"
              variant="dark"
              className="md:col-span-2"
            >
              <p className="text-sm text-white/50">Loading Canvas sync...</p>
            </Card>
          }
        >
          <CanvasSyncCard />
        </Suspense>
      </section>
    </div>
  );
}
