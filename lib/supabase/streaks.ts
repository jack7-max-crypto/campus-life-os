import { createClient } from "@/lib/supabase/client";
import { setSupabaseOffline } from "@/lib/supabase/offline";

const supabase = createClient();

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
  } = await supabase.auth.getUser().catch((error: unknown) => ({
    data: { user: null },
    error,
  }));

  if (error) {
    setSupabaseOffline(true);
    return null;
  }

  setSupabaseOffline(false);
  return user ?? null;
}

export async function fetchStreaks(): Promise<SupabaseStreak[]> {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  let data: unknown[] | null = null;
  let error: unknown = null;

  try {
    const response = await supabase
      .from("wellness_streaks")
      .select("*")
      .eq("user_id", user.id);

    data = response.data;
    error = response.error;
  } catch (requestError) {
    error = requestError;
  }

  if (error) {
    setSupabaseOffline(true);
    return [];
  }

  setSupabaseOffline(false);
  return ((data ?? []) as unknown[])
    .map((row: unknown) => mapStreakRow(row as Partial<SupabaseStreak>))
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

  let existing: unknown = null;
  let selectError: { code?: string } | unknown = null;

  try {
    const response = await supabase
      .from("wellness_streaks")
      .select("*")
      .eq("user_id", user.id)
      .eq("streak_type", streakType)
      .single();

    existing = response.data;
    selectError = response.error;
  } catch (requestError) {
    selectError = requestError;
  }

  if (selectError && (!("code" in Object(selectError)) || Object(selectError).code !== "PGRST116")) {
    setSupabaseOffline(true);
    return null;
  }

  if (existing) {
    let data: unknown = null;
    let error: unknown = null;

    try {
      const response = await supabase
        .from("wellness_streaks")
        .update({
          count,
          last_completed: lastCompleted,
        })
        .eq("id", (existing as SupabaseStreak).id)
        .select()
        .single();

      data = response.data;
      error = response.error;
    } catch (requestError) {
      error = requestError;
    }

    if (error) {
      setSupabaseOffline(true);
      return null;
    }

    setSupabaseOffline(false);
    return mapStreakRow(data as Partial<SupabaseStreak>);
  }

  let data: unknown = null;
  let error: unknown = null;

  try {
    const response = await supabase
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

    data = response.data;
    error = response.error;
  } catch (requestError) {
    error = requestError;
  }

  if (error) {
    setSupabaseOffline(true);
    return null;
  }

  setSupabaseOffline(false);
  return mapStreakRow(data as Partial<SupabaseStreak>);
}
