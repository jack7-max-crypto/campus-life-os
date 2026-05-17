import { createClient } from "@/lib/supabase/server";

export default async function SupabaseTestPage() {
  let status = "Environment variables missing";
  let projectUrlStatus = "Missing";

  try {
    await createClient();
    status = "Supabase is connected";
    projectUrlStatus = "Detected";
  } catch {
    const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const hasKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    projectUrlStatus = hasUrl ? "Detected" : "Missing";
    status =
      hasUrl && hasKey
        ? "Supabase client could not be created"
        : "Environment variables missing";
  }

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <p className="system-label">
          Supabase Test
        </p>
        <h1 className="system-page-heading text-3xl">
          {status === "Supabase is connected"
            ? "Supabase is connected"
            : "Supabase foundation check"}
        </h1>
        <p className="system-page-copy text-sm">
          This page only verifies that the App Router helper can be created.
          It does not query any tables yet.
        </p>
      </div>

      <div className="system-panel system-card-shell system-card-interactive relative overflow-hidden p-6 transition-all duration-300 ease-out">
        <dl className="relative space-y-3 text-sm text-white/60">
          <div className="flex items-center justify-between gap-4">
            <dt>Supabase status</dt>
            <dd className="font-medium text-white">{status}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>Project URL</dt>
            <dd className="font-medium text-white">{projectUrlStatus}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>Environment variables</dt>
            <dd className="font-medium text-white">
              {process.env.NEXT_PUBLIC_SUPABASE_URL &&
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
                ? "Detected"
                : "Missing"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
