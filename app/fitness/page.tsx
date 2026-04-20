"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  LIFT_LABELS,
  LIFT_TYPES,
  appendLiftEntry,
  getLatestLiftEntry,
  getLiftSummaries,
  readLiftEntries,
  persistLiftEntries,
  type LiftEntry,
  type LiftTrend,
  type LiftType,
} from "@/lib/fitness/lifts";
import {
  createEmptyFitnessDayLog,
  getDateKeysInRange,
  getFitnessWindowSummary,
  getLatestWeight,
  getLocalDateKey,
  getWeightTrendSummary,
  getWeeklyWorkoutCount,
  listFitnessLogs,
  listWeightLogs,
} from "@/lib/fitness/storage";
import { useFitnessState } from "@/lib/fitness/useFitnessState";

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthDayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthYearFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const calendarWeekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ActiveDialog = "calories" | "protein" | "weight" | "lift" | null;
type ActiveTab = "today" | "progress";
type QuickAction = "calories" | "protein" | "weight";
type LiftDraft = {
  lift: LiftType;
  weight: string;
  reps: string;
};

const summarySurfaceClassName =
  "system-subtle-panel rounded-[18px] px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.42)]";
const actionButtonClassName =
  "system-button-secondary rounded-[18px] px-4 py-3 text-left text-sm font-semibold";
const primaryActionButtonClassName =
  "system-button-primary rounded-[18px] px-4 py-3 text-left text-sm font-semibold";
const compactPrimaryButtonClassName =
  "system-button-primary rounded-xl px-4 py-2.5 text-sm font-semibold";
const inactiveIndicatorClassName = "border border-white/[0.07] bg-white/[0.02]";
const liftMetaBadgeClassName =
  "system-pill px-2.5 py-1 text-[11px] font-semibold text-white/58";
const liftPrBadgeClassName =
  "inline-flex items-center rounded-full border border-emerald-200/15 bg-emerald-300/[0.08] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-emerald-50/85";

function createDefaultLiftDraft(): LiftDraft {
  return {
    lift: "bench",
    weight: "",
    reps: "",
  };
}

function formatDayLabel(dateKey: string, todayKey: string) {
  if (dateKey === todayKey) {
    return "Today";
  }

  return weekdayFormatter.format(new Date(`${dateKey}T12:00:00`));
}

function formatShortDate(dateKey: string) {
  return monthDayFormatter.format(new Date(`${dateKey}T12:00:00`));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.round(value));
}

function formatWeight(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${value} lb`;
}

function formatWeightValue(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, "");
}

function formatLiftPerformance(entry: Pick<LiftEntry, "weight" | "reps">) {
  const weight = formatWeightValue(entry.weight);

  return entry.reps === null ? weight : `${weight} x ${entry.reps}`;
}

function formatEstimatedOneRepMax(value: number | null) {
  if (value === null) {
    return null;
  }

  return `${formatWeightValue(value)} lb e1RM`;
}

function formatLiftTrendText(trend: LiftTrend, withContext = false) {
  const indicator =
    trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "↔";

  if (trend.direction === "same") {
    return withContext ? `${indicator} same as last entry` : `${indicator} same`;
  }

  const deltaLabel = `${trend.delta > 0 ? "+" : ""}${formatWeightValue(trend.delta)} lb`;

  return withContext ? `${indicator} ${deltaLabel} from last entry` : `${indicator} ${deltaLabel}`;
}

function getLiftEmptyState(lift: LiftType) {
  return `Log your first ${LIFT_LABELS[lift].toLowerCase()}`;
}

function StrengthStatLine({
  label,
  entry,
  detail,
  emptyValue = "--",
  emptyDetail = null,
}: {
  label: string;
  entry: Pick<LiftEntry, "weight" | "reps"> | null;
  detail?: string | null;
  emptyValue?: string;
  emptyDetail?: string | null;
}) {
  const value = entry ? formatLiftPerformance(entry) : emptyValue;
  const helperText = entry ? detail : emptyDetail;

  return (
    <div className="system-subtle-panel flex items-start justify-between gap-3 rounded-[14px] px-3 py-2.5">
      <span className="system-label text-white/38">
        {label}
      </span>
      <div className="text-right">
        <p className={`text-sm font-semibold ${entry ? "text-white" : "text-white/35"}`}>{value}</p>
        {helperText ? <p className="mt-1 text-[11px] text-white/35">{helperText}</p> : null}
      </div>
    </div>
  );
}

function buildMonthCalendar(referenceDate: Date, todayKey: string) {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

  monthStart.setHours(12, 0, 0, 0);
  monthEnd.setHours(12, 0, 0, 0);

  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  return getDateKeysInRange(gridStart, gridEnd).map((dateKey) => {
    const date = new Date(`${dateKey}T12:00:00`);

    return {
      dateKey,
      dateNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === referenceDate.getMonth(),
      isToday: dateKey === todayKey,
      isFuture: dateKey > todayKey,
    };
  });
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatProgressText(progress: number) {
  return `${Math.round(progress * 100)}%`;
}

function ProgressModule({
  label,
  value,
  goal,
  unit = "",
  progress,
}: {
  label: string;
  value: number;
  goal: number;
  unit?: string;
  progress: number;
}) {
  const clampedProgress = clampProgress(progress * 100);
  const remaining = Math.max(0, goal - value);

  return (
    <div className={summarySurfaceClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="system-label text-white/45">
            {label}
          </span>
          <p className="mt-2 text-xl font-semibold tracking-tight text-white">
            {formatNumber(value)}
            {unit}
          </p>
        </div>
        <span className="system-pill px-2.5 py-1 text-xs font-semibold text-white/72">
          {formatProgressText(progress)}
        </span>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-white/88"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/45">
        <span>
          {formatNumber(value)}
          {unit} / {formatNumber(goal)}
          {unit}
        </span>
        <span>
          {remaining === 0
            ? "Goal hit"
            : `${formatNumber(remaining)}${unit} left`}
        </span>
      </div>
    </div>
  );
}

function QuickActionButton({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={actionButtonClassName} onClick={onClick}>
      <span className="block">{label}</span>
      <span className="mt-1 block text-xs font-medium text-white/45">{detail}</span>
    </button>
  );
}

function TabButton({
  label,
  tab,
  activeTab,
  onClick,
}: {
  label: string;
  tab: ActiveTab;
  activeTab: ActiveTab;
  onClick: (tab: ActiveTab) => void;
}) {
  const isActive = activeTab === tab;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition-all duration-200 ${
        isActive
          ? "bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,0.3)]"
          : "text-white/52 hover:bg-white/[0.04] hover:text-white"
      }`}
      onClick={() => onClick(tab)}
    >
      {label}
    </button>
  );
}

function ProgressStatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className={summarySurfaceClassName}>
      <p className="system-label text-white/45">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm text-white/45">{helper}</p>
    </div>
  );
}

function WeightTrendChart({
  entries,
}: {
  entries: Array<{ date: string; weight: number }>;
}) {
  const width = 320;
  const height = 160;
  const paddingX = 14;
  const paddingY = 16;
  const weights = entries.map((entry) => entry.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight;

  const points = entries.map((entry, index) => {
    const x =
      entries.length === 1
        ? width / 2
        : paddingX + (index * (width - paddingX * 2)) / (entries.length - 1);
    const y =
      range === 0
        ? height / 2
        : height -
          paddingY -
          ((entry.weight - minWeight) / range) * (height - paddingY * 2);

    return { x, y, weight: entry.weight };
  });

  const linePath = points.map((point) => `${point.x},${point.y}`).join(" ");
  const fillPath = [
    `${paddingX},${height - paddingY}`,
    linePath,
    `${width - paddingX},${height - paddingY}`,
  ].join(" ");
  const latestEntry = entries[entries.length - 1];
  const firstEntry = entries[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs text-white/45">
        <span>{entries.length} weigh-ins</span>
        <span>{formatWeight(latestEntry.weight)}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-black/45 px-2 py-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" aria-label="Weight trend chart" role="img">
          <defs>
            <linearGradient id="fitness-weight-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((step) => {
            const y = paddingY + step * (height - paddingY * 2);

            return (
              <line
                key={step}
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 8"
              />
            );
          })}

          <polyline
            points={fillPath}
            fill="url(#fitness-weight-fill)"
            stroke="none"
          />
          <polyline
            points={linePath}
            fill="none"
            stroke="rgba(255,255,255,0.72)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => (
            <circle
              key={`${entries[index].date}-${point.weight}`}
              cx={point.x}
              cy={point.y}
              r="2.5"
              fill="rgba(255,255,255,0.9)"
            />
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-white/45">
        <span>{formatShortDate(firstEntry.date)}</span>
        <span>
          {formatWeightValue(minWeight)} - {formatWeightValue(maxWeight)} lb
        </span>
        <span>{formatShortDate(latestEntry.date)}</span>
      </div>
    </div>
  );
}

