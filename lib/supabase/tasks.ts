import { createClient } from "@/lib/supabase/client";
import { setSupabaseOffline } from "@/lib/supabase/offline";

const supabase = createClient();

export type SupabaseTask = {
  id: string;
  title: string;
  due_date: string;
  category: string;
  note: string | null;
  completed: boolean;
  completed_at: string | null;
  archived: boolean;
  created_at: string;
  user_id?: string;
};

function mapTaskRow(row: Partial<SupabaseTask> | null): SupabaseTask | null {
  if (!row?.id || !row.title || !row.due_date || !row.category || !row.created_at) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    due_date: row.due_date,
    category: row.category,
    note: row.note ?? null,
    completed: row.completed ?? false,
    completed_at: row.completed_at ?? null,
    archived: row.archived ?? false,
    created_at: row.created_at,
    user_id: row.user_id,
  };
}

export async function fetchTasks(userId: string | null): Promise<SupabaseTask[]> {
  if (!userId) {
    return [];
  }

  let data: unknown[] | null = null;
  let error: unknown = null;

  try {
    const response = await supabase
      .from("planner_tasks")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: false });

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

  return (data ?? [])
    .map((row) => mapTaskRow(row as Partial<SupabaseTask>))
    .filter((task): task is SupabaseTask => task !== null);
}

export async function addTask(task: {
  title: string;
  due_date: string;
  category: string;
  note?: string;
}, userId: string | null): Promise<SupabaseTask | null> {
  if (!userId) {
    return null;
  }

  let data: unknown = null;
  let error: unknown = null;

  try {
    const response = await supabase
      .from("planner_tasks")
      .insert([
        {
          ...task,
          user_id: userId,
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

  return mapTaskRow(data as Partial<SupabaseTask>);
}

export async function updateTaskCompletion(id: string, completed: boolean, userId: string | null): Promise<SupabaseTask | null> {
  if (!userId) {
    return null;
  }

  const updates = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  };

  let data: unknown[] | null = null;
  let error: unknown = null;

  try {
    const response = await supabase
      .from("planner_tasks")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select();

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

  return mapTaskRow((data?.[0] ?? null) as Partial<SupabaseTask> | null);
}

export async function archiveTask(id: string, userId: string | null): Promise<SupabaseTask | null> {
  if (!userId) {
    return null;
  }

  let data: unknown[] | null = null;
  let error: unknown = null;

  try {
    const response = await supabase
      .from("planner_tasks")
      .update({ archived: true })
      .eq("id", id)
      .eq("user_id", userId)
      .select();

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

  return mapTaskRow((data?.[0] ?? null) as Partial<SupabaseTask> | null);
}
