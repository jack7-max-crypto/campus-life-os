"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useFocusMode } from "@/components/focus/focus-provider";
import {
  ACADEMICS_STORAGE_KEY,
  COURSES_UPDATED_EVENT,
  markAssignmentCompleteInStorage,
} from "@/lib/academics/useCourses";
import type { Course } from "@/lib/academics/types";
import {
  getCanvasEffectiveAssignments,
  getCurrentCanvasAcademicAssignments,
  getManualEffectiveAssignments,
  type EffectiveAssignment,
} from "@/lib/academics/getEffectiveAssignments";
import {
  CANVAS_IMPORTS_UPDATED_EVENT,
  getStoredCanvasImportSnapshot,
  markCanvasAcademicAssignmentCompleteInStorage,
} from "@/lib/integrations/canvas/store";
import {
  getStoredPlannerTasks,
  markPlannerTaskCompleteInStorage,
  PLANNER_TASKS_UPDATED_EVENT,
  type PlannerTask,
} from "@/lib/planner/usePlannerTasks";
import { recordTaskCompletion } from "@/lib/streak";
import {
  createDefaultFitnessState,
  createEmptyFitnessDayLog,
  getFitnessStreak,
  getLocalDateKey,
  persistFitnessState,
  readFitnessState,
  subscribeToFitnessState,
  type FitnessState,
} from "@/lib/fitness/storage";

type ActionSource = "Planner" | "Academics" | "Fitness";
type ActionTone = "urgent" | "today" | "queued" | "clear";
type CheckState = "complete" | "pending" | "loading";
type CompletionTarget = "planner" | "manual-assignment" | "canvas-assignment" | "fitness-workout" | null;
type DailyCheckKind = "calories" | "protein" | "workout";

type DailyCheck = {
  kind: DailyCheckKind;
  label: string;
  descriptor: string;
  value: string;
  statusLabel: string;
  state: CheckState;
};

type HomeAction = {
  source: ActionSource;
  title: string;
  supportingLine: string;
  timingLabel: string | null;
  tone: ActionTone;
  priorityRank: number;
  dueDate: string | null;
  category: string | null;
  taskId: string | null;
  sourceId: string | null;
  courseId: string | null;
  focusTaskType: "task" | "assignment" | null;
  completionTarget: CompletionTarget;
};

const dayMs = 86_400_000;
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toCalendarDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getCalendarDayDelta(date: Date, todayKey: string) {
  const today = toCalendarDate(todayKey);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / dayMs);
}

function parseDueDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = dateOnlyPattern.test(value) ? new Date(`${value}T23:59:59`) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatProgress(value: number, goal: number, unit: string) {
  if (goal <= 0) {
    return `${formatNumber(value)} ${unit}`;
  }

  return `${formatNumber(value)} / ${formatNumber(goal)} ${unit}`;
}

function getCompactTimingLabel(dueDate: string | null, todayKey: string, now = new Date()) {
  const parsedDueDate = parseDueDate(dueDate);

  if (!parsedDueDate) {
    return null;
  }

  const dayDelta = getCalendarDayDelta(parsedDueDate, todayKey);
  const hasExplicitTime = Boolean(dueDate && !dateOnlyPattern.test(dueDate));
  const deltaMs = parsedDueDate.getTime() - now.getTime();

  if (deltaMs < 0) {
    if (dayDelta === 0) {
      return "Overdue today";
    }

    const overdueDays = Math.max(1, Math.abs(dayDelta));
    return `Overdue ${overdueDays}d`;
  }

  if (hasExplicitTime && deltaMs < dayMs) {
    return `Due in ${Math.max(1, Math.ceil(deltaMs / 3_600_000))}h`;
  }

  if (dayDelta === 0) {
    return "Due today";
  }

  if (dayDelta === 1) {
    return "Due in 1d";
  }

  return `Due in ${Math.max(1, dayDelta)}d`;
}

