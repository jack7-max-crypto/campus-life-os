"use client";

import { useEffect, useState } from "react";

export type PlannerTaskCategory = "Academics" | "Fitness" | "Money" | "Personal";

export type PlannerTask = {
  id: string;
  title: string;
  dueDate: string;
  category: PlannerTaskCategory;
  note?: string;
  completed: boolean;
};

type CreatePlannerTaskInput = Omit<PlannerTask, "id" | "completed">;

const PLANNER_TASKS_STORAGE_KEY = "campus-life-os.planner-tasks.v1";

export const plannerTaskCategories: PlannerTaskCategory[] = [
  "Academics",
  "Fitness",
  "Money",
  "Personal",
];

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() ?? `planner-task-${Date.now()}`;
}

export function usePlannerTasks() {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PLANNER_TASKS_STORAGE_KEY);
      if (!raw) {
        setHasHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as PlannerTask[];
      if (Array.isArray(parsed)) {
        setTasks(parsed);
      }
    } catch {
      // keep empty fallback
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(PLANNER_TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [hasHydrated, tasks]);

  const addTask = (input: CreatePlannerTaskInput) => {
    const normalizedTitle = input.title.trim();
    if (!normalizedTitle || !input.dueDate) return;

    setTasks((previousTasks) => [
      ...previousTasks,
      {
        id: createTaskId(),
        title: normalizedTitle,
        dueDate: input.dueDate,
        category: input.category,
        note: input.note?.trim() ? input.note.trim() : undefined,
        completed: false,
      },
    ]);
  };

  const markTaskComplete = (taskId: string) => {
    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: true,
            }
          : task,
      ),
    );
  };

  return {
    tasks,
    addTask,
    markTaskComplete,
    hasHydrated,
  };
}
