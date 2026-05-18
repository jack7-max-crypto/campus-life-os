"use client";

import { useEffect, useMemo, useState } from "react";
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

function splitActionTitle(title: string) {
  const normalizedTitle = title.replace(/\s+/g, " ").trim();
  const parts = normalizedTitle.split(/\s*(?:[-–—:|])\s+/).filter(Boolean);

  if (parts.length > 1) {
    const [context, ...rest] = parts;
    const looksLikeAssignmentContext =
      /[#\d]/.test(context) ||
      /\b(assignment|board|discussion|draft|module|quiz|review|unit)\b/i.test(context);

    if (looksLikeAssignmentContext) {
      return {
        context,
        primary: rest.join(" "),
      };
    }
  }

  return {
    context: null,
    primary: normalizedTitle,
  };
}

function getCompactActionTitle(title: string) {
  const { primary } = splitActionTitle(title);
  const normalizedTitle = primary.trim();
  const words = normalizedTitle.split(" ").filter(Boolean);

  if (words.length <= 3) {
    return normalizedTitle || title;
  }

  return words.slice(0, 3).join(" ");
}

function formatCourseCode(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/[a-z]{2,5}[-\s]?\d{2,4}/i);

  if (match) {
    return match[0].replace(/\s+/g, "-").toUpperCase();
  }

  return value;
}

function getProgressToneClass(progress: number) {
  if (progress >= 0.8) {
    return "system-progress-fill-success";
  }

  if (progress >= 0.45) {
    return "system-progress-fill-warning";
  }

  return "system-progress-fill-danger";
}

function getProgressFillStateClass(progress: number) {
  return progress > 0 ? "" : "system-progress-fill-empty";
}

function cleanActionMetaLabel(value: string) {
  return value
    .replace(/\s+#\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getActionTimingMeta(action: HomeAction) {
  const timing = action.timingLabel;

  if (!timing) {
    return null;
  }

  if (timing.toLowerCase().startsWith("overdue")) {
    return "Overdue";
  }

  return timing;
}

function getActionContextLine(action: HomeAction, hasHydrated: boolean) {
  if (!hasHydrated) {
    return "Syncing planner, academics, and fitness";
  }

  const titleContext = splitActionTitle(action.title).context;
  const contextParts = [
    titleContext ? cleanActionMetaLabel(titleContext) : action.source,
    formatCourseCode(action.courseId) ?? action.category ?? action.source,
    getActionTimingMeta(action),
  ].filter(Boolean);

  return contextParts.join(" • ");
}

function getActionStatusLabel(action: HomeAction, hasHydrated: boolean) {
  if (!hasHydrated) {
    return "Syncing State";
  }

  if (action.tone === "clear") {
    return "All Clear";
  }

  if (action.tone === "urgent") {
    return action.timingLabel ?? "Overdue";
  }

  if (action.tone === "today") {
    return action.timingLabel ?? "Due Today";
  }

  return "Queued Focus";
}

function getActionContextTag(action: HomeAction, hasHydrated: boolean) {
  if (!hasHydrated) {
    return "Syncing";
  }

  if (action.tone === "clear") {
    return "Clear";
  }

  if (action.focusTaskType) {
    return "High Focus";
  }

  if (action.completionTarget) {
    return "1 Step";
  }

  return "~30 Min";
}

function formatCommandTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

function getFocusSystemMessage(action: HomeAction, hasHydrated: boolean) {
  if (!hasHydrated) {
    return "Syncing the operating layer for the next move.";
  }

  if (action.tone === "clear") {
    return "The room is quiet. Use the open window to move one thoughtful step ahead.";
  }

  if (action.tone === "urgent") {
    return "Discipline is choosing the highest-pressure step before the noise gets a vote.";
  }

  if (action.tone === "today") {
    return "Quiet execution beats noisy planning when the day is already moving.";
  }

  return "Lock onto the next deliberate step and let the rest of the system fall dim.";
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
        ? "Training is the open fitness signal."
        : "Log intake in Fitness to close this target.",
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
    const focusScore =
      nextAction.tone === "clear"
        ? 96
        : clamp(
            readinessScore +
              6 +
              (nextAction.focusTaskType ? 10 : 6) +
              (nextAction.completionTarget ? 4 : 2) +
              (workoutComplete ? 2 : 0) -
              Math.min(overdueCount * 3, 12) -
              Math.max(dueTodayCount - 1, 0) * 2,
            52,
            97,
          );
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
      focusScore,
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
    <div className="relative min-w-0 overflow-hidden px-0.5 py-0.5 text-white sm:px-2">
      <div className="pointer-events-none absolute inset-[-2rem] z-0 bg-[var(--bg-0)]" />
      <div className="pointer-events-none absolute inset-[-2rem] z-0 bg-[radial-gradient(circle_at_18%_16%,rgba(98,116,154,0.03),transparent_36%),radial-gradient(circle_at_92%_8%,rgba(108,122,146,0.018),transparent_30%),linear-gradient(102deg,transparent_0%,rgba(122,142,170,0.016)_48%,transparent_76%),var(--bg-0)]" />
      <div className="pointer-events-none absolute inset-[-2rem] z-0 opacity-[0.026] [background-image:radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.18)_0_0.28px,transparent_0.82px),radial-gradient(circle_at_78%_34%,rgba(190,194,204,0.08)_0_0.34px,transparent_0.92px)] [background-position:0_0,38px_21px] [background-size:220px_170px,310px_230px]" />
      <div className="pointer-events-none absolute inset-x-[-14%] top-3 z-0 h-20 bg-[linear-gradient(90deg,transparent,rgba(126,144,176,0.012)_30%,rgba(126,144,176,0.008)_50%,transparent_76%)] blur-md" />
      <div className="pointer-events-none absolute inset-x-[-16%] top-10 z-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.1)_30%,rgba(136,150,178,0.08)_52%,transparent_78%)]" />
      <div className="pointer-events-none absolute left-[2%] top-14 z-0 h-[18rem] w-[42rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(98,116,154,0.02),transparent_72%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-[-2rem] z-0 bg-[radial-gradient(ellipse_at_50%_18%,transparent_0%,transparent_31%,rgba(0,0,0,0.42)_62%,rgba(0,0,0,0.88)_100%)]" />

      <HeroOperatingSurface
        action={dashboard.nextAction}
        canComplete={canCompleteAction}
        hasHydrated={hasHydrated}
        onMarkComplete={handleMarkComplete}
        onStartFocus={handleStartFocus}
        atRiskCount={dashboard.atRiskCount}
        calories={dashboard.calories}
        caloriesGoal={dashboard.caloriesGoal}
        caloriesProgress={dashboard.caloriesProgress}
        dueTodayCount={dashboard.dueTodayCount}
        focusScore={dashboard.focusScore}
        overdueCount={dashboard.overdueCount}
        pressureDetail={dashboard.pressureDetail}
        protein={dashboard.protein}
        proteinGoal={dashboard.proteinGoal}
        proteinProgress={dashboard.proteinProgress}
        readinessScore={dashboard.readinessScore}
        statusTitle={dashboard.statusTitle}
        workoutComplete={dashboard.workoutComplete}
      />

      <section className="relative z-10 mt-2.5 grid min-w-0 gap-2.5 sm:mt-5 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="pointer-events-none absolute inset-x-4 top-[-2.5rem] -z-10 h-16 bg-[linear-gradient(180deg,rgba(245,247,248,0.026),transparent)] blur-xl" />
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
      </section>

      <div className="relative z-10 mt-2.5 lg:hidden">
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
      </div>
    </div>
  );
}

