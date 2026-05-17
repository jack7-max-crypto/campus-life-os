"use client";

import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setSupabaseOffline } from "@/lib/supabase/offline";

const supabase = createClient();

export function LogoutButton({
  className = "system-button-secondary px-4 py-2 text-sm font-semibold",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);

    const { error } = await supabase.auth.signOut().catch((error: unknown) => ({
      error: error instanceof Error ? error : new Error("Logout request failed."),
    }));

    if (error) {
      setSupabaseOffline(true);
      setIsLoading(false);
      return;
    }

    setSupabaseOffline(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? "Logging out..." : (children ?? "Logout")}
    </button>
  );
}
