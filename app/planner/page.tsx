"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Card, { Card as InfoCard, MetricRow } from "@/components/ui/card";
import { Assignment } from "@/lib/academics/types";
import { formatDate } from "@/lib/academics/utils";
import { useCourses } from "@/lib/academics/useCourses";
import { recordTaskCompletion } from "@/lib/streak";
import {
  addTask as addSupabaseTask,
  archiveTask,
  fetchTasks,
  updateTaskCompletion,
  type SupabaseTask,
} from "@/lib/supabase/tasks";
import { getSupabaseOffline, setSupabaseOffline } from "@/lib/supabase/offline";
import {
  PlannerTaskCategory,
  PlannerTaskPriority,
  plannerTaskCategories,
  usePlannerTasks,
} from "@/lib/planner/usePlannerTasks";
import { createClient } from "@/lib/supabase/client";
import { useScrollLock } from "@/lib/ui/useScrollLock";

const supabase = createClient();

type PlannerBucket = "Overdue" | "Today" | "This Week" | "Later";
type PlannerFilter = "All" | PlannerTaskCategory;
type PlannerAssignmentItem = Assignment & {
  itemType: "assignment";
  bucket: PlannerBucket;
  courseName: string;
  title: string;
  displayCategory: "Academics";
  priority: PlannerTaskPriority;
};
type PlannerTaskItem = {
  id: string;
  itemType: "task";
  bucket: PlannerBucket;
  dueDate: string;
  title: string;
  displayCategory: PlannerTaskCategory;
  priority: PlannerTaskPriority;
  completed: boolean;
  note?: string;
};
type PlannerItem = PlannerAssignmentItem | PlannerTaskItem;

type TaskDraft = {
  title: string;
  dueDate: string;
  category: PlannerTaskCategory;
  note: string;
};
type PlannerCompletionFeedback = {
  id: number;
  message: string;
};
type PlannerAuthStatus = "loading" | "authenticated" | "unauthenticated" | "offline";

const bucketOrder: PlannerBucket[] = ["Overdue", "Today", "This Week", "Later"];
const plannerFilters: PlannerFilter[] = [
  "All",
  ...plannerTaskCategories.filter((category) => category !== "Money"),
] as PlannerFilter[];
const plannerPriorities: PlannerTaskPriority[] = ["P1", "P2", "P3"];
const completionFadeDurationMs = 420;
const completionFeedbackFadeDurationMs = 220;
const completionFeedbackDurationMs = 1900;
const plannerPriorityRank: Record<PlannerTaskPriority, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
};
const taskCategoryClasses: Record<PlannerTaskCategory | "Academics", string> = {
  Academics: "semantic-primary",
  Fitness: "semantic-success",
  Money: "semantic-warning",
  Personal: "semantic-neutral",
};
const priorityBadgeClasses: Record<PlannerTaskPriority, string> = {
  P1: "semantic-danger",
  P2: "semantic-warning",
  P3: "semantic-neutral",
};
const priorityTitleClasses: Record<PlannerTaskPriority, string> = {
  P1: "text-white",
  P2: "text-white",
  P3: "text-white/80",
};
const sourceBadgeClassName =
  "semantic-violet px-2 py-1 text-[11px] font-medium uppercase tracking-[0.22em]";
const plannerInfoCardClassName = "rounded-[14px] sm:rounded-[24px]";
const plannerFieldClassName =
  "system-input mt-1 px-2.5 py-1.5 text-sm placeholder:text-white/30 sm:px-3 sm:py-2";
const plannerSecondaryButtonClassName =
  "system-button-secondary w-full px-3 py-2 text-sm font-medium disabled:bg-[#050506] sm:w-auto sm:px-4 sm:py-2.5";
const plannerPrimaryButtonClassName =
  "system-button-primary w-full px-3 py-2 text-sm font-semibold sm:w-auto sm:px-4 sm:py-2.5";
const plannerSectionDividerClassName = "mt-5 border-t border-white/[0.045] pt-3 sm:mt-14 sm:border-white/[0.055] sm:pt-7";

function createTaskDraft(): TaskDraft {
  return {
    title: "",
    dueDate: new Date().toISOString().slice(0, 10),
    category: "Personal",
    note: "",
  };
}

function toCalendarDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isTimestampToday(value: string) {
  const timestamp = new Date(value);
  const today = new Date();

  return (
    timestamp.getFullYear() === today.getFullYear() &&
    timestamp.getMonth() === today.getMonth() &&
    timestamp.getDate() === today.getDate()
  );
}

function getPlannerBucket(dueDate: string, today: Date): PlannerBucket {
  const due = toCalendarDay(dueDate);
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  if (due.getTime() < today.getTime()) {
    return "Overdue";
  }

  if (due.getTime() === today.getTime()) {
    return "Today";
  }

  if (due.getTime() <= sevenDaysOut.getTime()) {
    return "This Week";
  }

  return "Later";
}

function getAssignmentPriorityKey(courseId: string, assignmentId: string) {
  return `${courseId}:${assignmentId}`;
}

