"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setSupabaseOffline } from "@/lib/supabase/offline";

type AuthAction = "sign-in" | "sign-up" | null;

const supabase = createClient();

function isFetchFailure(error: unknown) {
  return error instanceof Error && error.message === "Failed to fetch";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeAction, setActiveAction] = useState<AuthAction>(null);

  const isLoading = activeAction !== null;

  async function handleAuth(action: Exclude<AuthAction, null>) {
    setActiveAction(action);
    setErrorMessage("");

    const credentials = {
      email: email.trim(),
      password,
    };

    const originalConsoleError = console.error;
    console.error = (...args: Parameters<typeof console.error>) => {
      if (args.some(isFetchFailure)) {
        return;
      }

      originalConsoleError(...args);
    };

    const { error } = await (action === "sign-in"
      ? supabase.auth.signInWithPassword(credentials)
      : supabase.auth.signUp(credentials))
      .catch((error: unknown) => ({
        error: isFetchFailure(error)
          ? new Error("Authentication service is unavailable. Please try again in a moment.")
          : error instanceof Error
            ? error
            : new Error("Authentication request failed."),
      }))
      .finally(() => {
        console.error = originalConsoleError;
      });

    if (error) {
      setSupabaseOffline(true);
      setErrorMessage(
        error.message.includes("Failed to fetch")
          ? "Authentication service is unavailable. Please try again in a moment."
          : error.message,
      );
      setActiveAction(null);
      return;
    }

    setSupabaseOffline(false);
    router.replace("/");
    router.refresh();
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleAuth("sign-in");
  }

  return (
    <div className="animate-fadeIn mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
      <div className="system-panel system-card-shell system-card-interactive relative w-full p-6 sm:p-8">
        <div className="relative space-y-2">
          <p className="system-label">Authentication</p>
          <h1 className="system-page-heading text-3xl">Login</h1>
          <p className="system-page-copy text-sm leading-6">
            Sign in to access your planner, or create an account with email and password.
          </p>
        </div>

        <form className="relative mt-6 space-y-4" onSubmit={handleSignIn}>
          <label className="system-label block text-white/45">
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="system-input mt-1 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="system-label block text-white/45">
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="system-input mt-1 px-3 py-2.5 text-sm"
            />
          </label>

          {errorMessage ? (
            <p className="semantic-danger rounded-xl px-3 py-2 text-sm">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={isLoading}
              className="system-button-primary flex-1 px-4 py-2.5 text-sm font-semibold disabled:border-white/30 disabled:bg-white/30 disabled:text-white/50"
            >
              {activeAction === "sign-in" ? "Signing In..." : "Sign In"}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleAuth("sign-up")}
              className="system-button-secondary flex-1 px-4 py-2.5 text-sm font-semibold"
            >
              {activeAction === "sign-up" ? "Signing Up..." : "Sign Up"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-sm text-white/50">
          Planner access requires a signed-in account. Go back to the{" "}
          <Link href="/" className="font-medium text-white underline underline-offset-4">
            dashboard
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
