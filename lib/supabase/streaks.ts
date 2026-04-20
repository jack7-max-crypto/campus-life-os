import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

export type SupabaseStreak = {
  id: string;
  user_id: string;
  streak_type: string;
  count: number;
  last_completed: string | null;
  created_at: string;
};

function mapStreakRow(row: Partial<SupabaseStreak> | null): SupabaseStreak | null {
  if (!row?.id || !row.user_id || !row.streak_type || !row.created_at) {
    return null;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    streak_type: row.streak_type,
    count: typeof row.count === "number" ? row.count : 0,
    last_completed: row.last_completed ?? null,
    created_at: row.created_at,
  };
}

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("User fetch error:", error);
    return null;
  }

  return user ?? null;
}

export async function fetchStreaks(): Promise<SupabaseStreak[]> {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("wellness_streaks")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    console.error("Fetch streaks error:", error);
    return [];
  }

  return (data ?? [])
    .map((row) => mapStreakRow(row as Partial<SupabaseStreak>))
    .filter((row): row is SupabaseStreak => row !== null);
}

export async function upsertStreak(
  streakType: string,
  count: number,
  lastCompleted: string | null,
): Promise<SupabaseStreak | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { data: existing, error: selectError } = await supabase
    .from("wellness_streaks")
    .select("*")
    .eq("user_id", user.id)
    .eq("streak_type", streakType)
    .single();

  if (selectError && selectError.code !== "PGRST116") {
    console.error("Select streak error:", selectError);
    return null;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("wellness_streaks")
      .update({
        count,
        last_completed: lastCompleted,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      console.error("Update streak error:", error);
      return null;
    }

    return mapStreakRow(data as Partial<SupabaseStreak>);
  }

  const { data, error } = await supabase
    .from("wellness_streaks")
    .insert([
      {
        user_id: user.id,
        streak_type: streakType,
        count,
        last_completed: lastCompleted,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Insert streak error:", error);
    return null;
  }

  return mapStreakRow(data as Partial<SupabaseStreak>);
}