function getPlannerItemKey(item: PlannerItem) {
  return `${item.itemType}-${item.id}`;
}

function mapSupabaseTaskCategory(category: string): PlannerTaskCategory {
  return plannerTaskCategories.includes(category as PlannerTaskCategory)
    ? (category as PlannerTaskCategory)
    : "Personal";
}

function getPlannerItemContext(item: PlannerItem) {
  return item.itemType === "assignment"
    ? `${item.courseName} • due ${formatDate(item.dueDate)}`
    : `${item.displayCategory} • due ${formatDate(item.dueDate)}`;
}

function getPlannerItemInsight(item: PlannerItem | null) {
  if (!item) {
    return {
      eyebrow: "Board clear",
      description: "No open items right now. Use the breathing room to plan the next milestone.",
    };
  }

  if (item.bucket === "Overdue") {
    return {
      eyebrow: "Recover this first",
      description: "This item is already slipping. Clear it before you take on anything lower leverage.",
    };
  }

  if (item.bucket === "Today") {
    return {
      eyebrow: "Protect this deadline",
      description: "This closes today. Finish it before you open something new and split your attention.",
    };
  }

  if (item.bucket === "This Week") {
    return {
      eyebrow: "Get ahead now",
      description: "You still have room to finish early. A short push here keeps the week lighter later.",
    };
  }

  return {
    eyebrow: "Use the runway",
    description: "Nothing is on fire yet. Pull this forward now to keep the board calm.",
  };
}

