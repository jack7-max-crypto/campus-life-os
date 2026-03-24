import { Card, MetricRow } from "@/components/ui/card";

export default function AcademicsPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Academics</h2>
        <p className="mt-1 text-sm text-slate-500">Track performance and plan grade outcomes.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Courses overview" subtitle="Spring semester">
          <MetricRow label="Active courses" value="5" />
          <MetricRow label="Credits" value="16" />
          <MetricRow label="Attendance" value="94%" />
        </Card>

        <Card title="Current grades" subtitle="Live snapshot">
          <MetricRow label="Organic Chemistry" value="B- (82%)" />
          <MetricRow label="Data Structures" value="A- (91%)" />
          <MetricRow label="Statistics II" value="B (84%)" />
        </Card>

        <Card title="Class priority ranking" subtitle="Suggested order">
          <MetricRow label="1. Organic Chemistry" value="High" />
          <MetricRow label="2. Statistics II" value="Medium" />
          <MetricRow label="3. Data Structures" value="Low" />
        </Card>

        <Card title="Grade target calculator UI" className="xl:col-span-2" subtitle="What score do you need?">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-500">
              Current grade
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="82" readOnly />
            </label>
            <label className="text-xs text-slate-500">
              Target grade
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="90" readOnly />
            </label>
            <label className="text-xs text-slate-500">
              Final weight %
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="35" readOnly />
            </label>
          </div>
          <p className="text-sm text-slate-700">You&apos;d need approximately <strong>95%</strong> on remaining work.</p>
        </Card>

        <Card title="Final exam calculator UI" subtitle="Exam readiness">
          <MetricRow label="Projected course grade" value="87%" />
          <MetricRow label="Needed on final for A-" value="91%" />
        </Card>
      </section>

      <Card title="Assignments table" subtitle="Upcoming and open tasks">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Assignment</th>
                <th className="px-2 py-2">Course</th>
                <th className="px-2 py-2">Due</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="px-2 py-2">Lab Report 4</td>
                <td className="px-2 py-2">Organic Chemistry</td>
                <td className="px-2 py-2">Mar 25</td>
                <td className="px-2 py-2">In progress</td>
              </tr>
              <tr>
                <td className="px-2 py-2">Linked List Project</td>
                <td className="px-2 py-2">Data Structures</td>
                <td className="px-2 py-2">Mar 27</td>
                <td className="px-2 py-2">Not started</td>
              </tr>
              <tr>
                <td className="px-2 py-2">Probability Quiz</td>
                <td className="px-2 py-2">Statistics II</td>
                <td className="px-2 py-2">Mar 29</td>
                <td className="px-2 py-2">Ready</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
