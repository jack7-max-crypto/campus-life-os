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
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/45">
          Supabase Test
        </p>
        <h1 className="text-3xl font-semibold text-white">
          {status === "Supabase is connected"
            ? "Supabase is connected"
            : "Supabase foundation check"}
        </h1>
        <p className="text-sm text-white/50">
          This page only verifies that the App Router helper can be created.
          It does not query any tables yet.
        </p>
      </div>

      <div className="system-card-interactive relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0a0a0c] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.55)] transition-all duration-300 ease-out hover:-translate-y-[1px] hover:border-white/[0.12] hover:shadow-[0_12px_40px_rgba(0,0,0,0.75)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-20 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]">
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