export default function PlannerPage() {
  const { courses, setCourses, hasHydrated } = useCourses();
  const {
    tasks: localPlannerTasks,
    addTask: addLocalPlannerTask,
    markTaskComplete: markLocalPlannerTaskComplete,
    updateTaskPriority,
    hasHydrated: hasPlannerTasksHydrated,
  } = usePlannerTasks();
  const [authStatus, setAuthStatus] = useState<PlannerAuthStatus>("loading");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [supabaseTasks, setSupabaseTasks] = useState<SupabaseTask[]>([]);
  const [hasLoadedSupabaseTasks, setHasLoadedSupabaseTasks] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(createTaskDraft);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PlannerFilter>("All");
  const [assignmentPriorities, setAssignmentPriorities] = useState<
    Record<string, PlannerTaskPriority>
  >({});
  const [taskPriorities, setTaskPriorities] = useState<Record<string, PlannerTaskPriority>>({});
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusedItemKey, setFocusedItemKey] = useState<string | null>(null);
  const [completionFeedback, setCompletionFeedback] =
    useState<PlannerCompletionFeedback | null>(null);
  const [isCompletionFeedbackVisible, setIsCompletionFeedbackVisible] = useState(false);
  const [completingItemKeys, setCompletingItemKeys] = useState<string[]>([]);
  const completingItemKeysRef = useRef<string[]>([]);
  const completionTimeoutIdsRef = useRef<Record<string, number>>({});
  const loadedSupabaseTasksForUserRef = useRef<string | null>(null);
  const isAuthenticated = authStatus === "authenticated";
  const isOffline = authStatus === "offline" || getSupabaseOffline();
  const isReady =
    hasHydrated &&
    hasPlannerTasksHydrated &&
    (isOffline || authStatus !== "loading") &&
    (!isAuthenticated || hasLoadedSupabaseTasks);
  useScrollLock(isAddTaskOpen, "(max-width: 767px)");

  const loadSupabaseTasks = useCallback(async (userId = sessionUserId) => {
    if (!userId) {
      setSupabaseTasks([]);
      setHasLoadedSupabaseTasks(true);
      return;
    }

    try {
      const data = await fetchTasks(userId);
      if (getSupabaseOffline()) {
        setAuthStatus("offline");
        setSessionUserId(null);
        setSupabaseTasks([]);
        return;
      }

      setSupabaseTasks(data ?? []);
    } catch {
      setSupabaseOffline(true);
      setAuthStatus("offline");
      setSessionUserId(null);
      setSupabaseTasks([]);
    } finally {
      setHasLoadedSupabaseTasks(true);
    }
  }, [sessionUserId]);

  useEffect(() => {
    completingItemKeysRef.current = completingItemKeys;
  }, [completingItemKeys]);

  useEffect(() => {
    if (!completionFeedback) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsCompletionFeedbackVisible(true);
    });
    const fadeOutId = window.setTimeout(() => {
      setIsCompletionFeedbackVisible(false);
    }, completionFeedbackDurationMs - completionFeedbackFadeDurationMs);
    const timeoutId = window.setTimeout(() => {
      setCompletionFeedback(null);
    }, completionFeedbackDurationMs);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(fadeOutId);
      window.clearTimeout(timeoutId);
    };
  }, [completionFeedback]);

  useEffect(() => {
    const timeoutIds = completionTimeoutIdsRef.current;
    return () => {
      Object.values(timeoutIds).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fallbackTimeoutId = window.setTimeout(() => {
      if (isMounted) {
        setAuthStatus(getSupabaseOffline() ? "offline" : "unauthenticated");
        setSessionUserId(null);
      }
    }, 1500);

    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const authState = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          if (!isMounted) {
            return;
          }

          window.clearTimeout(fallbackTimeoutId);

          if (!session?.user) {
            setAuthStatus(getSupabaseOffline() ? "offline" : "unauthenticated");
            setSessionUserId(null);
            return;
          }

          setSupabaseOffline(false);
          setSessionUserId(session.user.id);
          setAuthStatus("authenticated");
        },
      );

      subscription = authState.data.subscription;
    } catch {
      setSupabaseOffline(true);
      setAuthStatus("offline");
      setSessionUserId(null);
      window.clearTimeout(fallbackTimeoutId);
    }

    return () => {
      isMounted = false;
      window.clearTimeout(fallbackTimeoutId);
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated" || !sessionUserId) {
      return;
    }

    if (loadedSupabaseTasksForUserRef.current === sessionUserId) {
      return;
    }

    loadedSupabaseTasksForUserRef.current = sessionUserId;
    setHasLoadedSupabaseTasks(false);

    const timeoutId = window.setTimeout(() => {
      void loadSupabaseTasks(sessionUserId);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authStatus, loadSupabaseTasks, sessionUserId]);

  const activeSupabaseTasks = useMemo(
    () => supabaseTasks.filter((task) => !task.archived),
    [supabaseTasks],
  );

  const openSupabaseTasks = useMemo(
    () => activeSupabaseTasks.filter((task) => !task.completed),
    [activeSupabaseTasks],
  );

  const completedTodayTasks = useMemo(
    () =>
      activeSupabaseTasks.filter(
        (task) => task.completed && Boolean(task.completed_at) && isTimestampToday(task.completed_at!),
      ),
    [activeSupabaseTasks],
  );

  const planner = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const incompleteAssignments: PlannerAssignmentItem[] = courses
      .flatMap((course) =>
        course.assignments.map((assignment) => ({
          ...assignment,
          itemType: "assignment" as const,
          bucket: getPlannerBucket(assignment.dueDate, today),
          courseName: course.name,
          title: assignment.name,
          displayCategory: "Academics" as const,
          priority:
            assignmentPriorities[getAssignmentPriorityKey(assignment.courseId, assignment.id)] ??
            "P2",
        })),
      )
      .filter((assignment) => assignment.status !== "completed");

    const incompleteTasks: PlannerTaskItem[] = (isAuthenticated
      ? openSupabaseTasks.map((task) => ({
        id: task.id,
        itemType: "task" as const,
        bucket: getPlannerBucket(task.due_date, today),
        dueDate: task.due_date,
        title: task.title,
        displayCategory: mapSupabaseTaskCategory(task.category),
        priority: taskPriorities[task.id] ?? "P2",
        completed: task.completed,
        note: task.note ?? undefined,
      }))
      : localPlannerTasks
          .filter((task) => !task.completed)
          .map((task) => ({
            id: task.id,
            itemType: "task" as const,
            bucket: getPlannerBucket(task.dueDate, today),
            dueDate: task.dueDate,
            title: task.title,
            displayCategory: task.category,
            priority: taskPriorities[task.id] ?? task.priority,
            completed: task.completed,
            note: task.note,
          })));

    const incompleteItems: PlannerItem[] = [...incompleteAssignments, ...incompleteTasks].sort(
      (a, b) => {
        const priorityDifference = plannerPriorityRank[a.priority] - plannerPriorityRank[b.priority];
        if (priorityDifference !== 0) return priorityDifference;

        const dateDifference = toCalendarDay(a.dueDate).getTime() - toCalendarDay(b.dueDate).getTime();
        if (dateDifference !== 0) return dateDifference;
        return (a.title ?? "").localeCompare(b.title ?? "");
      },
    );

    const grouped = bucketOrder.reduce<Record<PlannerBucket, PlannerItem[]>>(
      (accumulator, bucket) => {
        accumulator[bucket] = incompleteItems.filter((item) => item.bucket === bucket);
        return accumulator;
      },
      {
        Overdue: [],
        Today: [],
        "This Week": [],
        Later: [],
      },
    );

    return {
      grouped,
      incompleteItems,
    };
  }, [assignmentPriorities, courses, isAuthenticated, localPlannerTasks, openSupabaseTasks, taskPriorities]);

  const filteredPlanner = useMemo(() => {
    const visibleItems =
      activeFilter === "All"
        ? planner.incompleteItems
        : planner.incompleteItems.filter((item) => item.displayCategory === activeFilter);

    const grouped = bucketOrder.reduce<Record<PlannerBucket, PlannerItem[]>>(
      (accumulator, bucket) => {
        accumulator[bucket] = visibleItems.filter((item) => item.bucket === bucket);
        return accumulator;
      },
      {
        Overdue: [],
        Today: [],
        "This Week": [],
        Later: [],
      },
    );

    return {
      grouped,
      visibleItems,
    };
  }, [activeFilter, planner]);

  const mostImportantItem = useMemo(() => {
    for (const bucket of bucketOrder) {
      const candidate = filteredPlanner.grouped[bucket][0];
      if (candidate) {
        return candidate;
      }
    }

    return null;
  }, [filteredPlanner]);

  const mostImportantItemKey = mostImportantItem ? getPlannerItemKey(mostImportantItem) : null;

  const focusedPlannerItem = useMemo(() => {
    const visibleItemsByKey = new Map(
      filteredPlanner.visibleItems.map((item) => [getPlannerItemKey(item), item]),
    );

    if (!isFocusMode) {
      return mostImportantItem;
    }

    if (focusedItemKey && visibleItemsByKey.has(focusedItemKey)) {
      return visibleItemsByKey.get(focusedItemKey) ?? mostImportantItem;
    }

    return mostImportantItemKey && visibleItemsByKey.has(mostImportantItemKey)
      ? (visibleItemsByKey.get(mostImportantItemKey) ?? null)
      : mostImportantItem;
  }, [filteredPlanner.visibleItems, focusedItemKey, isFocusMode, mostImportantItem, mostImportantItemKey]);

  const plannerInsight = getPlannerItemInsight(focusedPlannerItem);
  const plannerSecondarySectionClassName = isFocusMode
    ? "transition-all duration-300 opacity-40 blur-[2px]"
    : "transition-all duration-300 opacity-100 blur-0";

  const markAssignmentComplete = (courseId: string, assignmentId: string) => {
    recordTaskCompletion();
    setCourses((previousCourses) =>
      previousCourses.map((course) => {
        if (course.id !== courseId) {
          return course;
        }

        return {
          ...course,
          assignments: course.assignments.map((assignment) =>
            assignment.id === assignmentId
              ? {
                  ...assignment,
                  status: "completed",
                }
              : assignment,
          ),
        };
      }),
    );
  };

  const finishPlannerItemCompletion = async (item: PlannerItem) => {
    if (item.itemType === "assignment") {
      markAssignmentComplete(item.courseId, item.id);
      return;
    }

    if (!isAuthenticated) {
      markLocalPlannerTaskComplete(item.id);
      return;
    }

    const updatedTask = await updateTaskCompletion(item.id, true, sessionUserId);
    if (updatedTask?.completed) {
      recordTaskCompletion();
    }

    await loadSupabaseTasks();
  };

  const updatePlannerItemPriority = (item: PlannerItem, priority: PlannerTaskPriority) => {
    if (item.itemType === "assignment") {
      setAssignmentPriorities((previous) => ({
        ...previous,
        [getAssignmentPriorityKey(item.courseId, item.id)]: priority,
      }));
      return;
    }

    setTaskPriorities((previous) => ({
      ...previous,
      [item.id]: priority,
    }));
    updateTaskPriority(item.id, priority);
  };

  const completePlannerItems = (items: PlannerItem[]) => {
    const pendingItems = items.filter(
      (item) => !completingItemKeysRef.current.includes(getPlannerItemKey(item)),
    );
    if (pendingItems.length === 0) {
      return;
    }

    const pendingItemKeys = pendingItems.map(getPlannerItemKey);
    setCompletingItemKeys((previous) => {
      const next = [...previous, ...pendingItemKeys.filter((key) => !previous.includes(key))];
      completingItemKeysRef.current = next;
      return next;
    });
    setIsCompletionFeedbackVisible(false);
    setCompletionFeedback({
      id: Date.now(),
      message:
        pendingItems.length === 1
          ? "Task completed ✓"
          : `Completed - +${pendingItems.length} progress`,
    });

    pendingItems.forEach((item, index) => {
      const itemKey = pendingItemKeys[index];
      completionTimeoutIdsRef.current[itemKey] = window.setTimeout(async () => {
        delete completionTimeoutIdsRef.current[itemKey];
        await finishPlannerItemCompletion(item);
        setCompletingItemKeys((previous) => {
          const next = previous.filter((key) => key !== itemKey);
          completingItemKeysRef.current = next;
          return next;
        });
      }, completionFadeDurationMs);
    });
  };

  const markPlannerItemComplete = (item: PlannerItem) => {
    completePlannerItems([item]);
  };

  const handleFocusModeToggle = () => {
    if (isFocusMode) {
      setIsFocusMode(false);
      return;
    }

    setFocusedItemKey(mostImportantItemKey);
    setIsFocusMode(true);
  };

  const handleAddTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const { title, dueDate, category, note } = taskDraft;
    const normalizedTitle = title.trim();
    const normalizedNote = note.trim();
    if (!normalizedTitle || !dueDate) {
      return;
    }

    if (!isAuthenticated) {
      addLocalPlannerTask({
        title: normalizedTitle,
        dueDate,
        category,
        note: normalizedNote || undefined,
      });
      setTaskDraft(createTaskDraft());
      setIsAddTaskOpen(false);
      return;
    }

    const createdTask = await addSupabaseTask(
      {
        title: normalizedTitle,
        due_date: dueDate,
        category,
        note: normalizedNote || undefined,
      },
      sessionUserId,
    );

    if (!createdTask) {
      return;
    }

    await loadSupabaseTasks();
    setTaskDraft(createTaskDraft());
    setIsAddTaskOpen(false);
  };

  if (authStatus === "loading") {
    return (
      <InfoCard
        title="Checking access"
        subtitle="Planner authentication"
        className={plannerInfoCardClassName}
        variant="dark"
      >
        <p className="text-sm text-white/50">
          Verifying your session before loading planner data...
        </p>
      </InfoCard>
    );
  }

  return (
    <div className="animate-fadeIn space-y-2.5 pb-22 sm:space-y-5 md:space-y-6 md:pb-6 lg:space-y-7">
      <section className="space-y-1">
        <h2 className="system-page-heading text-[1.3rem] md:text-[2rem]">
          Planner
        </h2>
        <p className="system-page-copy max-w-2xl text-[0.82rem] leading-5 sm:text-sm sm:leading-6">
          Course assignments and your tasks.
        </p>
        <div className="system-tab-rail mt-2 -mx-0.5 flex max-w-full items-center gap-1 overflow-x-auto rounded-[14px] p-1 [scrollbar-width:none] sm:mx-0 sm:mt-5 sm:w-fit sm:flex-wrap sm:gap-2 sm:rounded-[20px] sm:p-1.5 [&::-webkit-scrollbar]:hidden">
          <span className="system-label shrink-0 pl-1 text-white/45">Filter</span>
          {plannerFilters.map((filter) => {
            const isActive = filter === activeFilter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`system-segmented-tab min-h-8 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:min-h-[44px] sm:px-4 sm:py-2 sm:text-sm ${
                  isActive
                    ? "system-selected-control"
                    : ""
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] sm:mt-3 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => completePlannerItems(filteredPlanner.grouped.Overdue)}
            disabled={!isReady || filteredPlanner.grouped.Overdue.length === 0}
            className={`${plannerSecondaryButtonClassName} min-h-8 shrink-0 px-2.5 py-1 text-xs sm:min-h-10 sm:px-4 sm:py-2.5 sm:text-sm`}
          >
            Complete all overdue
          </button>
          <button
            type="button"
            onClick={() => completePlannerItems(filteredPlanner.grouped.Today)}
            disabled={!isReady || filteredPlanner.grouped.Today.length === 0}
            className={`${plannerSecondaryButtonClassName} min-h-8 shrink-0 px-2.5 py-1 text-xs sm:min-h-10 sm:px-4 sm:py-2.5 sm:text-sm`}
          >
            Complete all today
          </button>
          <button
            type="button"
            onClick={handleFocusModeToggle}
            disabled={!isReady || !mostImportantItem}
            className={`${plannerSecondaryButtonClassName} min-h-8 shrink-0 px-2.5 py-1 text-xs sm:min-h-10 sm:px-4 sm:py-2.5 sm:text-sm ${
              isFocusMode ? "system-selected-control" : ""
            }`}
          >
            {isFocusMode ? "Exit focus mode" : "Enter focus mode"}
          </button>
        </div>
        {completionFeedback ? (
          <div
            role="status"
            aria-live="polite"
            className={`system-subtle-panel system-card-positive mt-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-white transition-all duration-200 sm:mt-4 sm:px-4 sm:py-3 ${
              isCompletionFeedbackVisible
                ? "translate-y-0 opacity-100"
                : "-translate-y-1 opacity-0"
            }`}
          >
            {completionFeedback.message}
          </div>
        ) : null}
        <div
          className={`system-panel system-command-card system-card-interactive rounded-[14px] px-2.5 py-2.5 sm:rounded-[22px] sm:px-5 sm:py-4 ${
            isFocusMode ? "system-focus-active" : ""
          } ${
            focusedPlannerItem?.bucket === "Overdue" ? "system-card-priority" : ""
          }`}
        >
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="system-label text-white/45">{isFocusMode ? "Focus mode target" : plannerInsight.eyebrow}</p>
              <p className="mt-1 line-clamp-2 text-[0.9rem] font-semibold text-white sm:mt-2 sm:text-lg">
                {focusedPlannerItem ? focusedPlannerItem.title : "No open items"}
              </p>
              <p className="mt-0.5 text-xs text-white/60 sm:mt-1 sm:text-sm">
                {focusedPlannerItem
                  ? getPlannerItemContext(focusedPlannerItem)
                  : "Use the planner to add the next concrete milestone."}
              </p>
              <p className="mt-1 text-xs leading-4 text-white/50 sm:mt-2 sm:text-sm sm:leading-6">{plannerInsight.description}</p>
            </div>
            {focusedPlannerItem ? (
              <div className="flex shrink-0 flex-wrap gap-1.5 sm:gap-2">
                <span className={`px-2.5 py-0.5 text-[11px] font-semibold sm:px-3 sm:py-1 sm:text-xs ${priorityBadgeClasses[focusedPlannerItem.priority]}`}>
                  {focusedPlannerItem.priority}
                </span>
                <span className="system-pill px-2.5 py-0.5 text-[11px] font-semibold text-white/70 sm:px-3 sm:py-1 sm:text-xs">
                  {focusedPlannerItem.bucket}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <InfoCard
        title="Add task"
        subtitle="Add a personal planner item"
        className={`${plannerInfoCardClassName} ${plannerSectionDividerClassName} ${plannerSecondarySectionClassName}`}
        variant="dark"
      >
        <button
          type="button"
          onClick={() => setIsAddTaskOpen((current) => !current)}
          className="system-button-secondary flex min-h-8 w-full items-center justify-center rounded-[11px] px-3 py-1 text-xs font-medium md:hidden"
          aria-expanded={isAddTaskOpen}
        >
          {isAddTaskOpen ? "Close add task" : "Add a task"}
        </button>
        {isAddTaskOpen ? (
          <button
            type="button"
            aria-label="Close add task panel"
            className="fixed inset-0 z-[55] bg-black/72 md:hidden"
            onClick={() => setIsAddTaskOpen(false)}
          />
        ) : null}
        <form
          data-scroll-lock-scrollable="true"
          className={`${
            isAddTaskOpen
              ? "fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.55rem)] z-[60] mx-auto block max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] max-w-lg overflow-y-auto rounded-t-[20px] border border-white/[0.12] bg-[#030406]/[0.98] p-3 shadow-[0_-22px_70px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,255,255,0.08)] md:static md:max-h-none md:max-w-none md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
              : "hidden"
          } space-y-2 md:block md:space-y-3`}
          onSubmit={handleAddTask}
        >
          <div className="mb-1 flex items-center justify-between gap-3 md:hidden">
            <div>
              <p className="system-label text-white/45">Planner</p>
              <p className="text-sm font-semibold text-white">Add task</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddTaskOpen(false)}
              className="system-button-subtle px-2.5 py-1.5 text-sm text-white/65"
            >
              X
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <label className="system-label text-white/45">
              Title
              <input
                required
                value={taskDraft.title}
                onChange={(event) =>
                  setTaskDraft((previous) => ({ ...previous, title: event.target.value }))
                }
                className={plannerFieldClassName}
              />
            </label>

            <label className="system-label text-white/45">
              Due date
              <input
                required
                type="date"
                value={taskDraft.dueDate}
                onChange={(event) =>
                  setTaskDraft((previous) => ({ ...previous, dueDate: event.target.value }))
                }
                className={plannerFieldClassName}
              />
            </label>

            <label className="system-label text-white/45">
              Category
              <select
                value={taskDraft.category}
                onChange={(event) =>
                  setTaskDraft((previous) => ({
                    ...previous,
                    category: event.target.value as PlannerTaskCategory,
                  }))
                }
                className={plannerFieldClassName}
              >
                {plannerTaskCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="system-label text-white/45 sm:col-span-2">
              Note (optional)
              <textarea
                rows={2}
                value={taskDraft.note}
                onChange={(event) =>
                  setTaskDraft((previous) => ({ ...previous, note: event.target.value }))
                }
                className={plannerFieldClassName}
              />
            </label>
          </div>

          <button type="submit" className={plannerPrimaryButtonClassName}>
            Add task
          </button>
        </form>
      </InfoCard>

      <section
        className={`hidden grid-cols-2 gap-1.5 sm:grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-5 ${plannerSectionDividerClassName} ${plannerSecondarySectionClassName}`}
      >
        <InfoCard
          title="Open items"
          subtitle="Assignments and tasks"
          className={`${plannerInfoCardClassName} min-w-0`}
          variant="dark"
        >
          <MetricRow
            label="Total"
            value={isReady ? String(filteredPlanner.visibleItems.length) : "—"}
            variant="dark"
          />
        </InfoCard>
        <InfoCard
          title="Overdue"
          subtitle="Past due"
          className={`${plannerInfoCardClassName} min-w-0 ${
            filteredPlanner.grouped.Overdue.length > 0 ? "system-card-priority" : ""
          }`}
          variant="dark"
        >
          <MetricRow
            label="Count"
            value={isReady ? String(filteredPlanner.grouped.Overdue.length) : "—"}
            variant="dark"
          />
        </InfoCard>
        <InfoCard
          title="Today"
          subtitle="Due today"
          className={`${plannerInfoCardClassName} min-w-0`}
          variant="dark"
        >
          <MetricRow
            label="Count"
            value={isReady ? String(filteredPlanner.grouped.Today.length) : "—"}
            variant="dark"
          />
        </InfoCard>
        <InfoCard
          title="This Week"
          subtitle="Due in the next 7 days"
          className={`${plannerInfoCardClassName} min-w-0`}
          variant="dark"
        >
          <MetricRow
            label="Count"
            value={isReady ? String(filteredPlanner.grouped["This Week"].length) : "—"}
            variant="dark"
          />
        </InfoCard>
        <InfoCard
          title="Later"
          subtitle="Beyond the next 7 days"
          className={`${plannerInfoCardClassName} min-w-0 col-span-2 sm:col-span-1 ${
            filteredPlanner.grouped.Later.length === filteredPlanner.visibleItems.length &&
            filteredPlanner.visibleItems.length > 0
              ? "system-card-positive"
              : ""
          }`}
          variant="dark"
        >
          <MetricRow
            label="Count"
            value={isReady ? String(filteredPlanner.grouped.Later.length) : "—"}
            variant="dark"
          />
        </InfoCard>
      </section>

      {!isReady ? (
        <InfoCard
          title="Planner loading"
          subtitle="Reading saved planner data"
          className={`${plannerInfoCardClassName} ${plannerSectionDividerClassName} ${plannerSecondarySectionClassName}`}
          variant="dark"
        >
          <p className="text-sm text-white/50">Loading assignments and tasks...</p>
        </InfoCard>
      ) : planner.incompleteItems.length === 0 ? (
        <InfoCard
          title="All caught up"
          subtitle="No open planner items"
          className={`${plannerInfoCardClassName} system-card-positive ${plannerSectionDividerClassName} ${plannerSecondarySectionClassName}`}
          variant="dark"
        >
          <p className="text-sm text-white/50">
            Every assignment and custom task is complete. Add the next milestone before it sneaks
            up on you.
          </p>
        </InfoCard>
      ) : filteredPlanner.visibleItems.length === 0 ? (
        <InfoCard
          title="No matching items"
          subtitle={`${activeFilter} items only`}
          className={`${plannerInfoCardClassName} ${plannerSectionDividerClassName} ${plannerSecondarySectionClassName}`}
          variant="dark"
        >
          <p className="text-sm text-white/50">
            No open {activeFilter.toLowerCase()} items right now. Reset the filter to pick the next
            best move across the full board.
          </p>
        </InfoCard>
      ) : (
        <section className={`system-panel system-command-card relative space-y-3 rounded-[16px] p-2.5 ${plannerSectionDividerClassName} sm:space-y-5 sm:rounded-[24px] sm:p-5 md:space-y-6 md:p-6`}>
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          <div
            className={`system-inset-panel system-card-interactive hidden flex-wrap items-center gap-2 rounded-[18px] px-3 py-2 text-xs text-white/58 sm:flex ${
              isFocusMode ? "system-focus-dim" : ""
            }`}
          >
            <span>Planner shows both course assignments and your own tasks.</span>
            <span className={sourceBadgeClassName}>Course Assignment</span>
            <span className={sourceBadgeClassName}>My Task</span>
          </div>
          {bucketOrder.map((bucket, index) => {
            const items = filteredPlanner.grouped[bucket];
            return (
              <div key={bucket} className="space-y-1.5 sm:space-y-3">
                <div
                  className={`flex items-center justify-between gap-3 ${
                    index === 0 ? "" : "mt-2 sm:mt-6"
                  }`}
                >
                  <h3 className="text-[0.92rem] font-semibold text-white sm:text-lg">{bucket}</h3>
                  <span className="system-pill px-2 py-0.5 text-[11px] font-semibold text-white/58 sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:text-white/45 sm:shadow-none">
                    {items.length} open item{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="hidden text-sm text-white/35 sm:block">
                    Nothing here. Pull forward work from the next bucket if you want more margin.
                  </p>
                ) : (
                  <div className="space-y-1.5 sm:space-y-3">
                    {items.map((item, itemIndex) => {
                      const itemKey = getPlannerItemKey(item);
                      const isOverdue = item.bucket === "Overdue";
                      const isCompleting = completingItemKeys.includes(getPlannerItemKey(item));
                      const isFocusedItem =
                        isFocusMode &&
                        focusedPlannerItem &&
                        getPlannerItemKey(focusedPlannerItem) === itemKey;
                      const isAtRisk = isOverdue || item.priority === "P1";
                      return (
                        <div
                          key={itemKey}
                          className={`origin-top overflow-hidden transition-[opacity,transform,max-height] duration-[420ms] ease-out ${
                            isCompleting
                              ? "pointer-events-none max-h-0 -translate-y-2 scale-[0.985] opacity-0"
                              : "max-h-[32rem] translate-y-0 scale-100 opacity-100"
                          }`}
                        >
                          <div
                            className="animate-fadeIn opacity-0"
                            style={{ animationDelay: `${itemIndex * 50}ms` }}
                          >
                            <Card
                              onClick={
                                isFocusMode ? () => setFocusedItemKey(itemKey) : undefined
                              }
                              className={`system-card-object flex flex-col items-start gap-2 p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3.5 ${
                                isAtRisk ? "system-card-priority" : ""
                              } ${
                                isFocusMode
                                  ? isFocusedItem
                                    ? "system-focus-active border-white/[0.14] bg-[#0d0d10]"
                                    : "system-focus-dim"
                                  : ""
                              } ${
                                isCompleting ? "opacity-40 scale-[0.98]" : ""
                              }`}
                            >
                              <div className="flex min-w-0 flex-1 flex-col">
                                <div className="flex flex-wrap items-start gap-1.5 sm:gap-2">
                                  <span
                                    className={`line-clamp-2 min-w-0 basis-full text-[0.84rem] font-semibold leading-4 sm:basis-auto sm:text-base sm:leading-normal ${
                                      isCompleting
                                        ? "line-through text-white/35"
                                        : priorityTitleClasses[item.priority]
                                    }`}
                                  >
                                    {item.title}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-xs ${taskCategoryClasses[item.displayCategory]}`}
                                  >
                                    {item.displayCategory}
                                  </span>
                                  <span className={`${sourceBadgeClassName} hidden sm:inline-flex`}>
                                    {item.itemType === "assignment" ? "Course Assignment" : "My Task"}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-xs ${priorityBadgeClasses[item.priority]}`}
                                  >
                                    {item.priority}
                                  </span>
                                  {isOverdue ? (
                                    <span className="semantic-danger px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-xs">
                                      Overdue
                                    </span>
                                  ) : null}
                                  {isFocusedItem ? (
                                    <span className="semantic-primary px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-xs">
                                      Active
                                    </span>
                                  ) : null}
                                </div>
                                <span className="mt-1 text-[0.72rem] leading-4 text-white/50 sm:text-xs sm:leading-5">
                                  {getPlannerItemContext(item)}
                                </span>
                                {item.itemType === "task" && item.note ? (
                                  <span className="mt-0.5 line-clamp-1 text-[0.72rem] leading-4 text-white/35 sm:mt-1 sm:text-xs sm:leading-5">{item.note}</span>
                                ) : null}
                              </div>
                              <div className="grid w-full shrink-0 grid-cols-1 items-center gap-1.5 sm:flex sm:w-auto sm:flex-row sm:gap-2">
                                <label className="sr-only" htmlFor={`priority-${item.itemType}-${item.id}`}>
                                  Priority
                                </label>
                                <select
                                  id={`priority-${item.itemType}-${item.id}`}
                                  value={item.priority}
                                  disabled={isCompleting}
                                  onChange={(event) =>
                                    updatePlannerItemPriority(
                                      item,
                                      event.target.value as PlannerTaskPriority,
                                    )
                                  }
                                  className="system-button-secondary min-h-8 w-full rounded-full px-2.5 py-1 text-xs sm:min-h-10 sm:w-auto sm:px-3 sm:py-2 sm:text-sm"
                                >
                                  {plannerPriorities.map((priority) => (
                                    <option key={priority} value={priority}>
                                      {priority}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  aria-label={
                                    isCompleting
                                      ? `${item.title} completed`
                                      : `Mark ${item.title} complete`
                                  }
                                  disabled={isCompleting}
                                  onClick={() => markPlannerItemComplete(item)}
                                  className="system-button-primary flex min-h-8 w-full items-center justify-center rounded-full px-2 text-xs font-semibold disabled:border-white/[0.06] disabled:bg-white/20 disabled:text-white/40 sm:h-11 sm:w-11 sm:px-0"
                                >
                                  <span className="sm:hidden">{isCompleting ? "Completing..." : "Complete"}</span>
                                  <span className="hidden sm:inline">{isCompleting ? "…" : "✓"}</span>
                                </button>
                              </div>
                            </Card>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <details className={`system-panel system-command-card group rounded-[14px] p-2.5 sm:hidden ${plannerSectionDividerClassName}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 outline-none focus-visible:ring-2 focus-visible:ring-white/20 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="system-label text-white/45">Planner metrics</p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {isReady ? `${filteredPlanner.visibleItems.length} open items` : "Loading"}
            </p>
          </div>
          <span className="system-pill shrink-0 px-2.5 py-1 text-[11px] font-semibold text-white/58 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {bucketOrder.map((bucket) => (
            <div key={bucket} className="system-stat-tile rounded-xl px-2.5 py-2">
              <p className="system-label text-white/45">{bucket}</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {isReady ? filteredPlanner.grouped[bucket].length : "—"}
              </p>
            </div>
          ))}
        </div>
      </details>

      <InfoCard
        title="Completed Today"
        subtitle="Supabase planner tasks"
        className={`${plannerInfoCardClassName} ${plannerSectionDividerClassName} ${plannerSecondarySectionClassName} ${
          completedTodayTasks.length > 0 ? "system-card-positive" : ""
        }`}
        variant="dark"
      >
        {completedTodayTasks.length === 0 ? (
          <p className="text-sm text-white/50">
            Complete one focused task and it will land here for quick review.
          </p>
        ) : (
          <div className="space-y-2">
            {completedTodayTasks.map((task) => (
              <div
                key={task.id}
                  className="system-subtle-panel system-card-interactive system-card-positive flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-white">
                  {task.title}
                </span>
                <span
                  className={`shrink-0 px-2 py-1 text-xs ${taskCategoryClasses[mapSupabaseTaskCategory(task.category)]}`}
                >
                  {mapSupabaseTaskCategory(task.category)}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await archiveTask(task.id, sessionUserId);
                    await loadSupabaseTasks();
                  }}
                  className="system-button-secondary shrink-0 px-2 py-1 text-xs"
                >
                  Archive
                </button>
              </div>
            ))}
          </div>
        )}
      </InfoCard>
    </div>
  );
}