function getActionTone(dueDate: string | null, todayKey: string, now = new Date()): ActionTone {
  const parsedDueDate = parseDueDate(dueDate);

  if (!parsedDueDate) {
    return "queued";
  }

  const dayDelta = getCalendarDayDelta(parsedDueDate, todayKey);

  if (parsedDueDate.getTime() < now.getTime()) {
    return "urgent";
  }

  if (dayDelta === 0) {
    return "today";
  }

  return "queued";
}

function getActionSortValue(action: HomeAction, todayKey: string, now = new Date()) {
  const parsedDueDate = parseDueDate(action.dueDate);
  const dayDelta = parsedDueDate ? getCalendarDayDelta(parsedDueDate, todayKey) : 99;
  const dueRank = action.tone === "urgent" ? -200 : action.tone === "today" ? -100 : clamp(dayDelta, 0, 99);
  const dueTime = parsedDueDate?.getTime() ?? now.getTime() + 99 * dayMs;

  return dueRank * 1_000_000_000 + dueTime + action.priorityRank * 10_000;
}

function sortOpenTasks(a: PlannerTask, b: PlannerTask) {
  const priorityRank = { P1: 0, P2: 1, P3: 2 };
  const dueDelta = toCalendarDate(a.dueDate).getTime() - toCalendarDate(b.dueDate).getTime();

  if (dueDelta !== 0) {
    return dueDelta;
  }

  return priorityRank[a.priority] - priorityRank[b.priority];
}

function getInitialFitnessState() {
  return createDefaultFitnessState();
}

function getInitialPlannerTasks() {
  return [] as PlannerTask[];
}

