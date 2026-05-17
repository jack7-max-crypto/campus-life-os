"use client";

import Link from "next/link";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { createClient } from "@/lib/supabase/client";
import { setSupabaseOffline } from "@/lib/supabase/offline";

const supabase = createClient();

type HeaderAuthState =
  | { status: "loading"; email: null }
  | { status: "signed-in"; email: string }
  | { status: "signed-out"; email: null }
  | { status: "offline"; email: null };

const authActionClassName =
  "system-button-secondary inline-flex items-center px-2.5 py-1.5 text-xs font-semibold sm:px-4 sm:py-2 sm:text-sm";

export function Header() {
  const [authState, setAuthState] = useState<HeaderAuthState>({
    status: "loading",
    email: null,
  });
  const authStatusRef = useRef<HeaderAuthState["status"]>("loading");

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (error) {
          throw error;
        }

        setSupabaseOffline(false);
        const nextState: HeaderAuthState = data.session?.user
          ? {
              status: "signed-in",
              email: data.session.user.email ?? "Signed in",
            }
          : { status: "signed-out", email: null };
        authStatusRef.current = nextState.status;
        setAuthState(nextState);
      } catch {
        if (!isMounted) {
          return;
        }

        setSupabaseOffline(true);
        authStatusRef.current = "offline";
        setAuthState({ status: "offline", email: null });
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        const nextState: HeaderAuthState = {
          status: "signed-in",
          email: session.user.email ?? "Signed in",
        };
        setSupabaseOffline(false);
        authStatusRef.current = nextState.status;
        setAuthState(nextState);
        return;
      }

      if (authStatusRef.current === "offline") {
        return;
      }

      setSupabaseOffline(false);
      authStatusRef.current = "signed-out";
      setAuthState({ status: "signed-out", email: null });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isSignedIn = authState.status === "signed-in";
  const displayName = isSignedIn
    ? authState.email
    : authState.status === "loading"
      ? "Checking session"
      : "Guest";
  const displayStatus = isSignedIn
    ? "Signed in"
    : authState.status === "loading"
      ? "Loading"
      : authState.status === "offline"
        ? "Local mode"
        : "Signed out";

  return (
    <header className="system-top-chrome sticky top-0 z-10 overflow-hidden px-3 py-1.5 sm:px-6 sm:py-3 md:py-4">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),rgba(190,194,204,0.045),transparent)]" />
      <div className="relative flex min-w-0 items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <p className="system-label text-[9px] sm:text-[10px]">Operating Layer</p>
          <h1 className="system-page-heading mt-0.5 truncate text-[1.05rem] sm:mt-2 sm:text-xl">Campus Life OS</h1>
          <p className="system-page-copy mt-1 truncate text-sm max-[430px]:hidden">Daily university dashboard</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="system-inset-panel flex items-center gap-0 rounded-[12px] px-1.5 py-1 sm:gap-3 sm:px-3 sm:py-2">
            <div className="system-avatar-orb h-5.5 w-5.5 rounded-full border border-white/[0.11] sm:h-8 sm:w-8" />
            <div className="hidden text-right sm:block">
              <p className="max-w-[5rem] truncate text-sm font-medium text-white sm:max-w-[12rem]">
                {displayName}
              </p>
              <p className="system-label text-[10px]">
                {displayStatus}
              </p>
            </div>
          </div>
          {isSignedIn ? (
            <LogoutButton className={authActionClassName}>Logout</LogoutButton>
          ) : authState.status === "loading" ? null : (
            <Link href="/login" className={authActionClassName}>
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