function HeroOperatingSurface({
  action,
  atRiskCount,
  calories,
  caloriesGoal,
  caloriesProgress,
  canComplete,
  dueTodayCount,
  focusScore,
  hasHydrated,
  onMarkComplete,
  onStartFocus,
  overdueCount,
  pressureDetail,
  protein,
  proteinGoal,
  proteinProgress,
  readinessScore,
  statusTitle,
  workoutComplete,
}: {
  action: HomeAction;
  atRiskCount: number;
  calories: number;
  caloriesGoal: number;
  caloriesProgress: number;
  canComplete: boolean;
  dueTodayCount: number;
  focusScore: number;
  hasHydrated: boolean;
  onMarkComplete: () => void;
  onStartFocus: () => void;
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
    <section className="relative z-10 grid min-w-0 gap-2.5 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="pointer-events-none absolute inset-x-[-5%] top-[-4.75rem] -z-10 h-64 bg-[radial-gradient(ellipse_at_32%_18%,rgba(98,116,154,0.038),rgba(98,116,154,0.012)_30%,transparent_72%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-x-[-7%] top-[-1rem] -z-10 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.1)_30%,rgba(136,150,178,0.08)_54%,transparent_80%)]" />
      <div className="pointer-events-none absolute left-[-5rem] top-[8rem] -z-10 h-[22rem] w-[40rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(98,116,154,0.016),transparent_72%)] blur-2xl" />

      <NextActionPanel
        action={action}
        canComplete={canComplete}
        focusScore={focusScore}
        hasHydrated={hasHydrated}
        onMarkComplete={onMarkComplete}
        onStartFocus={onStartFocus}
      />

      <div className="hidden lg:block">
        <SystemStatusPanel
          atRiskCount={atRiskCount}
          calories={calories}
          caloriesGoal={caloriesGoal}
          caloriesProgress={caloriesProgress}
          dueTodayCount={dueTodayCount}
          hasHydrated={hasHydrated}
          overdueCount={overdueCount}
          pressureDetail={pressureDetail}
          protein={protein}
          proteinGoal={proteinGoal}
          proteinProgress={proteinProgress}
          readinessScore={readinessScore}
          statusTitle={statusTitle}
          workoutComplete={workoutComplete}
        />
      </div>
    </section>
  );
}

