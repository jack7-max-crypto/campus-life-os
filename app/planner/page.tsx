"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Card, { Card as InfoCard, MetricRow } from "@/components/ui/card";
import { Assignment } from "@/lib/academics/types";
import { formatDate } from "@/lib/academics/utils";
import { useCourses } from "@/lib/academics/useCourses";
import { recordTaskCompletion } from "@/lib/streak";
import {
  addTask,
  archiveTask,
  fetchTasks,
  updateTaskCompletion,
  type SupabaseTask,
} from "@/lib/supabase/tasks";
import {
  PlannerTaskCategory,
  PlannerTaskPriority,
  plannerTaskCategories,
  usePlannerTasks,
} from "@/lib/planner/usePlannerTasks";
import { createClient } from "@/lib/supabase/client";

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

const bucketOrder: PlannerBucket[] = ["Overdue", "Today", "This Week", "Later"];
const plannerFilters: PlannerFilter[] = ["All", ...plannerTaskCategories];
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
  Academics: "border border-white/[0.08] bg-white/[0.06] text-white/75",
  Fitness: "border border-white/[0.08] bg-white/[0.06] text-white/75",
  Money: "border border-white/[0.08] bg-white/[0.06] text-white/75",
  Personal: "border border-white/[0.08] bg-white/[0.06] text-white/75",
};
const priorityBadgeClasses: Record<PlannerTaskPriority, string> = {
  P1: "border border-rose-500/18 bg-rose-500/10 text-rose-100",
  P2: "border border-white/[0.08] bg-white/[0.06] text-white/75",
  P3: "border border-white/[0.06] bg-white/[0.04] text-white/45",
};
const priorityTitleClasses: Record<PlannerTaskPriority, string> = {
  P1: "text-white",
  P2: "text-white",
  P3: "text-white/80",
};
const sourceBadgeClassName =
  "rounded-full border border-white/[0.08] bg-white/[0.06] px-2 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white/55";
const plannerInfoCardClassName = "rounded-[24px]";
const plannerFieldClassName =
  "system-input mt-1 px-3 py-2 text-sm placeholder:text-white/30";
const plannerSecondaryButtonClassName =
  "system-button-secondary w-full px-4 py-2.5 text-sm font-medium disabled:bg-[#050506] sm:w-auto";
const plannerPrimaryButtonClassName =
  "system-button-primary w-full px-4 py-2.5 text-sm font-semibold sm:w-auto";