function readStoredManualAcademicCourses() {
  if (typeof window === "undefined") {
    return [] as Course[];
  }

  try {
    const raw = window.localStorage.getItem(ACADEMICS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Course[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readHomeAcademicAssignments() {
  const manualAssignments = getManualEffectiveAssignments(readStoredManualAcademicCourses());
  const canvasSnapshot = getStoredCanvasImportSnapshot();
  const canvasAssignments = getCanvasEffectiveAssignments(getCurrentCanvasAcademicAssignments(canvasSnapshot));

  return [...manualAssignments, ...canvasAssignments];
}

function createPlannerAction(task: PlannerTask, todayKey: string): HomeAction {
  const priorityRank = task.priority === "P1" ? 0 : task.priority === "P2" ? 1 : 2;

  return {
    source: "Planner",
    title: task.title,
    supportingLine: `${task.category} task marked ${task.priority}. ${task.note ?? "Open from your planner queue."}`,
    timingLabel: getCompactTimingLabel(task.dueDate, todayKey),
    tone: getActionTone(task.dueDate, todayKey),
    priorityRank,
    dueDate: task.dueDate,
    category: task.category,
    taskId: task.id,
    sourceId: task.id,
    courseId: null,
    focusTaskType: "task",
    completionTarget: "planner",
  };
}

function createAcademicAction(assignment: EffectiveAssignment, todayKey: string): HomeAction {
  return {
    source: "Academics",
    title: assignment.title,
    supportingLine: `${assignment.courseName}${assignment.category ? ` / ${assignment.category}` : ""}. ${
      assignment.status === "in_progress" ? "Already in progress." : "Incomplete assignment."
    }`,
    timingLabel: getCompactTimingLabel(assignment.dueDate, todayKey),
    tone: getActionTone(assignment.dueDate, todayKey),
    priorityRank: assignment.status === "in_progress" ? 1 : 2,
    dueDate: assignment.dueDate,
    category: assignment.courseName,
    taskId: assignment.id,
    sourceId: assignment.sourceId,
    courseId: assignment.courseId,
    focusTaskType: "assignment",
    completionTarget: assignment.source === "canvas" ? "canvas-assignment" : "manual-assignment",
  };
}

function createFitnessAction(check: DailyCheck): HomeAction {
  return {
    source: "Fitness",
    title: check.label,
    supportingLine:
      check.kind === "workout"
        ? "Training is the remaining daily execution signal."
        : "Log the exact intake on the Fitness page to close this target.",
    timingLabel: "Due today",
    tone: "today",
    priorityRank: check.kind === "workout" ? 4 : 5,
    dueDate: getLocalDateKey(),
    category: "Daily fitness",
    taskId: null,
    sourceId: null,
    courseId: null,
    focusTaskType: null,
    completionTarget: check.kind === "workout" ? "fitness-workout" : null,
  };
}

function getClearAction(): HomeAction {
  return {
    source: "Planner",
    title: "No action queued",
    supportingLine: "Planner, current academic assignments, and daily fitness checks are clear for now.",
    timingLabel: "Clear",
    tone: "clear",
    priorityRank: 99,
    dueDate: null,
    category: "Command center",
    taskId: null,
    sourceId: null,
    courseId: null,
    focusTaskType: null,
    completionTarget: null,
  };
}

export default function HomePage() {
  const [fitnessState, setFitnessState] = useState<FitnessState>(getInitialFitnessState);
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>(getInitialPlannerTasks);
  const [academicAssignments, setAcademicAssignments] = useState<EffectiveAssignment[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const { startFocus } = useFocusMode();
  const todayKey = getLocalDateKey();

  useEffect(() => {
    const syncFitness = () => {
      setFitnessState(readFitnessState());
      setHasHydrated(true);
    };

    const syncPlanner = () => {
      setPlannerTasks(getStoredPlannerTasks());
      setHasHydrated(true);
    };

    const syncAcademics = () => {
      setAcademicAssignments(readHomeAcademicAssignments());
      setHasHydrated(true);
    };

    syncFitness();
    syncPlanner();
    syncAcademics();

    const unsubscribeFitness = subscribeToFitnessState(syncFitness);

    window.addEventListener("storage", syncPlanner);
    window.addEventListener("storage", syncAcademics);
    window.addEventListener(PLANNER_TASKS_UPDATED_EVENT, syncPlanner as EventListener);
    window.addEventListener(COURSES_UPDATED_EVENT, syncAcademics as EventListener);
    window.addEventListener(CANVAS_IMPORTS_UPDATED_EVENT, syncAcademics as EventListener);

    return () => {
      unsubscribeFitness();
      window.removeEventListener("storage", syncPlanner);
      window.removeEventListener("storage", syncAcademics);
      window.removeEventListener(PLANNER_TASKS_UPDATED_EVENT, syncPlanner as EventListener);
      window.removeEventListener(COURSES_UPDATED_EVENT, syncAcademics as EventListener);
      window.removeEventListener(CANVAS_IMPORTS_UPDATED_EVENT, syncAcademics as EventListener);
    };
  }, []);

  const dashboard = useMemo(() => {
    const now = new Date();
    const todayLog = fitnessState.dailyLogs[todayKey] ?? createEmptyFitnessDayLog(todayKey);
    const caloriesGoal = fitnessState.goals.caloriesGoal;
    const proteinGoal = fitnessState.goals.proteinGoal;
    const calories = todayLog.calories;
    const protein = todayLog.protein;
    const calorieGoalHit = caloriesGoal > 0 && calories >= caloriesGoal;
    const proteinGoalHit = proteinGoal > 0 && protein >= proteinGoal;
    const workoutComplete = Boolean(todayLog.workoutCompleted);
    const caloriesProgress = calories / Math.max(caloriesGoal, 1);
    const proteinProgress = protein / Math.max(proteinGoal, 1);

    const dailyChecks: DailyCheck[] = [
      {
        kind: "calories",
        label: "Hit calorie goal",
        descriptor: "Daily energy target",
        value: hasHydrated ? formatProgress(calories, caloriesGoal, "kcal") : "--",
        statusLabel: hasHydrated ? (calorieGoalHit ? "Complete" : `${Math.max(0, Math.round(caloriesGoal - calories))} kcal left`) : "Loading",
        state: hasHydrated ? (calorieGoalHit ? "complete" : "pending") : "loading",
      },
      {
        kind: "protein",
        label: "Protein goal",
        descriptor: "Recovery target",
        value: hasHydrated ? formatProgress(protein, proteinGoal, "g") : "--",
        statusLabel: hasHydrated ? (proteinGoalHit ? "Complete" : `${Math.max(0, Math.round(proteinGoal - protein))}g left`) : "Loading",
        state: hasHydrated ? (proteinGoalHit ? "complete" : "pending") : "loading",
      },
      {
        kind: "workout",
        label: "Workout complete",
        descriptor: "Training signal",
        value: hasHydrated ? (workoutComplete ? "Logged today" : "Not logged yet") : "--",
        statusLabel: hasHydrated ? (workoutComplete ? "Complete" : "Pending") : "Loading",
        state: hasHydrated ? (workoutComplete ? "complete" : "pending") : "loading",
      },
    ];

    const openTasks = plannerTasks.filter((task) => !task.completed).sort(sortOpenTasks);
    const openAssignments = academicAssignments.filter((assignment) => assignment.status !== "completed");
    const remainingChecks = dailyChecks.filter((check) => check.state === "pending");
    const actions = [
      ...openTasks.map((task) => createPlannerAction(task, todayKey)),
      ...openAssignments.map((assignment) => createAcademicAction(assignment, todayKey)),
      ...remainingChecks.map(createFitnessAction),
    ].sort((a, b) => getActionSortValue(a, todayKey, now) - getActionSortValue(b, todayKey, now));
    const nextAction = actions[0] ?? getClearAction();

    const isOverdue = (dueDate: string | null) => {
      const parsedDueDate = parseDueDate(dueDate);
      return Boolean(parsedDueDate && parsedDueDate.getTime() < now.getTime());
    };
    const isDueOnDay = (dueDate: string | null, dayDelta: number) => {
      const parsedDueDate = parseDueDate(dueDate);
      return Boolean(parsedDueDate && getCalendarDayDelta(parsedDueDate, todayKey) === dayDelta);
    };

    const overdueCount =
      openTasks.filter((task) => isOverdue(task.dueDate)).length +
      openAssignments.filter((assignment) => isOverdue(assignment.dueDate)).length;
    const dueTodayCount =
      openTasks.filter((task) => isDueOnDay(task.dueDate, 0)).length +
      openAssignments.filter((assignment) => isDueOnDay(assignment.dueDate, 0)).length;
    const dueTomorrowCount =
      openTasks.filter((task) => isDueOnDay(task.dueDate, 1)).length +
      openAssignments.filter((assignment) => isDueOnDay(assignment.dueDate, 1)).length;
    const priorityTasks = openTasks.filter((task) => task.priority === "P1");
    const atRiskCount =
      overdueCount +
      priorityTasks.filter((task) => {
        const parsedDueDate = parseDueDate(task.dueDate);
        return parsedDueDate ? getCalendarDayDelta(parsedDueDate, todayKey) <= 1 : false;
      }).length +
      openAssignments.filter((assignment) => assignment.status === "in_progress" && isDueOnDay(assignment.dueDate, 0)).length;
    const completedChecks = dailyChecks.filter((check) => check.state === "complete").length;
    const checksLeft = dailyChecks.length - completedChecks;
    const readinessScore = clamp(100 - overdueCount * 14 - dueTodayCount * 7 - atRiskCount * 6 - checksLeft * 5, 0, 100);
    const statusTitle = overdueCount > 0 || readinessScore < 70 ? "Needs Action" : "On Track";
    const pressureDetail =
      overdueCount > 0
        ? "Oldest overdue work is pulling down readiness."
        : dueTodayCount > 0 || checksLeft > 0
          ? "Today has open execution items to close."
          : "No major pressure is showing for today.";

    return {
      atRiskCount,
      calorieStreak: getFitnessStreak(fitnessState, "calories"),
      calories,
      caloriesGoal,
      caloriesProgress,
      completedChecks,
      dailyChecks,
      dueTodayCount,
      dueTomorrowCount,
      nextAction,
      openAssignments,
      openTasks,
      overdueCount,
      pressureDetail,
      protein,
      proteinGoal,
      proteinProgress,
      readinessScore,
      remainingChecks,
      statusTitle,
      workoutComplete,
      workoutStreak: getFitnessStreak(fitnessState, "workout"),
    };
  }, [academicAssignments, fitnessState, hasHydrated, plannerTasks, todayKey]);

  const handleStartFocus = () => {
    if (!hasHydrated || dashboard.nextAction.tone === "clear") {
      return;
    }

    startFocus({
      taskId: dashboard.nextAction.taskId,
      taskTitle: dashboard.nextAction.title,
      taskType: dashboard.nextAction.focusTaskType,
      sourceId:
        dashboard.nextAction.completionTarget === "manual-assignment" ||
        dashboard.nextAction.completionTarget === "canvas-assignment"
          ? dashboard.nextAction.taskId
          : dashboard.nextAction.sourceId,
      courseId: dashboard.nextAction.courseId,
      category: dashboard.nextAction.category ?? dashboard.nextAction.source,
      dueDate: dashboard.nextAction.dueDate,
      reason: dashboard.nextAction.supportingLine,
    });
  };

  const handleMarkComplete = () => {
    const action = dashboard.nextAction;
    let didUpdate = false;

    if (action.completionTarget === "planner" && action.sourceId) {
      didUpdate = markPlannerTaskCompleteInStorage(action.sourceId);
    }

    if (action.completionTarget === "manual-assignment" && action.courseId && action.sourceId) {
      didUpdate = markAssignmentCompleteInStorage(action.courseId, action.sourceId);
    }

    if (action.completionTarget === "canvas-assignment" && action.taskId) {
      didUpdate = markCanvasAcademicAssignmentCompleteInStorage(action.taskId);
      if (didUpdate) {
        recordTaskCompletion();
      }
    }

    if (action.completionTarget === "fitness-workout") {
      const currentState = readFitnessState();
      const currentLog = currentState.dailyLogs[todayKey] ?? createEmptyFitnessDayLog(todayKey);
      const nextState: FitnessState = {
        ...currentState,
        dailyLogs: {
          ...currentState.dailyLogs,
          [todayKey]: {
            ...currentLog,
            workoutCompleted: true,
          },
        },
      };

      persistFitnessState(nextState);
      setFitnessState(nextState);
      didUpdate = true;
    }

    if (didUpdate) {
      setPlannerTasks(getStoredPlannerTasks());
      setAcademicAssignments(readHomeAcademicAssignments());
      setFitnessState(readFitnessState());
    }
  };

  const canCompleteAction = Boolean(dashboard.nextAction.completionTarget) && dashboard.nextAction.tone !== "clear";

  return (
    <div className="space-y-3 text-white sm:space-y-4">
      <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <NextActionPanel
          action={dashboard.nextAction}
          canComplete={canCompleteAction}
          hasHydrated={hasHydrated}
          onMarkComplete={handleMarkComplete}
          onStartFocus={handleStartFocus}
        />

        <SystemStatusPanel
          atRiskCount={dashboard.atRiskCount}
          calories={dashboard.calories}
          caloriesGoal={dashboard.caloriesGoal}
          caloriesProgress={dashboard.caloriesProgress}
          dueTodayCount={dashboard.dueTodayCount}
          hasHydrated={hasHydrated}
          overdueCount={dashboard.overdueCount}
          pressureDetail={dashboard.pressureDetail}
          protein={dashboard.protein}
          proteinGoal={dashboard.proteinGoal}
          proteinProgress={dashboard.proteinProgress}
          readinessScore={dashboard.readinessScore}
          statusTitle={dashboard.statusTitle}
          workoutComplete={dashboard.workoutComplete}
        />
      </section>

      <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-3 sm:space-y-4">
          <DailyChecksPanel
            checks={dashboard.dailyChecks}
            completedChecks={dashboard.completedChecks}
            hasHydrated={hasHydrated}
            calorieStreak={dashboard.calorieStreak}
            workoutStreak={dashboard.workoutStreak}
          />

          <TodayPressureStrip
            checksLeft={dashboard.remainingChecks.length}
            dueTodayCount={dashboard.dueTodayCount}
            dueTomorrowCount={dashboard.dueTomorrowCount}
            hasHydrated={hasHydrated}
            overdueCount={dashboard.overdueCount}
          />
        </div>
      </section>
    </div>
  );
}

function CommandPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`system-panel rounded-[24px] border-white/[0.085] bg-[radial-gradient(circle_at_14%_0%,rgba(255,255,255,0.095),transparent_36%),linear-gradient(180deg,rgba(20,20,23,0.98),rgba(9,9,11,0.94))] shadow-[0_22px_70px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="relative">{children}</div>
    </section>
  );
}

function NextActionPanel({
  action,
  canComplete,
  hasHydrated,
  onMarkComplete,
  onStartFocus,
}: {
  action: HomeAction;
  canComplete: boolean;
  hasHydrated: boolean;
  onMarkComplete: () => void;
  onStartFocus: () => void;
}) {
  const isUrgent = action.tone === "urgent";

  return (
    <CommandPanel className="min-h-[23rem] p-5 shadow-[0_28px_86px_rgba(0,0,0,0.66),inset_0_1px_0_rgba(255,255,255,0.055)] sm:p-6 lg:p-7">
      <div className="flex h-full flex-col justify-between gap-6">
        <div className="space-y-2.5">
          <p className="system-label text-white/52">Current Focus</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Next Action</h1>
              <p className="mt-2.5 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">
                The clearest action across planner, academics, and fitness based on the current app state.
              </p>
            </div>
          </div>
        </div>

        <div
          className={`relative overflow-hidden rounded-[22px] border p-5 shadow-[0_30px_90px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.075)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-24 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.075),transparent)] after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.09),transparent_42%)] sm:p-6 ${
            isUrgent
              ? "border-rose-200/22 bg-[linear-gradient(180deg,rgba(244,63,94,0.1),rgba(255,255,255,0.045)_48%,rgba(9,9,11,0.72))]"
              : "border-white/[0.12] bg-[linear-gradient(180deg,rgba(255,255,255,0.085),rgba(255,255,255,0.04)_50%,rgba(8,8,10,0.76))]"
          }`}
        >
          <div className="relative flex flex-col gap-4">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="system-pill border-white/[0.12] bg-white/[0.07] px-3.5 py-1.5 text-[11px] font-semibold text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]">
                  {action.source}
                </span>
                {action.timingLabel ? (
                  <span
                    className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ${
                      isUrgent
                        ? "border-rose-200/22 bg-rose-200/[0.095] text-rose-50/90"
                        : "border-white/[0.11] bg-white/[0.055] text-white/72"
                    }`}
                  >
                    {hasHydrated ? action.timingLabel : "Loading"}
                  </span>
                ) : null}
              </div>
              <div>
                <h2 className="text-[1.85rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-[2.6rem]">
                  {hasHydrated ? action.title : "Reading current state"}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/64">
                  {hasHydrated ? action.supportingLine : "Loading planner, academics, and fitness signals."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="system-button-primary inline-flex min-w-[10rem] items-center justify-center rounded-[16px] px-5 py-3 text-sm font-semibold shadow-[0_18px_48px_rgba(0,0,0,0.54),0_0_32px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.55)]"
            disabled={!hasHydrated || action.tone === "clear"}
            onClick={onStartFocus}
          >
            Start Focus
          </button>
          <button
            type="button"
            className="system-button-secondary inline-flex min-w-[10rem] items-center justify-center rounded-[16px] border-white/[0.075] bg-white/[0.035] px-5 py-3 text-sm font-semibold text-white/72 shadow-[0_14px_34px_rgba(0,0,0,0.36)]"
            disabled={!hasHydrated || !canComplete}
            onClick={onMarkComplete}
            title={canComplete ? undefined : "This action needs exact logging on its source page."}
          >
            Mark Complete
          </button>
        </div>
      </div>
    </CommandPanel>
  );
}

