"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { Course } from "@/lib/academics/types";
import { PlannerTask } from "@/lib/planner/usePlannerTasks";

type CompletionInsightsState = {
  plannerTaskDates: Record<string, string>;
  academicAssignmentDates: Record<string, string>;
};

const COMPLETION_INSIGHTS_STORAGE_KEY = "campus-life-os.completion-insights.v1";

const defaultCompletionInsightsState: CompletionInsightsState = {
  plannerTaskDates: {},
  academicAssignmentDates: {},
};

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateMap(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (dates, [key, date]) => {
      if (typeof key !== "string" || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return dates;
      }

      dates[key] = date;
      return dates;
    },
    {},
  );
}

function normalizeStoredState(value: unknown): CompletionInsightsState {
  if (!value || typeof value !== "object") {
    return defaultCompletionInsightsState;
  }

  const parsed = value as Partial<CompletionInsightsState>;

  return {
    plannerTaskDates: normalizeDateMap(parsed.plannerTaskDates),
    academicAssignmentDates: normalizeDateMap(parsed.academicAssignmentDates),
  };
}

function readCompletionInsightsState() {
  if (typeof window === "undefined") {
    return defaultCompletionInsightsState;
  }

  try {
    const raw = window.localStorage.getItem(COMPLETION_INSIGHTS_STORAGE_KEY);
    if (!raw) {
      return defaultCompletionInsightsState;
    }

    return normalizeStoredState(JSON.parse(raw));
  } catch {
    return defaultCompletionInsightsState;
  }
}

function persistCompletionInsightsState(state: CompletionInsightsState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPLETION_INSIGHTS_STORAGE_KEY, JSON.stringify(state));
}

function getAssignmentKey(courseId: string, assignmentId: string) {
  return `${courseId}:${assignmentId}`;
}

function syncCompletionInsightsState(tasks: PlannerTask[], courses: Course[]) {
  const currentState = readCompletionInsightsState();
  const today = toLocalDateString(new Date());

  const completedPlannerTaskIds = new Set(tasks.filter((task) => task.completed).map((task) => task.id));
  const completedAcademicAssignmentKeys = new Set(
    courses.flatMap((course) =>
      course.assignments
        .filter((assignment) => assignment.status === "completed")
        .map((assignment) => getAssignmentKey(course.id, assignment.id)),
    ),
  );

  let didChange = false;

  const plannerTaskDates = Object.fromEntries(
    Object.entries(currentState.plannerTaskDates).filter(([taskId]) => completedPlannerTaskIds.has(taskId)),
  );
  if (Object.keys(plannerTaskDates).length !== Object.keys(currentState.plannerTaskDates).length) {
    didChange = true;
  }

  for (const taskId of completedPlannerTaskIds) {
    if (plannerTaskDates[taskId]) {
      continue;
    }

    plannerTaskDates[taskId] = today;
    didChange = true;
  }

  const academicAssignmentDates = Object.fromEntries(
    Object.entries(currentState.academicAssignmentDates).filter(([assignmentKey]) =>
      completedAcademicAssignmentKeys.has(assignmentKey),
    ),
  );
  if (
    Object.keys(academicAssignmentDates).length !==
    Object.keys(currentState.academicAssignmentDates).length
  ) {
    didChange = true;
  }

  for (const assignmentKey of completedAcademicAssignmentKeys) {
    if (academicAssignmentDates[assignmentKey]) {
      continue;
    }

    academicAssignmentDates[assignmentKey] = today;
    didChange = true;
  }

  const nextState = {
    plannerTaskDates,
    academicAssignmentDates,
  };

  if (didChange) {
    persistCompletionInsightsState(nextState);
  }

  return nextState;
}

function isDateInCurrentWeek(value: string) {
  const currentDate = new Date();
  const startOfWeek = new Date(currentDate);
  const dayOfWeek = startOfWeek.getDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  startOfWeek.setDate(startOfWeek.getDate() + offset);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const targetDate = new Date(`${value}T12:00:00`);
  return targetDate.getTime() >= startOfWeek.getTime() && targetDate.getTime() < endOfWeek.getTime();
}

export function useCompletionInsights(tasks: PlannerTask[], courses: Course[], isReady: boolean) {
  const [state, setState] = useState<CompletionInsightsState>(defaultCompletionInsightsState);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const nextState = syncCompletionInsightsState(tasks, courses);

    startTransition(() => {
      setState(nextState);
      setHasHydrated(true);
    });
  }, [courses, isReady, tasks]);

  const summary = useMemo(
    () => ({
      plannerItemsCompletedThisWeek: Object.values(state.plannerTaskDates).filter(isDateInCurrentWeek).length,
      academicAssignmentsCompletedThisWeek: Object.values(state.academicAssignmentDates).filter(
        isDateInCurrentWeek,
      ).length,
    }),
    [state],
  );

  return {
    hasHydrated,
    ...summary,
  };
}