const plannerSectionDividerClassName = "mt-14 border-t border-white/[0.05] pt-7";

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
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const { courses, setCourses, hasHydrated } = useCourses();
  const {
    updateTaskPriority,
    hasHydrated: hasPlannerTasksHydrated,
  } = usePlannerTasks();
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "unauthenticated">(
    "loading",
  );
  const [supabaseTasks, setSupabaseTasks] = useState<SupabaseTask[]>([]);
  const [hasLoadedSupabaseTasks, setHasLoadedSupabaseTasks] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(createTaskDraft);
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
  const isReady = hasHydrated && hasPlannerTasksHydrated && hasLoadedSupabaseTasks;

  async function loadSupabaseTasks() {
    const data = await fetchTasks();
    setSupabaseTasks(data ?? []);
    setHasLoadedSupabaseTasks(true);
  }

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

    async function validateSession() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (error || !user) {
        setAuthStatus("unauthenticated");
        router.replace("/login");
        router.refresh();
        return;
      }

      setAuthStatus("authenticated");
    }

    void validateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setAuthStatus("unauthenticated");
        router.replace("/login");
        router.refresh();
        return;
      }

      setAuthStatus("authenticated");
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadSupabaseTasks();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authStatus]);

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

    const incompleteTasks: PlannerTaskItem[] = openSupabaseTasks
      .map((task) => ({
        id: task.id,
        itemType: "task" as const,
        bucket: getPlannerBucket(task.due_date, today),
        dueDate: task.due_date,
        title: task.title,
        displayCategory: mapSupabaseTaskCategory(task.category),
        priority: taskPriorities[task.id] ?? "P2",
        completed: task.completed,
        note: task.note ?? undefined,
      }));

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
  }, [assignmentPriorities, courses, openSupabaseTasks, taskPriorities]);

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

    console.log("Completing Supabase planner task", item);
    const updatedTask = await updateTaskCompletion(item.id, true);
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

    const createdTask = await addTask({
      title: normalizedTitle,
      due_date: dueDate,
      category,
      note: normalizedNote || undefined,
    });

    if (!createdTask) {
      return;
    }

    await loadSupabaseTasks();
    setTaskDraft(createTaskDraft());
  };

  if (authStatus !== "authenticated") {
    return (
      <InfoCard
        title={authStatus === "loading" ? "Checking access" : "Redirecting to login"}
        subtitle="Planner authentication"
        className={plannerInfoCardClassName}
        variant="dark"
      >
        <p className="text-sm text-white/50">
          {authStatus === "loading"
            ? "Verifying your session before loading planner data..."
            : "You need to sign in to use the planner."}
        </p>
      </InfoCard>
    );
  }

  return (
    <div className="animate-fadeIn space-y-4 pb-24 sm:space-y-5 md:space-y-6 md:pb-6 lg:space-y-7">
      <section className="space-y-1.5">
        <h2 className="text-3xl font-semibold tracking-tight text-white md:text-[2rem]">
          Planner
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-white/50">
          One timeline for course assignments and your own custom tasks.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="system-label text-white/45">Filter</span>
          {plannerFilters.map((filter) => {
            const isActive = filter === activeFilter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? "border-white bg-white text-black shadow-[0_12px_30px_rgba(0,0,0,0.3)] hover:bg-white/92"
                    : "border-white/[0.08] bg-[#09090a] text-white/58 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => completePlannerItems(filteredPlanner.grouped.Overdue)}
            disabled={!isReady || filteredPlanner.grouped.Overdue.length === 0}
            className={plannerSecondaryButtonClassName}
          >
            Complete all overdue
          </button>
          <button
            type="button"
            onClick={() => completePlannerItems(filteredPlanner.grouped.Today)}
            disabled={!isReady || filteredPlanner.grouped.Today.length === 0}
            className={plannerSecondaryButtonClassName}
          >
            Complete all today
          </button>
          <button
            type="button"
            onClick={handleFocusModeToggle}
            disabled={!isReady || !mostImportantItem}
            className={`${plannerSecondaryButtonClassName} ${
              isFocusMode ? "border-white bg-white text-black hover:bg-white" : ""
            }`}
          >
            {isFocusMode ? "Exit focus mode" : "Enter focus mode"}
          </button>
        </div>
        {completionFeedback ? (
          <div
            role="status"
            aria-live="polite"
            className={`mt-4 rounded-xl border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-[0_18px_44px_rgba(0,0,0,0.32)] transition-all duration-200 ${
              isCompletionFeedbackVisible
                ? "translate-y-0 opacity-100"
                : "-translate-y-1 opacity-0"
            }`}
          >
            {completionFeedback.message}
          </div>
        ) : null}
        <div
          className={`system-subtle-panel system-card-interactive rounded-[18px] px-4 py-4 sm:px-5 ${
            isFocusMode ? "system-focus-active" : ""
          } ${
            focusedPlannerItem?.bucket === "Overdue" ? "system-card-priority" : ""
          }`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="system-label text-white/45">{isFocusMode ? "Focus mode target" : plannerInsight.eyebrow}</p>
              <p className="mt-2 text-base font-semibold text-white sm:text-lg">
                {focusedPlannerItem ? focusedPlannerItem.title : "No open items"}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {focusedPlannerItem
                  ? getPlannerItemContext(focusedPlannerItem)
                  : "Use the planner to add the next concrete milestone."}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/50">{plannerInsight.description}</p>
            </div>
            {focusedPlannerItem ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityBadgeClasses[focusedPlannerItem.priority]}`}>
                  {focusedPlannerItem.priority}
                </span>
                <span className="system-pill px-3 py-1 text-xs font-semibold text-white/70">
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
        <form className="space-y-3" onSubmit={handleAddTask}>
          <div className="grid gap-3 sm:grid-cols-2">
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
                rows={3}
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
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5 xl:gap-5 ${plannerSectionDividerClassName} ${plannerSecondarySectionClassName}`}
      >
        <InfoCard
          title="Open items"
          subtitle="Assignments and tasks"
          className={plannerInfoCardClassName}
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
          className={`${plannerInfoCardClassName} ${
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
          className={plannerInfoCardClassName}
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
          className={plannerInfoCardClassName}
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
          className={`${plannerInfoCardClassName} ${
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
        <section className={`system-panel relative space-y-5 rounded-[24px] p-4 ${plannerSectionDividerClassName} sm:p-5 md:space-y-6 md:p-6`}>
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          <div
            className={`system-subtle-panel system-card-interactive flex flex-wrap items-center gap-2 rounded-[18px] px-3 py-2 text-xs text-white/50 ${
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
              <div key={bucket} className="space-y-3">
                <div
                  className={`flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between ${
                    index === 0 ? "" : "mt-6"
                  }`}
                >
                  <h3 className="text-base font-semibold text-white sm:text-lg">{bucket}</h3>
                  <span className="text-sm text-white/45">
                    {items.length} open item{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-white/35">
                    Nothing here. Pull forward work from the next bucket if you want more margin.
                  </p>
                ) : (
                  <div className="space-y-3">
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
                              className={`system-subtle-panel border border-white/[0.05] bg-black/40 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between ${
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
                                <div className="flex flex-wrap items-start gap-2">
                                  <span
                                    className={`min-w-0 text-sm font-medium sm:text-base ${
                                      isCompleting
                                        ? "line-through text-white/35"
                                        : priorityTitleClasses[item.priority]
                                    }`}
                                  >
                                    {item.title}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs ${taskCategoryClasses[item.displayCategory]}`}
                                  >
                                    {item.displayCategory}
                                  </span>
                                  <span className={sourceBadgeClassName}>
                                    {item.itemType === "assignment" ? "Course Assignment" : "My Task"}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-semibold ${priorityBadgeClasses[item.priority]}`}
                                  >
                                    {item.priority}
                                  </span>
                                  {isOverdue ? (
                                    <span className="rounded-full border border-rose-500/18 bg-rose-500/10 px-2 py-1 text-xs text-rose-100">
                                      Overdue
                                    </span>
                                  ) : null}
                                  {isFocusedItem ? (
                                    <span className="rounded-full border border-white/[0.14] bg-white/[0.08] px-2 py-1 text-xs text-white">
                                      Active
                                    </span>
                                  ) : null}
                                </div>
                                <span className="mt-1 text-xs leading-5 text-white/50">
                                  {getPlannerItemContext(item)}
                                </span>
                                {item.itemType === "task" && item.note ? (
                                  <span className="mt-1 text-xs leading-5 text-white/35">{item.note}</span>
                                ) : null}
                              </div>
                              <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
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
                                  className="system-button-secondary w-full rounded-full px-3 py-2 text-sm sm:w-auto"
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
                                  className="system-button-primary flex min-h-[44px] w-full items-center justify-center rounded-full px-4 text-black disabled:border-white/[0.06] disabled:bg-white/20 disabled:text-white/40 sm:h-11 sm:w-11 sm:px-0"
                                >
                                  {isCompleting ? "…" : "✓"}
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
                className="system-subtle-panel system-card-interactive system-card-positive flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-black/40 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-white">
                  {task.title}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs ${taskCategoryClasses[mapSupabaseTaskCategory(task.category)]}`}
                >
                  {mapSupabaseTaskCategory(task.category)}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await archiveTask(task.id);
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