function SystemStatusPanel({
  atRiskCount,
  calories,
  caloriesGoal,
  caloriesProgress,
  dueTodayCount,
  hasHydrated,
  overdueCount,
  pressureDetail,
  protein,
  proteinGoal,
  proteinProgress,
  readinessScore,
  statusTitle,
  workoutComplete,
}: {
  atRiskCount: number;
  calories: number;
  caloriesGoal: number;
  caloriesProgress: number;
  dueTodayCount: number;
  hasHydrated: boolean;
  overdueCount: number;
  pressureDetail: string;
  protein: number;
  proteinGoal: number;
  proteinProgress: number;
  readinessScore: number;
  statusTitle: string;
  workoutComplete: boolean;
}) {
  return (
    <CommandPanel className="p-5 sm:p-6">
      <div className="space-y-4">
        <div className="space-y-2.5">
          <p className="system-label text-white/50">System Status</p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                {hasHydrated ? statusTitle : "Loading"}
              </h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/44">
                Live Readiness Index
              </p>
            </div>
            <p className="text-5xl font-semibold tracking-tight text-white">
              {hasHydrated ? readinessScore : "--"}
              <span className="text-xl text-white/42">/100</span>
            </p>
          </div>
          <p className="text-sm leading-6 text-white/62">{hasHydrated ? pressureDetail : "Reading live app state."}</p>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-white/50">
            <span>Readiness</span>
            <span>{hasHydrated ? `${readinessScore}%` : "--"}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-black/34 shadow-[inset_0_1px_1px_rgba(0,0,0,0.55)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.52),rgba(255,255,255,0.84))] shadow-[0_0_16px_rgba(255,255,255,0.12)] transition-[width] duration-200 ease-out"
              style={{ width: `${hasHydrated ? readinessScore : 0}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 rounded-[18px] border border-white/[0.055] bg-black/18 p-1.5">
          <StatusMetric label="Overdue" value={hasHydrated ? String(overdueCount) : "--"} active={overdueCount > 0} />
          <StatusMetric label="Today" value={hasHydrated ? String(dueTodayCount) : "--"} active={dueTodayCount > 0} emphasized />
          <StatusMetric label="At Risk" value={hasHydrated ? String(atRiskCount) : "--"} active={atRiskCount > 0} />
        </div>

        <div className="rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="system-label text-white/44">Fitness Signal</p>
            <span className="text-xs font-semibold text-white/58">{workoutComplete ? "Workout logged" : "Workout open"}</span>
          </div>
          <div className="space-y-3">
            <FitnessSignalRow label="Calories" value={formatProgress(calories, caloriesGoal, "kcal")} progress={caloriesProgress} />
            <FitnessSignalRow label="Protein" value={formatProgress(protein, proteinGoal, "g")} progress={proteinProgress} />
            <FitnessSignalRow label="Workout" value={workoutComplete ? "Done" : "Pending"} progress={workoutComplete ? 1 : 0} />
          </div>
        </div>
      </div>
    </CommandPanel>
  );
}

function StatusMetric({
  active,
  emphasized = false,
  label,
  value,
}: {
  active: boolean;
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`rounded-[14px] border px-3 py-2.5 ${
        active
          ? "border-rose-200/16 bg-rose-200/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]"
          : emphasized
            ? "border-white/[0.09] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]"
            : "border-transparent bg-transparent"
      }`}
    >
      <p className="system-label text-white/42">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-white/92">{value}</p>
    </div>
  );
}

function FitnessSignalRow({ label, progress, value }: { label: string; progress: number; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
      <span className="font-medium text-white/58">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/30 shadow-[inset_0_1px_1px_rgba(0,0,0,0.46)]">
        <div
          className="h-full rounded-full bg-white/68 transition-[width] duration-200 ease-out"
          style={{ width: `${clamp(progress, 0, 1) * 100}%` }}
        />
      </div>
      <span className="text-right font-semibold text-white/68">{value}</span>
    </div>
  );
}

function DailyChecksPanel({
  calorieStreak,
  checks,
  completedChecks,
  hasHydrated,
  workoutStreak,
}: {
  calorieStreak: number;
  checks: DailyCheck[];
  completedChecks: number;
  hasHydrated: boolean;
  workoutStreak: number;
}) {
  return (
    <CommandPanel className="p-5 shadow-[0_22px_68px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-6">
      <div className="space-y-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="system-label text-white/50">Daily Checks</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Daily Checks</h2>
            <p className="mt-1 text-sm leading-5 text-white/58">Daily fitness targets</p>
          </div>
          <span className="system-pill w-fit border-white/[0.095] bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
            {hasHydrated ? `${completedChecks} / 3 complete` : "Loading"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-full border border-white/[0.07] bg-black/24 p-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]">
          {checks.map((check) => (
            <div
              key={check.kind}
              className={`h-2.5 rounded-full transition-colors duration-200 ${
                check.state === "complete"
                  ? "bg-teal-100/58 shadow-[0_0_20px_rgba(94,234,212,0.14)]"
                  : "bg-white/[0.085]"
              }`}
            />
          ))}
        </div>

        <div className="space-y-1.5">
          {checks.map((check) => (
            <DailyCheckRow key={check.kind} check={check} />
          ))}
        </div>

        <div className="px-1 pt-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium text-white/52">Momentum</span>
            <span className="text-white/20">•</span>
            <span className="font-semibold text-white/72">
              Workout streak: {hasHydrated ? `${workoutStreak}d` : "--"}
            </span>
            <span className="text-white/20">•</span>
            <span className="font-semibold text-white/72">
              Calorie streak: {hasHydrated ? `${calorieStreak}d` : "--"}
            </span>
          </div>
        </div>
      </div>
    </CommandPanel>
  );
}

function DailyCheckRow({ check }: { check: DailyCheck }) {
  const isComplete = check.state === "complete";
  const isLoading = check.state === "loading";
  const isInProgress = check.state === "pending" && check.statusLabel.includes("left");

  return (
    <div
      className={`system-card-interactive rounded-[17px] border px-4 py-2.5 transition-colors duration-200 ${
        isComplete
          ? "border-teal-100/20 bg-teal-200/[0.065] shadow-[inset_0_1px_0_rgba(153,246,228,0.1),0_0_30px_rgba(45,212,191,0.07)]"
          : isInProgress
            ? "border-white/[0.095] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            : "border-white/[0.06] bg-white/[0.026]"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.95rem] font-semibold leading-5 text-white/94">{check.label}</p>
          <p className="mt-0.5 text-sm leading-5 text-white/50">{check.descriptor}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {isComplete ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-100/18 bg-teal-100/[0.11] px-3 py-1 text-xs font-semibold text-teal-50/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
              <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3.5 8.3 6.6 11.4 12.8 4.6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Complete
            </span>
          ) : isInProgress ? (
            <span className="rounded-full border border-white/[0.085] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/74">
              {check.statusLabel}
            </span>
          ) : (
            <span className="rounded-full border border-white/[0.055] bg-black/20 px-3 py-1 text-xs font-semibold text-white/52">
              {isLoading ? "Loading" : check.statusLabel}
            </span>
          )}
          <span className="text-xs font-medium text-white/46">{check.value}</span>
        </div>
      </div>
    </div>
  );
}

