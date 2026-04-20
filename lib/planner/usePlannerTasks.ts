"use client";

import { useEffect, useState } from "react";
import { recordTaskCompletion } from "@/lib/streak";

export type PlannerTaskCategory = "Academics" | "Fitness" | "Money" | "Personal";
export type PlannerTaskPriority = "P1" | "P2" | "P3";

export type PlannerTask = {
  id: string;
  title: string;
  dueDate: string;
  category: PlannerTaskCategory;
  priority: PlannerTaskPriority;
  note?: string;
  completed: boolean;
};

type CreatePlannerTaskInput = Omit<PlannerTask, "id" | "completed" | "priority"> & {
  priority?: PlannerTaskPriority;
};

export const PLANNER_TASKS_STORAGE_KEY = "campus-life-os.planner-tasks.v1";
export const PLANNER_TASKS_UPDATED_EVENT = "campus-life-os.planner-tasks-updated";

export const plannerTaskCategories: PlannerTaskCategory[] = [
  "Academics",
  "Fitness",
  "Money",
  "Personal",
];

function normalizeTask(task: PlannerTask | (Omit<PlannerTask, "priority"> & { priority?: PlannerTaskPriority })) {
  return {
    ...task,
    priority: task.priority ?? "P2",
  };
}

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() ?? `planner-task-${Date.now()}`;
}

export function getStoredPlannerTasks() {
  if (typeof window === "undefined") {
    return [] as PlannerTask[];
  }

  try {
    const raw = window.localStorage.getItem(PLANNER_TASKS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Array<
      PlannerTask | (Omit<PlannerTask, "priority"> & { priority?: PlannerTaskPriority })
    >;
    return Array.isArray(parsed) ? parsed.map(normalizeTask) : [];
  } catch {
    return [];
  }
}

export function markPlannerTaskCompleteInStorage(taskId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const tasks = getStoredPlannerTasks();
  const matchingTask = tasks.find((task) => task.id === taskId);
  if (!matchingTask || matchingTask.completed) {
    return false;
  }

  recordTaskCompletion();
  const nextTasks = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          completed: true,
        }
      : task,
  );

  window.localStorage.setItem(PLANNER_TASKS_STORAGE_KEY, JSON.stringify(nextTasks));
  window.dispatchEvent(new CustomEvent<PlannerTask[]>(PLANNER_TASKS_UPDATED_EVENT, { detail: nextTasks }));
  return true;
}

export function usePlannerTasks() {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const syncTasks = () => {
      setTasks(getStoredPlannerTasks());
      setHasHydrated(true);
    };

    syncTasks();
    window.addEventListener("storage", syncTasks);
    window.addEventListener(PLANNER_TASKS_UPDATED_EVENT, syncTasks as EventListener);

    return () => {
      window.removeEventListener("storage", syncTasks);
      window.removeEventListener(PLANNER_TASKS_UPDATED_EVENT, syncTasks as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    const serializedTasks = JSON.stringify(tasks);
    if (window.localStorage.getItem(PLANNER_TASKS_STORAGE_KEY) === serializedTasks) {
      return;
    }

    window.localStorage.setItem(PLANNER_TASKS_STORAGE_KEY, serializedTasks);
    window.dispatchEvent(new CustomEvent<PlannerTask[]>(PLANNER_TASKS_UPDATED_EVENT, { detail: tasks }));
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
        priority: input.priority ?? "P2",
        note: input.note?.trim() ? input.note.trim() : undefined,
        completed: false,
      },
    ]);
  };

  const markTaskComplete = (taskId: string) => {
    const matchingTask = tasks.find((task) => task.id === taskId);
    if (!matchingTask || matchingTask.completed) return;

    recordTaskCompletion();
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

  const updateTaskPriority = (taskId: string, priority: PlannerTaskPriority) => {
    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              priority,
            }
          : task,
      ),
    );
  };

  return {
    tasks,
    addTask,
    markTaskComplete,
    updateTaskPriority,
    hasHydrated,
  };
}
