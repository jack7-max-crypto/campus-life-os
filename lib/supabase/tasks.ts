import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

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

export async function fetchTasks(): Promise<SupabaseTask[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("User fetch error:", userError);
    return [];
  }

  if (!user) {
    console.error("No user found");
    return [];
  }

  const { data, error } = await supabase
    .from("planner_tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch error:", error);
    return [];
  }

  return (data ?? [])
    .map((row) => mapTaskRow(row as Partial<SupabaseTask>))
    .filter((task): task is SupabaseTask => task !== null);
}

export async function addTask(task: {
  title: string;
  due_date: string;
  category: string;
  note?: string;
}): Promise<SupabaseTask | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("User fetch error:", userError);
    return null;
  }

  if (!user) {
    console.error("No user found");
    return null;
  }

  const { data, error } = await supabase
    .from("planner_tasks")
    .insert([
      {
        ...task,
        user_id: user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Insert error:", error);
    return null;
  }

  return mapTaskRow(data as Partial<SupabaseTask>);
}

export async function updateTaskCompletion(id: string, completed: boolean) {
  const updates = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  };

  console.log("updateTaskCompletion called", {
    id,
    completed,
    completed_at: updates.completed_at,
  });

  const { data, error } = await supabase
    .from("planner_tasks")
    .update(updates)
    .eq("id", id)
    .select();

  console.log("updateTaskCompletion response", { data, error });

  if (error) {
    console.error("Update error:", error);
    return null;
  }

  return data?.[0] ?? null;
}

export async function archiveTask(id: string) {
  const { data, error } = await supabase
    .from("planner_tasks")
    .update({ archived: true })
    .eq("id", id)
    .select();

  if (error) {
    console.error("Archive error:", error);
    return null;
  }

  return data?.[0] ?? null;
}