function TodayPressureStrip({
  checksLeft,
  dueTodayCount,
  dueTomorrowCount,
  hasHydrated,
  overdueCount,
}: {
  checksLeft: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  hasHydrated: boolean;
  overdueCount: number;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.052),rgba(255,255,255,0.022))] px-4 py-3.5 shadow-[0_18px_48px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.045)] sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="system-label text-white/50">Today Pressure</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <PressureItem label="Overdue" value={hasHydrated ? String(overdueCount) : "--"} active={overdueCount > 0} />
          <PressureItem label="Due Today" value={hasHydrated ? String(dueTodayCount) : "--"} active={dueTodayCount > 0} />
          <PressureItem label="Due Tomorrow" value={hasHydrated ? String(dueTomorrowCount) : "--"} active={dueTomorrowCount > 0} />
          <PressureItem label="Checks Left" value={hasHydrated ? String(checksLeft) : "--"} active={checksLeft > 0} />
        </div>
      </div>
    </div>
  );
}

function PressureItem({ active, label, value }: { active: boolean; label: string; value: string }) {
  return (
    <div
      className={`min-w-[5.25rem] rounded-[14px] border px-3 py-2 ${
        active ? "border-rose-200/14 bg-rose-200/[0.045]" : "border-white/[0.045] bg-black/16"
      }`}
    >
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/42">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight ${active ? "text-white" : "text-white/70"}`}>{value}</p>
    </div>
  );
}