function NextActionPanel({
  action,
  canComplete,
  focusScore,
  hasHydrated,
  onMarkComplete,
  onStartFocus,
}: {
  action: HomeAction;
  canComplete: boolean;
  focusScore: number;
  hasHydrated: boolean;
  onMarkComplete: () => void;
  onStartFocus: () => void;
}) {
  const compactTitle = hasHydrated ? getCompactActionTitle(action.title) : "Reading current state";
  const contextLine = getActionContextLine(action, hasHydrated);
  const descriptionLine = hasHydrated ? action.supportingLine : "Loading planner, academics, and fitness signals.";
  const statusLabel = getActionStatusLabel(action, hasHydrated);
  const contextTag = getActionContextTag(action, hasHydrated);
  const actionStateClass = action.tone === "urgent" ? "system-next-action-urgent" : "system-next-action-normal";
  const systemMessage = getFocusSystemMessage(action, hasHydrated);
  const [commandTime, setCommandTime] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => {
      setCommandTime(new Date());
    };

    tick();

    const intervalId = window.setInterval(tick, 30_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="system-hero-card relative flex min-h-0 w-full min-w-0 flex-col gap-2.5 overflow-hidden rounded-[1rem] border p-2.5 backdrop-blur-md sm:min-h-[29rem] sm:gap-6 sm:rounded-[2rem] sm:p-7 lg:p-8 xl:p-9">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(98,116,154,0.042),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.028),transparent_16%),linear-gradient(var(--bg-2),var(--bg-1))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_14%_18%,rgba(255,255,255,0.34)_0_0.3px,transparent_0.78px),radial-gradient(circle_at_72%_38%,rgba(185,190,210,0.12)_0_0.38px,transparent_0.9px),radial-gradient(circle_at_39%_81%,rgba(255,255,255,0.12)_0_0.28px,transparent_0.72px)] [background-position:0_0,24px_17px,68px_43px] [background-size:190px_150px,270px_210px,230px_190px]" />
      <div className="pointer-events-none absolute inset-x-[-9%] top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.11)_26%,rgba(136,150,178,0.08)_54%,transparent_82%)]" />
      <div className="pointer-events-none absolute inset-y-8 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(180,190,210,0.09),rgba(136,150,178,0.07),transparent)]" />
      <div className="pointer-events-none absolute inset-y-8 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(180,190,210,0.08),transparent)]" />
      <div className="pointer-events-none absolute inset-x-12 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.07),transparent)]" />
      <div className="pointer-events-none absolute left-[-7rem] top-[-9rem] h-[22rem] w-[44rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(98,116,154,0.018),transparent_74%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_52%,transparent_0%,transparent_42%,rgba(0,0,0,0.66)_100%)]" />
      <div className="relative flex flex-1 flex-col gap-2.5 sm:gap-6">
        <div className="grid grid-cols-1 items-start gap-1.5 pb-0.5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_18.5rem] lg:items-center">
          <div className="min-w-0">
            <p className="system-system-label font-mono text-[0.62rem] font-bold uppercase leading-none tracking-[0.08em]">Current Focus</p>
            <h1 className="system-hero-title mt-1.5 text-[1.72rem] font-black leading-[0.95] tracking-[-0.01em] sm:mt-5 sm:text-[3.3rem] lg:whitespace-nowrap xl:text-[4rem]">
              Next Action
            </h1>
            <p className="system-muted-copy mt-1.5 max-w-[21rem] break-words text-[0.78rem] leading-[1.15rem] [overflow-wrap:anywhere] sm:mt-6 sm:max-w-[36rem] sm:text-[1.06rem] sm:leading-8">
              &ldquo;{systemMessage}&rdquo;
            </p>
            <p className="mt-1 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-[rgba(135,151,178,0.34)] sm:mt-2 sm:text-[0.64rem]">System Message</p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-6 sm:gap-2.5">
              <span className="system-command-pill sm:hidden">
                {hasHydrated ? `${Math.round(focusScore)}%` : "--%"} Focus
              </span>
              <span className="system-command-pill home-no-distractions-pill">
                <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 4.7v3.5l2.1 1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="tabular-nums">{commandTime ? formatCommandTime(commandTime) : "--:--"}</span>
              </span>
              <span className="system-command-pill">
                <span className="system-command-pill-dot" />
                Deep Focus
              </span>
              <span className="system-command-pill">
                <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                  <path d="M5 6.3a3 3 0 0 1 6 0c0 3.2 1.3 3.9 1.3 3.9H3.7S5 9.5 5 6.3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="m3.4 3.4 9.2 9.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                No Distractions
              </span>
            </div>
          </div>

          <div className="relative hidden items-start justify-center sm:flex sm:items-center lg:justify-end">
            <FocusMeter hasHydrated={hasHydrated} score={focusScore} />
          </div>
        </div>

        <div className="h-px bg-[linear-gradient(90deg,rgba(180,190,210,0.1),rgba(136,150,178,0.07),transparent)]" />

        <div className={`${actionStateClass} system-next-action-object relative overflow-hidden rounded-[0.95rem] border border-white/[0.06] bg-[var(--bg-2)] p-2.5 shadow-[0_16px_38px_rgba(0,0,0,0.58),0_8px_20px_rgba(80,100,255,0.035),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-sm sm:rounded-[1.55rem] sm:p-5 lg:p-5`}>
          <div className="system-next-action-breath pointer-events-none absolute inset-0 rounded-[inherit]" />
          <div className="system-next-action-scanline pointer-events-none absolute inset-x-0 top-0 h-px" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.024),transparent_34%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(98,116,154,0.022),transparent_60%)]" />
          <div className="system-next-action-drift pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.1),rgba(136,150,178,0.08),transparent)]" />
          <div className="pointer-events-none absolute left-[-11%] top-[-6rem] h-56 w-[32rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(98,116,154,0.016),transparent_74%)] blur-xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.036] [background-image:radial-gradient(circle_at_17%_28%,rgba(255,255,255,0.36)_0_0.3px,transparent_0.76px),radial-gradient(circle_at_74%_44%,rgba(185,190,210,0.12)_0_0.38px,transparent_0.9px),radial-gradient(circle_at_39%_82%,rgba(255,255,255,0.12)_0_0.28px,transparent_0.72px)] [background-position:0_0,25px_15px,62px_39px] [background-size:160px_130px,250px_180px,210px_170px]" />
          <div className="relative flex flex-col gap-2.5">
            <div className="grid gap-2.5 sm:gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="system-next-action-status mb-1.5 font-mono text-[0.58rem] font-black uppercase leading-none tracking-[0.16em]">
                  {statusLabel}
                </p>
                <h2 className="line-clamp-2 max-w-full break-words text-[1.18rem] font-black leading-[1.04] tracking-[-0.01em] text-white [overflow-wrap:anywhere] sm:text-[2.85rem] lg:text-[3.1rem]">
                  {compactTitle}
                </h2>
                <p className="mt-1 max-w-full font-mono text-[0.6rem] font-bold uppercase leading-4 tracking-[0.08em] text-white/40 sm:max-w-3xl sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap">
                  {contextLine}
                </p>
                <div className="mt-2 h-px max-w-full bg-[rgba(180,190,210,0.095)] sm:max-w-3xl" />
                <p className="mt-1.5 max-w-full text-[0.72rem] leading-[1.05rem] text-white/38 sm:max-w-3xl sm:text-[0.9rem] sm:leading-6">
                  {descriptionLine}
                </p>
              </div>

              <div className="flex max-w-full flex-col gap-2 md:min-w-[10.75rem] md:items-end">
                <span className="system-next-action-tag inline-flex w-fit items-center rounded-full border px-3 py-1 font-mono text-[0.64rem] font-black uppercase tracking-[0.12em] sm:self-end">
                  {contextTag}
                </span>
                <button
                  type="button"
                  className="system-button-primary system-next-action-primary inline-flex min-h-9 w-full min-w-0 items-center justify-center rounded-[12px] px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:border-white/[0.03] disabled:bg-black/20 disabled:text-white/36 disabled:shadow-none md:w-[10.75rem] md:min-w-[10rem] md:font-mono md:font-black"
                  disabled={!hasHydrated || action.tone === "clear"}
                  onClick={onStartFocus}
                >
                  Start Focus
                </button>
                <button
                  type="button"
                  className="system-button-secondary inline-flex min-h-9 w-full min-w-0 items-center justify-center rounded-[12px] px-3 py-2 text-sm font-semibold opacity-70 disabled:cursor-not-allowed disabled:border-white/[0.03] disabled:bg-black/18 disabled:text-white/30 disabled:opacity-100 disabled:shadow-none md:w-[10.75rem] md:min-w-[10rem] md:font-mono md:font-bold"
                  disabled={!hasHydrated || !canComplete}
                  onClick={onMarkComplete}
                  title={canComplete ? undefined : "This action needs exact logging on its source page."}
                >
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FocusMeter({ hasHydrated, score }: { hasHydrated: boolean; score: number }) {
  const visualScore = hasHydrated ? clamp(score, 0, 100) : 82;
  const size = 252;
  const center = size / 2;
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const arcSpan = 290;
  const arcLength = circumference * (arcSpan / 360);
  const gapLength = circumference - arcLength;
  const progressLength = arcLength * (visualScore / 100);
  const startAngle = 138;
  const endAngle = startAngle + (arcSpan * visualScore) / 100;
  const endpointRadians = ((endAngle - 90) * Math.PI) / 180;
  const endpointX = center + radius * Math.cos(endpointRadians);
  const endpointY = center + radius * Math.sin(endpointRadians);
  const rotate = `rotate(${startAngle - 90} ${center} ${center})`;

  return (
    <div className="system-focus-meter-shell">
      <svg className="system-focus-meter-svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="focus-meter-gradient" x1="18%" y1="82%" x2="82%" y2="18%">
            <stop offset="0%" stopColor="#5267a8" />
            <stop offset="58%" stopColor="#d6e2ff" />
            <stop offset="100%" stopColor="#f4f7ff" />
          </linearGradient>
          <filter id="focus-meter-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="focus-meter-edge-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(180,190,210,0.026)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${gapLength}`}
          transform={rotate}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(173,187,220,0.065)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${gapLength}`}
          strokeDashoffset="8"
          transform={rotate}
          opacity="0.36"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#focus-meter-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progressLength} ${circumference}`}
          transform={rotate}
          filter="url(#focus-meter-glow)"
          opacity="0.14"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#focus-meter-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${progressLength} ${circumference}`}
          transform={rotate}
        />
        <circle
          cx={endpointX}
          cy={endpointY}
          r="9"
          fill="#e8efff"
          filter="url(#focus-meter-edge-glow)"
          opacity="0.32"
        />
        <circle
          cx={endpointX}
          cy={endpointY}
          r="4.2"
          fill="#fbfdff"
          filter="url(#focus-meter-edge-glow)"
          opacity="0.98"
        />
      </svg>

      <div className="system-focus-meter-core">
        <p className="system-focus-meter-value">{hasHydrated ? `${Math.round(score)}%` : "--%"}</p>
        <p className="system-focus-meter-label">Focus Score</p>
      </div>
    </div>
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
  const readinessTone = "system-progress-fill-violet";

  return (
    <>
    <details className="system-panel system-command-card group relative min-w-0 overflow-hidden rounded-[0.95rem] p-2.5 backdrop-blur-md lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 outline-none focus-visible:ring-2 focus-visible:ring-white/20 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="system-system-label font-mono text-[0.62rem] font-bold uppercase leading-none tracking-[0.08em]">System Status</p>
          <p className="mt-1.5 text-sm font-black text-white">{hasHydrated ? statusTitle : "Loading"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="system-pill px-2.5 py-1 font-mono text-xs font-bold text-white/70">
            {hasHydrated ? `${readinessScore}%` : "--"}
          </span>
          <span className="system-pill px-2.5 py-1 text-[11px] font-bold text-white/58 transition-transform group-open:rotate-180">▾</span>
        </div>
      </summary>
      <div className="mt-2.5 space-y-2.5">
        <p className="system-muted-copy text-[0.72rem] leading-4">{hasHydrated ? pressureDetail : "Reading live app state."}</p>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[0.7rem] font-medium text-white/48">
            <span className="system-system-label font-mono uppercase tracking-[0.08em]">Readiness</span>
            <span className="font-mono">{hasHydrated ? `${readinessScore}%` : "--"}</span>
          </div>
          <div className="system-progress-track h-1.5">
            <div
              className={`system-progress-fill ${readinessTone} ${getProgressFillStateClass(hasHydrated ? readinessScore : 0)} transition-[width] duration-200 ease-out`}
              style={{ width: `${hasHydrated ? readinessScore : 0}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <StatusMetric label="Overdue" value={hasHydrated ? String(overdueCount) : "--"} active={overdueCount > 0} />
          <StatusMetric label="Today" value={hasHydrated ? String(dueTodayCount) : "--"} active={dueTodayCount > 0} emphasized />
          <StatusMetric label="At Risk" value={hasHydrated ? String(atRiskCount) : "--"} active={atRiskCount > 0} />
        </div>
        <div className="rounded-[0.9rem] border border-white/[0.055] bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_34%),var(--bg-2)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),inset_0_10px_16px_rgba(88,108,148,0.01)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="system-system-label font-mono text-[0.62rem] font-bold uppercase leading-none tracking-[0.08em]">Fitness Signal</p>
            <span className="font-mono text-xs font-bold text-white/60">{workoutComplete ? "Logged" : "Open"}</span>
          </div>
          <div className="space-y-2">
            <FitnessSignalRow label="Calories" value={formatProgress(calories, caloriesGoal, "kcal")} progress={caloriesProgress} />
            <FitnessSignalRow label="Protein" value={formatProgress(protein, proteinGoal, "g")} progress={proteinProgress} />
            <FitnessSignalRow label="Workout" value={workoutComplete ? "Done" : "Pending"} progress={workoutComplete ? 1 : 0} />
          </div>
        </div>
      </div>
    </details>

    <aside className="system-panel system-command-card relative hidden min-h-[28rem] min-w-0 overflow-hidden rounded-[2rem] p-5 backdrop-blur-md sm:p-6 lg:block lg:p-7 xl:p-8">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.1),rgba(136,150,178,0.08),transparent)]" />
      <div className="pointer-events-none absolute inset-y-8 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(180,190,210,0.1),rgba(136,150,178,0.07),transparent)]" />
      <div className="pointer-events-none absolute inset-y-8 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(180,190,210,0.08),transparent)]" />
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.08),transparent)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle_at_19%_22%,rgba(255,255,255,0.34)_0_0.3px,transparent_0.76px),radial-gradient(circle_at_76%_36%,rgba(185,190,210,0.12)_0_0.36px,transparent_0.9px),radial-gradient(circle_at_38%_84%,rgba(255,255,255,0.1)_0_0.28px,transparent_0.7px)] [background-position:0_0,19px_25px,43px_9px] [background-size:180px_145px,260px_200px,230px_180px]" />
      <div className="pointer-events-none absolute right-[-9rem] top-[-9rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(98,116,154,0.016),transparent_70%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-x-6 top-[8.4rem] h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.08),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,transparent_0%,transparent_50%,rgba(0,0,0,0.5)_100%)]" />

      <div className="relative flex h-full flex-col gap-6">
        <div>
          <p className="system-system-label font-mono text-[0.62rem] font-bold uppercase leading-none tracking-[0.08em]">System Status</p>
          <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black leading-none">{hasHydrated ? statusTitle : "Loading"}</h2>
              <p className="system-system-label mt-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em]">Readiness Index</p>
            </div>
            <div className="shrink-0 rounded-[1rem] border border-white/[0.06] bg-[radial-gradient(circle_at_50%_14%,rgba(136,150,178,0.05),transparent_62%),linear-gradient(180deg,rgba(255,255,255,0.022),transparent_32%),var(--bg-2)] px-4 py-2 text-right shadow-[0_16px_34px_rgba(0,0,0,0.44),0_10px_20px_rgba(80,100,255,0.03),inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="system-readout-value font-mono text-5xl font-black leading-none tracking-[0.02em]">
                {hasHydrated ? readinessScore : "--"}
              </p>
              <p className="mt-1 font-mono text-xs font-bold text-white/42">/100</p>
            </div>
          </div>
          <p className="system-muted-copy mt-4 text-sm leading-6">{hasHydrated ? pressureDetail : "Reading live app state."}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-white/48">
            <span className="system-system-label font-mono uppercase tracking-[0.08em]">Readiness</span>
            <span className="font-mono">{hasHydrated ? `${readinessScore}%` : "--"}</span>
          </div>
          <div className="system-progress-track h-1.5">
            <div
              className={`system-progress-fill ${readinessTone} ${getProgressFillStateClass(hasHydrated ? readinessScore : 0)} transition-[width] duration-200 ease-out`}
              style={{ width: `${hasHydrated ? readinessScore : 0}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatusMetric label="Overdue" value={hasHydrated ? String(overdueCount) : "--"} active={overdueCount > 0} />
          <StatusMetric label="Today" value={hasHydrated ? String(dueTodayCount) : "--"} active={dueTodayCount > 0} emphasized />
          <StatusMetric label="At Risk" value={hasHydrated ? String(atRiskCount) : "--"} active={atRiskCount > 0} />
        </div>

        <div className="mt-auto rounded-[1.35rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_34%),var(--bg-2)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_12px_18px_rgba(88,108,148,0.012)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="system-system-label font-mono text-[0.62rem] font-bold uppercase leading-none tracking-[0.08em]">Fitness Signal</p>
            <span className="font-mono text-xs font-bold text-white/60">{workoutComplete ? "Workout logged" : "Workout open"}</span>
          </div>
          <div className="space-y-3.5">
            <FitnessSignalRow label="Calories" value={formatProgress(calories, caloriesGoal, "kcal")} progress={caloriesProgress} />
            <FitnessSignalRow label="Protein" value={formatProgress(protein, proteinGoal, "g")} progress={proteinProgress} />
            <FitnessSignalRow label="Workout" value={workoutComplete ? "Done" : "Pending"} progress={workoutComplete ? 1 : 0} />
          </div>
        </div>
      </div>
    </aside>
    </>
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
      className={`system-stat-tile rounded-[0.8rem] px-2 py-2 sm:rounded-[1rem] sm:px-3 sm:py-3 ${
        active
          ? "border-white/[0.03]"
          : emphasized
            ? "border-white/[0.03]"
            : "border-white/[0.03]"
      }`}
    >
      <p className="system-system-label font-mono text-[0.54rem] font-bold uppercase tracking-[0.08em] sm:text-[0.63rem]">{label}</p>
      <p className="system-readout-value mt-1 font-mono text-xl font-black leading-none sm:mt-2 sm:text-2xl">{value}</p>
    </div>
  );
}

function FitnessSignalRow({ label, progress, value }: { label: string; progress: number; value: string }) {
  const toneClass = getProgressToneClass(clamp(progress, 0, 1));
  const normalizedProgress = clamp(progress, 0, 1);

  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
      <span className="font-mono font-bold text-white/60">{label}</span>
      <div className="system-progress-track h-1.5">
        <div
          className={`system-progress-fill ${toneClass} ${getProgressFillStateClass(normalizedProgress)} transition-[width] duration-200 ease-out`}
          style={{ width: `${normalizedProgress * 100}%` }}
        />
      </div>
      <span className="text-right font-mono font-bold text-white/60">{value}</span>
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
  const dailyChecksProgress = checks.length > 0 ? completedChecks / checks.length : 0;

  return (
    <section className="system-panel system-command-card system-borderless-card system-secondary-card relative min-w-0 overflow-hidden rounded-[0.95rem] p-2.5 backdrop-blur-md sm:rounded-[1.65rem] sm:p-6">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.09),rgba(136,150,178,0.07),transparent)]" />
      <div className="pointer-events-none absolute inset-y-8 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(180,190,210,0.09),transparent)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.032] [background-image:radial-gradient(circle_at_15%_25%,rgba(255,255,255,0.34)_0_0.28px,transparent_0.72px),radial-gradient(circle_at_73%_43%,rgba(185,190,210,0.1)_0_0.34px,transparent_0.86px),radial-gradient(circle_at_42%_82%,rgba(255,255,255,0.09)_0_0.26px,transparent_0.68px)] [background-position:0_0,22px_17px,70px_41px] [background-size:180px_140px,270px_210px,230px_180px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.016),transparent_31%,rgba(136,150,178,0.008)_72%,transparent)]" />
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.08),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_48%_52%,transparent_0%,transparent_54%,rgba(0,0,0,0.46)_100%)]" />

      <div className="relative space-y-2.5 sm:space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="system-system-label font-mono text-[0.62rem] font-bold uppercase leading-none tracking-[0.08em]">Daily Checks</p>
            <h2 className="mt-1 text-base font-black leading-none tracking-[-0.01em] sm:mt-2 sm:text-2xl">Daily Checks</h2>
            <p className="system-muted-copy mt-2 hidden text-sm leading-5 sm:block">Fitness targets and completion signals</p>
          </div>
          <span className="w-fit rounded-full border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_38%),rgba(180,190,210,0.035)] px-2 py-0.5 font-mono text-[10px] font-bold text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[6px] sm:px-3.5 sm:py-1.5 sm:text-xs">
            {hasHydrated ? `${completedChecks} / 3 complete` : "Loading"}
          </span>
        </div>

        <div className="system-progress-track">
          <div
            className={`system-progress-fill system-progress-fill-success ${getProgressFillStateClass(dailyChecksProgress)} transition-[width] duration-200 ease-out`}
            style={{ width: `${hasHydrated ? dailyChecksProgress * 100 : 0}%` }}
          />
        </div>

        <div className="overflow-hidden rounded-[0.95rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent_34%),var(--bg-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:rounded-[1.25rem]">
          {checks.map((check) => (
            <DailyCheckRow key={check.kind} check={check} />
          ))}
        </div>

        <div className="rounded-[0.9rem] border border-white/[0.055] bg-[linear-gradient(180deg,rgba(255,255,255,0.014),transparent_34%),var(--bg-2)] px-2.5 py-2 sm:rounded-[1.1rem] sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm">
            <span className="system-muted-copy font-medium">Momentum</span>
            <span className="text-white/20">/</span>
            <span className="font-semibold text-[rgba(186,198,216,0.58)]">
              Workout streak: {hasHydrated ? `${workoutStreak}d` : "--"}
            </span>
            <span className="text-white/20">/</span>
            <span className="font-semibold text-[rgba(186,198,216,0.58)]">
              Calorie streak: {hasHydrated ? `${calorieStreak}d` : "--"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function DailyCheckRow({ check }: { check: DailyCheck }) {
  const isComplete = check.state === "complete";
  const isLoading = check.state === "loading";
  const isInProgress = check.state === "pending" && check.statusLabel.includes("left");

  return (
    <div
      className={`border-b border-white/[0.03] bg-[linear-gradient(180deg,rgba(255,255,255,0.016),transparent_34%),var(--bg-2)] px-2.5 py-2 transition-colors duration-150 last:border-b-0 hover:bg-[var(--bg-3)] sm:px-4 sm:py-4 ${
        isComplete
          ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_34%),var(--bg-3)]"
          : isInProgress
            ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent_34%),var(--bg-2)]"
            : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[0.82rem] font-bold leading-4 text-[rgba(238,243,250,0.94)] sm:text-[0.95rem]">{check.label}</p>
          <p className="system-muted-copy mt-0.5 text-[0.7rem] leading-4 sm:text-sm">{check.descriptor}</p>
        </div>
        <div className="flex min-w-0 shrink-0 basis-[5.75rem] flex-col items-end gap-1 text-right sm:basis-auto">
          {isComplete ? (
            <span className="semantic-neutral inline-flex max-w-full items-center gap-1 truncate px-1.5 py-0.5 font-mono text-[0.62rem] font-bold sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs">
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
            <span className="semantic-neutral max-w-full truncate px-1.5 py-0.5 font-mono text-[0.62rem] font-bold sm:px-3 sm:py-1 sm:text-xs">
              {check.statusLabel}
            </span>
          ) : (
            <span className="semantic-neutral max-w-full truncate px-1.5 py-0.5 font-mono text-[0.62rem] font-bold sm:px-3 sm:py-1 sm:text-xs">
              {isLoading ? "Loading" : check.statusLabel}
            </span>
          )}
          <span className="max-w-full whitespace-normal break-words font-mono text-[0.62rem] font-bold leading-3 text-[rgba(178,192,214,0.62)] sm:text-xs sm:leading-4">{check.value}</span>
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
    <aside className="system-panel system-command-card system-secondary-card relative min-w-0 overflow-hidden rounded-[0.95rem] p-2.5 backdrop-blur-md sm:rounded-[1.65rem] sm:p-6">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.09),rgba(136,150,178,0.07),transparent)]" />
      <div className="pointer-events-none absolute inset-y-8 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(180,190,210,0.09),transparent)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.032] [background-image:radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.32)_0_0.28px,transparent_0.72px),radial-gradient(circle_at_74%_46%,rgba(185,190,210,0.1)_0_0.34px,transparent_0.86px),radial-gradient(circle_at_41%_82%,rgba(255,255,255,0.09)_0_0.26px,transparent_0.68px)] [background-position:0_0,19px_23px,64px_37px] [background-size:180px_140px,270px_210px,230px_180px]" />
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,190,210,0.08),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,transparent_0%,transparent_50%,rgba(0,0,0,0.48)_100%)]" />

      <div className="relative flex h-full flex-col gap-2.5 sm:gap-5">
        <div className="flex items-center justify-between gap-3 lg:block">
          <p className="system-system-label font-mono text-[0.62rem] font-bold uppercase leading-none tracking-[0.08em]">Today Pressure</p>
          <h2 className="text-lg font-black leading-none tracking-[-0.01em] lg:mt-2 lg:text-2xl">Pressure</h2>
        </div>
        <div className="grid grid-cols-4 gap-1.5 max-[430px]:grid-cols-2 sm:gap-2 lg:grid-cols-1">
          <PressureItem label="Overdue" value={hasHydrated ? String(overdueCount) : "--"} active={overdueCount > 0} />
          <PressureItem label="Due Today" value={hasHydrated ? String(dueTodayCount) : "--"} active={dueTodayCount > 0} />
          <PressureItem label="Due Tomorrow" value={hasHydrated ? String(dueTomorrowCount) : "--"} active={dueTomorrowCount > 0} />
          <PressureItem label="Checks Left" value={hasHydrated ? String(checksLeft) : "--"} active={checksLeft > 0} />
        </div>
      </div>
    </aside>
  );
}

function PressureItem({ active, label, value }: { active: boolean; label: string; value: string }) {
  return (
    <div
      className={`system-stat-tile rounded-[0.8rem] px-2.5 py-2 sm:rounded-[1rem] sm:px-3 sm:py-3 ${
        active
          ? "border-white/[0.03] text-white"
          : "border-white/[0.03]"
      }`}
    >
      <p className="system-system-label font-mono text-[0.56rem] font-bold uppercase tracking-[0.08em] sm:text-[0.68rem]">{label}</p>
      <p className={`system-readout-value mt-1 font-mono text-xl font-black leading-none sm:mt-2 sm:text-2xl ${active ? "" : "opacity-65"}`}>{value}</p>
    </div>
  );
}
