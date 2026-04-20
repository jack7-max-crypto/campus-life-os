"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsLoading(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={isLoading}
      className="system-button-secondary px-4 py-2 text-sm font-semibold"
    >
      {isLoading ? "Logging out..." : "Logout"}
    </button>
  );
}
