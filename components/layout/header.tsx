import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { createClient } from "@/lib/supabase/server";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 border-b border-white/[0.05] bg-[#010102]/96 px-6 py-3 md:py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="system-label text-white/44">Operating Layer</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">Campus Life OS</h1>
          <p className="mt-1 text-sm text-white/46">Daily university dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-[16px] border border-white/[0.06] bg-[#080809] px-3 py-2 shadow-[0_14px_34px_rgba(0,0,0,0.38)]">
            <div className="h-8 w-8 rounded-full border border-white/[0.06] bg-white/[0.04]" />
            <div className="text-right">
              <p className="max-w-[12rem] truncate text-sm font-medium text-white">
                {user?.email ?? "Guest"}
              </p>
              <p className="system-label text-white/40">
                {user ? "Signed in" : "Signed out"}
              </p>
            </div>
          </div>
          {user ? (
            <LogoutButton />
          ) : (
            <Link
              href="/login"
              className="system-button-secondary inline-flex items-center px-4 py-2 text-sm font-semibold"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