function NumberEntryDialog({
  open,
  title,
  description,
  value,
  onValueChange,
  onClose,
  onSubmit,
  submitLabel,
  placeholder,
  step = "1",
}: {
  open: boolean;
  title: string;
  description: string;
  value: string;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  placeholder: string;
  step?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/78 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fitness-dialog-title"
        className="system-panel relative w-full max-w-sm rounded-[24px] p-4 shadow-[0_28px_76px_rgba(0,0,0,0.8)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="fitness-dialog-title" className="text-base font-semibold tracking-tight text-white">
              {title}
            </h3>
            <p className="mt-1 text-sm text-white/50">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="system-button-subtle px-2.5 py-1.5 text-sm text-white/65"
          >
            X
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="system-label mb-2 block text-white/45">Amount</span>
            <input
              autoFocus
              inputMode="decimal"
              min="0"
              step={step}
              type="number"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder={placeholder}
              className="system-input px-4 py-3 text-base placeholder:text-white/25"
            />
          </label>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="system-button-secondary px-4 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button type="submit" className={primaryActionButtonClassName}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LiftEntryDialog({
  open,
  draft,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: LiftDraft;
  onDraftChange: (draft: LiftDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/78 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fitness-lift-dialog-title"
        className="system-panel relative w-full max-w-sm rounded-[24px] p-4 shadow-[0_28px_76px_rgba(0,0,0,0.8)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="fitness-lift-dialog-title" className="text-base font-semibold tracking-tight text-white">
              Log lift
            </h3>
            <p className="mt-1 text-sm text-white/50">
              Save a quick strength entry for today.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="system-button-subtle px-2.5 py-1.5 text-sm text-white/65"
          >
            X
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <span className="system-label mb-2 block text-white/45">Lift</span>
            <div className="grid grid-cols-2 gap-2">
              {LIFT_TYPES.map((lift) => {
                const isActive = draft.lift === lift;

                return (
                  <button
                    key={lift}
                    type="button"
                    onClick={() => onDraftChange({ ...draft, lift })}
                    className={`rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                      isActive
                        ? "border-white/[0.2] bg-white text-black"
                        : "border-white/[0.08] bg-black/45 text-white/72 hover:border-white/[0.14] hover:text-white"
                    }`}
                  >
                    {LIFT_LABELS[lift]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="system-label mb-2 block text-white/45">Weight</span>
              <input
                autoFocus
                inputMode="decimal"
                min="0"
                step="0.5"
                type="number"
                value={draft.weight}
                onChange={(event) => onDraftChange({ ...draft, weight: event.target.value })}
                placeholder="145"
                className="system-input px-4 py-3 text-base placeholder:text-white/25"
              />
            </label>

            <label className="block">
              <span className="system-label mb-2 block text-white/45">Reps</span>
              <input
                inputMode="numeric"
                min="1"
                step="1"
                type="number"
                value={draft.reps}
                onChange={(event) => onDraftChange({ ...draft, reps: event.target.value })}
                placeholder="8"
                className="system-input px-4 py-3 text-base placeholder:text-white/25"
              />
            </label>
          </div>

          <p className="text-xs text-white/38">Saved with today’s date.</p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="system-button-secondary px-4 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button type="submit" className={primaryActionButtonClassName}>
              Save lift
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FitnessPage() {
  const {
    fitnessState,
    hasHydrated,
    updateFitnessState,
  } = useFitnessState();
  const [liftEntries, setLiftEntries] = useState<LiftEntry[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [draftValue, setDraftValue] = useState("");
  const [liftDraft, setLiftDraft] = useState<LiftDraft>(createDefaultLiftDraft);
  const [showFullHistory, setShowFullHistory] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const hydratedLiftEntries = readLiftEntries();
      persistLiftEntries(hydratedLiftEntries);
      setLiftEntries(hydratedLiftEntries);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const todayKey = getLocalDateKey();
  const todayDate = useMemo(() => new Date(`${todayKey}T12:00:00`), [todayKey]);

  const todayLog = fitnessState.dailyLogs[todayKey] ?? createEmptyFitnessDayLog(todayKey);
  const latestWeight = useMemo(() => getLatestWeight(fitnessState), [fitnessState]);
  const weeklyWorkoutCount = useMemo(() => getWeeklyWorkoutCount(fitnessState), [fitnessState]);
  const weightTrendSummary = useMemo(() => getWeightTrendSummary(fitnessState), [fitnessState]);
  const recentLogs = useMemo(() => {
    const startDate = new Date(todayDate);
    startDate.setDate(todayDate.getDate() - 6);
    const recentKeys = getDateKeysInRange(startDate, todayDate).reverse();

    return recentKeys.map((dateKey) => ({
      date: dateKey,
      log: fitnessState.dailyLogs[dateKey] ?? createEmptyFitnessDayLog(dateKey),
    }));
  }, [fitnessState.dailyLogs, todayDate]);
  const latestLogs = useMemo(() => listFitnessLogs(fitnessState), [fitnessState]);
  const currentMonthSummary = useMemo(() => {
    const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    monthStart.setHours(12, 0, 0, 0);

    return getFitnessWindowSummary(fitnessState, monthStart, todayDate);
  }, [fitnessState, todayDate]);
  const currentMonthCalendar = useMemo(
    () => buildMonthCalendar(todayDate, todayKey),
    [todayDate, todayKey],
  );
  const liftSummaries = useMemo(() => getLiftSummaries(liftEntries), [liftEntries]);
  const latestStrengthEntry = useMemo(() => getLatestLiftEntry(liftEntries), [liftEntries]);
  const latestStrengthSummary = useMemo(() => {
    if (!latestStrengthEntry) {
      return null;
    }

    return liftSummaries.find(({ lift }) => lift === latestStrengthEntry.lift) ?? null;
  }, [liftSummaries, latestStrengthEntry]);
  const weightTrendEntries = useMemo(() => listWeightLogs(fitnessState).slice(-20), [fitnessState]);
  const visibleRecentLogs = showFullHistory ? recentLogs : recentLogs.slice(0, 3);
  const hasEnoughWeightLogsForTrend = useMemo(
    () => recentLogs.filter(({ log }) => log.weight !== null).length >= 2,
    [recentLogs],
  );
  const hasEnoughWeightPointsForChart = weightTrendEntries.length >= 2;
  const currentMonthLabel = monthYearFormatter.format(todayDate);

  const caloriesProgress = todayLog.calories / Math.max(fitnessState.goals.caloriesGoal, 1);
  const proteinProgress = todayLog.protein / Math.max(fitnessState.goals.proteinGoal, 1);

  const openDialog = (dialog: QuickAction) => {
    setDraftValue("");
    setActiveDialog(dialog);
  };

  const openLiftDialog = () => {
    setLiftDraft(createDefaultLiftDraft());
    setActiveDialog("lift");
  };

  const closeDialog = () => {
    setDraftValue("");
    setLiftDraft(createDefaultLiftDraft());
    setActiveDialog(null);
  };

  const handleDialogSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedValue = Number(draftValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0 || !activeDialog || activeDialog === "lift") {
      return;
    }

    updateFitnessState((currentState, resolvedTodayKey) => {
      const currentLog = currentState.dailyLogs[resolvedTodayKey];

      switch (activeDialog) {
        case "calories":
          return {
            ...currentState,
            dailyLogs: {
              ...currentState.dailyLogs,
              [resolvedTodayKey]: {
                ...currentLog,
                calories: currentLog.calories + parsedValue,
              },
            },
          };
        case "protein":
          return {
            ...currentState,
            dailyLogs: {
              ...currentState.dailyLogs,
              [resolvedTodayKey]: {
                ...currentLog,
                protein: currentLog.protein + parsedValue,
              },
            },
          };
        case "weight":
          return {
            ...currentState,
            dailyLogs: {
              ...currentState.dailyLogs,
              [resolvedTodayKey]: {
                ...currentLog,
                weight: parsedValue,
              },
            },
          };
        default:
          return currentState;
      }
    });

    closeDialog();
  };

  const handleLiftSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedWeight = Number(liftDraft.weight);
    const parsedReps =
      liftDraft.reps.trim() === "" ? null : Number(liftDraft.reps);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      return;
    }

    if (
      parsedReps !== null &&
      (!Number.isInteger(parsedReps) || parsedReps <= 0)
    ) {
      return;
    }

    const resolvedTodayKey = getLocalDateKey();

    setLiftEntries((currentEntries) => {
      const nextEntries = appendLiftEntry(currentEntries, {
        date: resolvedTodayKey,
        lift: liftDraft.lift,
        weight: parsedWeight,
        reps: parsedReps,
      });

      persistLiftEntries(nextEntries);
      return nextEntries;
    });

    closeDialog();
  };

  const toggleWorkout = () => {
    updateFitnessState((currentState, resolvedTodayKey) => {
      const currentLog = currentState.dailyLogs[resolvedTodayKey];

      return {
        ...currentState,
        dailyLogs: {
          ...currentState.dailyLogs,
          [resolvedTodayKey]: {
            ...currentLog,
            workoutCompleted: !currentLog.workoutCompleted,
          },
        },
      };
    });
  };

  const dialogTitle =
    activeDialog === "calories"
      ? "Add calories"
      : activeDialog === "protein"
        ? "Add protein"
        : activeDialog === "weight"
          ? "Log weight"
          : "";
  const dialogDescription =
    activeDialog === "calories"
      ? "Add to today’s calorie total."
      : activeDialog === "protein"
        ? "Add to today’s protein total."
        : activeDialog === "weight"
          ? "Save your latest bodyweight for today."
          : "";
  const dialogSubmitLabel =
    activeDialog === "weight" ? "Save weight" : activeDialog === "protein" ? "Add protein" : "Add calories";
  const dialogPlaceholder =
    activeDialog === "calories" ? "500" : activeDialog === "protein" ? "40" : "182.4";
  const dialogStep = activeDialog === "weight" ? "0.1" : "1";
  const quickActions: Array<{ type: QuickAction; label: string; detail: string }> = [
    { type: "calories", label: "Add calories", detail: "Increment today's total" },
    { type: "protein", label: "Add protein", detail: "Add grams to today" },
    { type: "weight", label: "Log weight", detail: "Set today's weigh-in" },
  ];
  const hasLiftEntries = liftEntries.length > 0;
  const isNumberDialogOpen = activeDialog !== null && activeDialog !== "lift";
  const weightTrendHelperText = hasEnoughWeightLogsForTrend
    ? null
    : "Add today's weight to get started.";

  return (
    <>
      <div className="animate-fadeIn space-y-5 sm:space-y-6">
        <section className="space-y-1.5">
          <h2 className="text-[1.75rem] font-semibold tracking-tight text-white sm:text-2xl">
            Fitness
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-white/50">
            Fast daily tracking for calories, protein, training, and your latest weight.
          </p>
          <div
            role="tablist"
            aria-label="Fitness views"
            className="system-subtle-panel mt-4 inline-flex rounded-[18px] p-1"
          >
            <TabButton
              label="Today"
              tab="today"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <TabButton
              label="Progress"
              tab="progress"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
          </div>
        </section>

        {activeTab === "today" ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card title="Calories today" subtitle={`Goal ${formatNumber(fitnessState.goals.caloriesGoal)} kcal`} variant="dark">
                <div className={summarySurfaceClassName}>
                  <p className="text-3xl font-semibold tracking-tight text-white">
                    {hasHydrated ? formatNumber(todayLog.calories) : "--"}
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    {hasHydrated
                      ? `${Math.round(caloriesProgress * 100)}% of goal`
                      : "Loading today’s totals"}
                  </p>
                </div>
              </Card>

              <Card title="Protein today" subtitle={`Goal ${formatNumber(fitnessState.goals.proteinGoal)} g`} variant="dark">
                <div className={summarySurfaceClassName}>
                  <p className="text-3xl font-semibold tracking-tight text-white">
                    {hasHydrated ? `${formatNumber(todayLog.protein)}g` : "--"}
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    {hasHydrated
                      ? `${Math.round(proteinProgress * 100)}% of goal`
                      : "Loading today’s totals"}
                  </p>
                </div>
              </Card>

              <Card title="Workout today" subtitle="Status" variant="dark">
                <div className={summarySurfaceClassName}>
                  <p className="text-3xl font-semibold tracking-tight text-white">
                    {hasHydrated ? (todayLog.workoutCompleted ? "Done" : "Pending") : "--"}
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    {hasHydrated
                      ? todayLog.workoutCompleted
                        ? "Marked complete for today"
                        : "Still open today"
                      : "Loading workout status"}
                  </p>
                </div>
              </Card>

              <Card title="Latest weight" subtitle="Most recent log" variant="dark">
                <div className={summarySurfaceClassName}>
                  <p className="text-3xl font-semibold tracking-tight text-white">
                    {hasHydrated ? formatWeight(latestWeight) : "--"}
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    {hasHydrated ? weightTrendSummary : "Loading weight trend"}
                  </p>
                </div>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
              <Card
                title="Snapshot"
                subtitle="Progress against your saved daily targets"
                variant="dark"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <ProgressModule
                    label="Calories"
                    value={todayLog.calories}
                    goal={fitnessState.goals.caloriesGoal}
                    progress={caloriesProgress}
                  />

                  <ProgressModule
                    label="Protein"
                    value={todayLog.protein}
                    goal={fitnessState.goals.proteinGoal}
                    unit="g"
                    progress={proteinProgress}
                  />

                  <div className={summarySurfaceClassName}>
                    <span className="system-label text-white/45">Weekly Workouts</span>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                      {hasHydrated ? `${weeklyWorkoutCount}/7` : "--"}
                    </p>
                    <p className="mt-2 text-sm text-white/50">
                      Completed over the last 7 days
                    </p>
                  </div>

                  <div className={summarySurfaceClassName}>
                    <span className="system-label text-white/45">Weight Trend</span>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                      {hasHydrated ? formatWeight(latestWeight) : "--"}
                    </p>
                    <p className="mt-2 text-sm text-white/50">{hasHydrated ? weightTrendSummary : "Loading trend"}</p>
                    {hasHydrated && weightTrendHelperText ? (
                      <p className="mt-1 text-xs text-white/35">{weightTrendHelperText}</p>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card title="Quick actions" subtitle="Short inputs, no big forms" variant="dark">
                <div className="grid gap-3 sm:grid-cols-2">
                  {quickActions.map((action) => (
                    <QuickActionButton
                      key={action.type}
                      label={action.label}
                      detail={action.detail}
                      onClick={() => openDialog(action.type)}
                    />
                  ))}
                  <button
                    type="button"
                    className={todayLog.workoutCompleted ? actionButtonClassName : primaryActionButtonClassName}
                    onClick={toggleWorkout}
                  >
                    <span className="block">
                      {todayLog.workoutCompleted ? "Undo workout" : "Mark workout complete"}
                    </span>
                    <span className={`mt-1 block text-xs font-medium ${todayLog.workoutCompleted ? "text-white/45" : "text-black/65"}`}>
                      {todayLog.workoutCompleted ? "Clear today's training status" : "Keep today's streak current"}
                    </span>
                  </button>
                </div>

                <div className={`${summarySurfaceClassName} mt-4`}>
                  <p className="system-label text-white/45">Saved Goals</p>
                  <p className="mt-2 text-sm text-white/70">
                    {formatNumber(fitnessState.goals.caloriesGoal)} kcal and{" "}
                    {formatNumber(fitnessState.goals.proteinGoal)}g protein per day.
                  </p>
                </div>
              </Card>
            </section>

            <section>
              <Card title="Last 7 days" subtitle="Compact history preview" variant="dark">
                <div className="space-y-2">
                  {visibleRecentLogs.map(({ date, log }) => (
                    <div
                      key={date}
                      className="system-subtle-panel flex flex-col gap-2 rounded-[18px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {formatDayLabel(date, todayKey)}
                        </p>
                        <p className="text-xs text-white/40">{formatShortDate(date)}</p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-[11px] text-white/70">
                        <span className="system-pill px-2.5 py-1">
                          {formatNumber(log.calories)} kcal
                        </span>
                        <span className="system-pill px-2.5 py-1">
                          {formatNumber(log.protein)}g protein
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 ${
                            log.workoutCompleted
                              ? "border border-emerald-500/18 bg-emerald-500/10 text-emerald-100"
                              : "border border-white/[0.07] bg-white/[0.03] text-white/60"
                          }`}
                        >
                          {log.workoutCompleted ? "Workout done" : "No workout"}
                        </span>
                        <span className="system-pill px-2.5 py-1">
                          {log.weight === null ? "No weight" : `${log.weight} lb`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-white/40">
                    {latestLogs.length > 0
                      ? `Tracking ${latestLogs.length} saved day${latestLogs.length === 1 ? "" : "s"} in local storage.`
                      : "No saved history yet."}
                  </p>

                  <button
                    type="button"
                    className="system-pill px-3 py-1.5 text-xs font-semibold text-white/72"
                    onClick={() => setShowFullHistory((current) => !current)}
                  >
                    {showFullHistory ? "Show less" : "View all 7 days"}
                  </button>
                </div>
              </Card>
            </section>
          </>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ProgressStatCard
                label="Workouts this month"
                value={hasHydrated ? formatNumber(currentMonthSummary.workoutsCompleted) : "--"}
                helper={hasHydrated ? `${currentMonthSummary.totalDays} days in the month-to-date view` : "Loading month summary"}
              />
              <ProgressStatCard
                label="Calorie goal hit rate"
                value={hasHydrated ? `${currentMonthSummary.calorieGoalHits} / ${currentMonthSummary.totalDays}` : "--"}
                helper={
                  hasHydrated
                    ? `${Math.round((currentMonthSummary.calorieGoalHits / Math.max(currentMonthSummary.totalDays, 1)) * 100)}% of days at goal`
                    : "Loading month summary"
                }
              />
              <ProgressStatCard
                label="Average calories"
                value={hasHydrated ? `${formatNumber(currentMonthSummary.averageCalories)} kcal` : "--"}
                helper={hasHydrated ? "Month-to-date daily average" : "Loading month summary"}
              />
              <ProgressStatCard
                label="Average protein"
                value={hasHydrated ? `${formatNumber(currentMonthSummary.averageProtein)}g` : "--"}
                helper={hasHydrated ? "Month-to-date daily average" : "Loading month summary"}
              />
            </section>

            <section>
              <Card title="Monthly calendar" subtitle={`${currentMonthLabel} consistency`} variant="dark">
                <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/45">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-white/80" />
                      Workout
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-white/35" />
                      Protein goal
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-md border border-white/[0.14] bg-white/[0.08]" />
                      Calorie goal
                    </span>
                  </div>
                  <span>
                    {hasHydrated
                      ? `${currentMonthSummary.proteinGoalHits} protein goal day${currentMonthSummary.proteinGoalHits === 1 ? "" : "s"}`
                      : "Loading month summary"}
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-2 text-[11px] text-white/32">
                  {calendarWeekdayLabels.map((weekday) => (
                    <div key={weekday} className="px-1 py-1 text-center">
                      {weekday}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {currentMonthCalendar.map(({ dateKey, dateNumber, inCurrentMonth, isToday, isFuture }) => {
                    const log = fitnessState.dailyLogs[dateKey];
                    const calorieGoalHit = Boolean(
                      log && log.calories >= fitnessState.goals.caloriesGoal && !isFuture,
                    );
                    const proteinGoalHit = Boolean(
                      log && log.protein >= fitnessState.goals.proteinGoal && !isFuture,
                    );
                    const workoutCompleted = Boolean(log?.workoutCompleted && !isFuture);

                    return (
                      <div
                        key={dateKey}
                        aria-label={`${dateKey}: ${workoutCompleted ? "workout complete, " : ""}${calorieGoalHit ? "calorie goal hit, " : ""}${proteinGoalHit ? "protein goal hit" : ""}`.trim()}
                        className={`min-h-[74px] rounded-2xl border px-2.5 py-2 transition-colors ${
                          calorieGoalHit
                            ? "border-white/[0.14] bg-white/[0.08]"
                            : "border-white/[0.05] bg-black/35"
                        } ${
                          inCurrentMonth ? "text-white/80" : "text-white/20"
                        } ${isToday ? "ring-1 ring-white/20" : ""} ${isFuture ? "opacity-45" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-sm font-semibold ${isToday ? "text-white" : ""}`}>
                            {dateNumber}
                          </span>
                          {isToday ? <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/70" /> : null}
                        </div>

                        <div className="mt-6 flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              workoutCompleted ? "bg-white/80" : inactiveIndicatorClassName
                            }`}
                          />
                          <span
                            className={`h-2 w-2 rounded-full ${
                              proteinGoalHit ? "bg-white/35" : inactiveIndicatorClassName
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </section>

            <section>
              <Card title="Weight trend" subtitle="Recent weigh-ins" variant="dark">
                {!hasHydrated ? (
                  <div className={summarySurfaceClassName}>
                    <p className="text-sm text-white/55">Loading weight trend...</p>
                  </div>
                ) : hasEnoughWeightPointsForChart ? (
                  <div className={summarySurfaceClassName}>
                    <WeightTrendChart entries={weightTrendEntries} />
                  </div>
                ) : (
                  <div className={summarySurfaceClassName}>
                    <p className="text-base font-semibold text-white">Log a few weigh-ins to see your trend</p>
                    <p className="mt-2 text-sm text-white/45">
                      Add at least two valid weight entries to draw the recent trend line.
                    </p>
                  </div>
                )}
              </Card>
            </section>

            <section>
              <Card title="Strength" subtitle="Compact lift tracking" variant="dark">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className={`${summarySurfaceClassName} flex-1`}>
                    {hasHydrated ? (
                      latestStrengthEntry ? (
                        <>
                          <p className="system-label text-white/45">Latest Strength Log</p>
                          <p className="mt-2 text-xl font-semibold tracking-tight text-white">
                            {LIFT_LABELS[latestStrengthEntry.lift]}
                            <span className="px-1.5 text-white/32">·</span>
                            {formatLiftPerformance(latestStrengthEntry)}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/50">
                            {latestStrengthSummary?.isLatestHeaviest ? (
                              <span className={liftPrBadgeClassName}>New heaviest</span>
                            ) : null}
                            {latestStrengthSummary?.isLatestBestSet ? (
                              <span className={liftPrBadgeClassName}>New best set</span>
                            ) : null}
                            {latestStrengthSummary?.isLatestBestWorkingSet ? (
                              <span className={liftPrBadgeClassName}>New working PR</span>
                            ) : null}
                            {latestStrengthSummary?.trend ? (
                              <span className={liftMetaBadgeClassName}>
                                {formatLiftTrendText(latestStrengthSummary.trend, true)}
                              </span>
                            ) : null}
                            <span className={liftMetaBadgeClassName}>
                              Logged {formatShortDate(latestStrengthEntry.date)}
                            </span>
                          </div>
                          <div
                            className={`mt-4 grid gap-2 ${
                              latestStrengthSummary?.bestWorkingSetEntry ? "sm:grid-cols-4" : "sm:grid-cols-3"
                            }`}
                          >
                            <StrengthStatLine
                              label="Latest"
                              entry={latestStrengthSummary?.latestEntry ?? latestStrengthEntry}
                            />
                            <StrengthStatLine
                              label="Heaviest"
                              entry={latestStrengthSummary?.heaviestEntry ?? null}
                            />
                            <StrengthStatLine
                              label="Best set"
                              entry={latestStrengthSummary?.bestSetEntry ?? null}
                              detail={formatEstimatedOneRepMax(
                                latestStrengthSummary?.bestSetEstimatedOneRepMax ?? null,
                              )}
                              emptyDetail="Add reps to compare sets"
                            />
                            {latestStrengthSummary?.bestWorkingSetEntry ? (
                              <StrengthStatLine
                                label="Working"
                                entry={latestStrengthSummary.bestWorkingSetEntry}
                                detail={formatEstimatedOneRepMax(
                                  latestStrengthSummary.bestWorkingSetEstimatedOneRepMax,
                                )}
                              />
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="system-label text-white/45">Strength Summary</p>
                          <p className="mt-2 text-base font-semibold text-white">
                            No lift entries yet
                          </p>
                          <p className="mt-1 text-sm text-white/45">
                            Log bench, squat, deadlift, or overhead press.
                          </p>
                        </>
                      )
                    ) : (
                      <p className="text-sm text-white/55">Loading strength logs...</p>
                    )}
                  </div>

                  <button
                    type="button"
                    className={compactPrimaryButtonClassName}
                    onClick={openLiftDialog}
                  >
                    Log lift
                  </button>
                </div>

                {hasHydrated ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {liftSummaries.map(
                      ({
                        lift,
                        latestEntry,
                        heaviestEntry,
                        bestSetEntry,
                        bestSetEstimatedOneRepMax,
                        bestWorkingSetEntry,
                        bestWorkingSetEstimatedOneRepMax,
                        isLatestHeaviest,
                        isLatestBestSet,
                        isLatestBestWorkingSet,
                        trend,
                      }) => (
                      <div
                        key={lift}
                        className="rounded-2xl border border-white/[0.05] bg-black/40 px-4 py-3.5 shadow-[0_18px_44px_rgba(0,0,0,0.42)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">{LIFT_LABELS[lift]}</p>
                            {latestEntry ? (
                              <>
                                <div className="mt-3 space-y-2">
                                  <StrengthStatLine label="Latest" entry={latestEntry} />
                                  <StrengthStatLine label="Heaviest" entry={heaviestEntry} />
                                  <StrengthStatLine
                                    label="Best set"
                                    entry={bestSetEntry}
                                    detail={formatEstimatedOneRepMax(bestSetEstimatedOneRepMax)}
                                    emptyDetail="Add reps to compare sets"
                                  />
                                  <StrengthStatLine
                                    label="Working"
                                    entry={bestWorkingSetEntry}
                                    detail={formatEstimatedOneRepMax(bestWorkingSetEstimatedOneRepMax)}
                                    emptyDetail="No working sets yet"
                                  />
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/50">
                                  <span className={liftMetaBadgeClassName}>
                                    {formatShortDate(latestEntry.date)}
                                  </span>
                                  {trend ? (
                                    <span className={liftMetaBadgeClassName}>
                                      {formatLiftTrendText(trend)}
                                    </span>
                                  ) : null}
                                </div>
                              </>
                            ) : (
                              <p className="mt-2 text-sm text-white/40">{getLiftEmptyState(lift)}</p>
                            )}
                          </div>

                          {latestEntry ? (
                            <div className="flex flex-col items-end gap-1.5">
                              {isLatestHeaviest ? (
                                <span className={liftPrBadgeClassName}>New heaviest</span>
                              ) : null}
                              {isLatestBestSet ? (
                                <span className={liftPrBadgeClassName}>New best set</span>
                              ) : null}
                              {isLatestBestWorkingSet ? (
                                <span className={liftPrBadgeClassName}>New working PR</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={summarySurfaceClassName}>
                    <p className="text-sm text-white/55">Loading strength logs...</p>
                  </div>
                )}

                {hasHydrated ? (
                  <p className="text-xs text-white/38">
                    {hasLiftEntries
                      ? `${liftEntries.length} strength entr${liftEntries.length === 1 ? "y" : "ies"} saved locally on this device.`
                      : "Strength logs are stored locally on this device."}
                  </p>
                ) : null}
              </Card>
            </section>
          </div>
        )}
      </div>

      <NumberEntryDialog
        open={isNumberDialogOpen}
        title={dialogTitle}
        description={dialogDescription}
        value={draftValue}
        onValueChange={setDraftValue}
        onClose={closeDialog}
        onSubmit={handleDialogSubmit}
        submitLabel={dialogSubmitLabel}
        placeholder={dialogPlaceholder}
        step={dialogStep}
      />
      <LiftEntryDialog
        open={activeDialog === "lift"}
        draft={liftDraft}
        onDraftChange={setLiftDraft}
        onClose={closeDialog}
        onSubmit={handleLiftSubmit}
      />
    </>
  );
}
