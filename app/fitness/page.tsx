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
  createDefaultFitnessState,
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
import { useScrollLock } from "@/lib/ui/useScrollLock";

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthDayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthYearFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const calendarWeekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ActiveDialog = "calories" | "protein" | "weight" | "lift" | null;
type ActiveTab = "today" | "progress";
type QuickAction = "calories" | "protein" | "weight";
type GoalDraft = {
  caloriesGoal: string;
  proteinGoal: string;
  weeklyWorkoutGoal: string;
};
type GoalDraftErrors = Partial<Record<keyof GoalDraft, string>>;
type LiftDraft = {
  lift: LiftType;
  weight: string;
  reps: string;
};

const summarySurfaceClassName =
  "system-stat-tile rounded-[12px] px-2 py-2 sm:rounded-[18px] sm:px-4 sm:py-4";
const actionButtonClassName =
  "system-button-secondary system-action-tile min-h-9 rounded-[12px] px-2.5 py-1.5 text-left text-[0.86rem] font-semibold sm:min-h-12 sm:rounded-[18px] sm:px-4 sm:py-3 sm:text-sm";
const primaryActionButtonClassName =
  "system-button-primary min-h-9 rounded-[12px] px-2.5 py-1.5 text-left text-[0.86rem] font-semibold sm:min-h-12 sm:rounded-[18px] sm:px-4 sm:py-3 sm:text-sm";
const compactPrimaryButtonClassName =
  "system-button-primary rounded-xl px-3 py-2 text-sm font-semibold sm:px-4 sm:py-2.5";
const inactiveIndicatorClassName = "border border-white/[0.07] bg-white/[0.02]";
const liftMetaBadgeClassName =
  "system-pill px-2.5 py-1 text-[11px] font-semibold text-white/58";
const liftPrBadgeClassName =
  "semantic-success inline-flex items-center px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em]";

function createDefaultLiftDraft(): LiftDraft {
  return {
    lift: "bench",
    weight: "",
    reps: "",
  };
}

function createGoalDraft(goals: {
  caloriesGoal: number;
  proteinGoal: number;
  weeklyWorkoutGoal: number;
}): GoalDraft {
  return {
    caloriesGoal: String(goals.caloriesGoal),
    proteinGoal: String(goals.proteinGoal),
    weeklyWorkoutGoal: String(goals.weeklyWorkoutGoal),
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
  const fillClassName = `system-progress-fill ${
    clampedProgress >= 100 ? "system-progress-fill-success" : ""
  } ${clampedProgress === 0 ? "system-progress-fill-empty" : ""}`;

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

      <div className="system-progress-track mt-4 h-2.5">
        <div
          className={fillClassName}
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
      <span className="relative block text-white">{label}</span>
      <span className="relative mt-1 block text-xs font-medium text-white/58">{detail}</span>
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
      className="system-segmented-tab min-h-8 px-3 py-1 text-sm font-semibold sm:min-h-10 sm:px-4 sm:py-2"
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

function LatestWeightStrip({
  hasHydrated,
  latestWeight,
  helper,
  onEditGoals,
  goalsSaved,
}: {
  hasHydrated: boolean;
  latestWeight: number | null;
  helper: string | null;
  onEditGoals: () => void;
  goalsSaved: boolean;
}) {
  return (
    <div className="system-panel system-card-shell min-w-0 overflow-hidden rounded-[14px] p-2.5 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="system-label text-white/45">Latest weight</p>
          <p className="mt-1 truncate text-lg font-semibold tracking-tight text-white sm:text-2xl">
            {hasHydrated ? formatWeight(latestWeight) : "--"}
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-2 text-left sm:items-end sm:text-right">
          <p className="line-clamp-2 max-w-full text-xs leading-5 text-white/52 sm:max-w-[12rem]">
            {hasHydrated ? (helper ?? "Trend ready") : "Loading trend"}
          </p>
          <button
            type="button"
            onClick={onEditGoals}
            className="system-button-secondary inline-flex min-h-8 items-center justify-center rounded-[10px] px-2.5 py-1 text-xs font-semibold text-white/82"
          >
            {goalsSaved ? "Goals saved" : "Edit goals"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DailySnapshotCard({
  calories,
  caloriesGoal,
  caloriesProgress,
  protein,
  proteinGoal,
  proteinProgress,
  workoutCompleted,
  weeklyWorkoutCount,
  weeklyWorkoutGoal,
  hasHydrated,
  className = "",
}: {
  calories: number;
  caloriesGoal: number;
  caloriesProgress: number;
  protein: number;
  proteinGoal: number;
  proteinProgress: number;
  workoutCompleted: boolean;
  weeklyWorkoutCount: number;
  weeklyWorkoutGoal: number;
  hasHydrated: boolean;
  className?: string;
}) {
  const snapshotSummary = hasHydrated
    ? `${formatNumber(calories)} / ${formatNumber(caloriesGoal)} kcal · ${formatNumber(protein)} / ${formatNumber(proteinGoal)}g · ${
        workoutCompleted ? "Workout done" : "Workout pending"
      }`
    : "Loading snapshot";

  const snapshotContent = (
    <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
      <ProgressModule
        label="Calories"
        value={calories}
        goal={caloriesGoal}
        progress={caloriesProgress}
      />

      <ProgressModule
        label="Protein"
        value={protein}
        goal={proteinGoal}
        unit="g"
        progress={proteinProgress}
      />

      <div className={summarySurfaceClassName}>
        <span className="system-label text-white/45">Workout today</span>
        <p className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {hasHydrated ? (workoutCompleted ? "Done" : "Pending") : "--"}
        </p>
        <p className="mt-1 text-xs text-white/50 sm:text-sm">
          {workoutCompleted ? "Training logged today" : "Training still open"}
        </p>
        <p className="mt-2 text-xs text-white/35">
          {hasHydrated ? `${weeklyWorkoutCount}/${weeklyWorkoutGoal} workouts this week` : "Loading week"}
        </p>
      </div>

      <div className={summarySurfaceClassName}>
        <span className="system-label text-white/45">Saved goals</span>
        <p className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {formatNumber(caloriesGoal)} / {formatNumber(proteinGoal)}g / {weeklyWorkoutGoal}x
        </p>
        <p className="mt-1 text-xs text-white/50 sm:text-sm">
          Daily nutrition and weekly training targets
        </p>
      </div>
    </div>
  );

  return (
    <>
      <details
        className={`system-panel system-card-shell group min-w-0 overflow-hidden rounded-[14px] p-2.5 sm:hidden ${className}`}
      >
        <summary className="flex cursor-pointer list-none items-center rounded-[10px] outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/30 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="system-label text-white/45">Daily Snapshot</p>
            <h3 className="mt-0.5 flex min-w-0 items-center gap-2 text-[0.92rem] font-bold tracking-normal text-white">
              <span className="min-w-0 truncate">Goals and trends</span>
              <span
                aria-hidden="true"
                className="system-pill inline-flex h-6 w-6 shrink-0 items-center justify-center p-0 text-white/72 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none">
                  <path
                    d="M5.5 8L10 12.5L14.5 8"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </span>
            </h3>
            <p className="mt-1 truncate text-[0.72rem] leading-4 text-white/48">
              {snapshotSummary}
            </p>
          </div>
        </summary>
        <div className="pt-2 opacity-100 transition-[opacity,transform] duration-200 group-open:translate-y-0 motion-reduce:transition-none">
          {snapshotContent}
        </div>
      </details>

      <Card
        title="Goals and trends"
        subtitle="Daily snapshot"
        variant="dark"
        className={`hidden sm:block ${className}`}
      >
        {snapshotContent}
      </Card>
    </>
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

      <div className="system-inset-panel overflow-hidden rounded-2xl px-2 py-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" aria-label="Weight trend chart" role="img">
          <defs>
            <linearGradient id="fitness-weight-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
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
            stroke="rgba(226,228,234,0.72)"
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
              fill="rgba(245,246,248,0.9)"
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
  useScrollLock(open);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/78 p-2 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] sm:items-center sm:p-4">
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
        className="system-panel relative max-h-[calc(100dvh-1.25rem-env(safe-area-inset-bottom))] w-full max-w-sm overflow-y-auto rounded-t-[22px] p-4 shadow-[0_28px_76px_rgba(0,0,0,0.8)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[24px]"
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

function GoalEditorDialog({
  open,
  draft,
  errors,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: GoalDraft;
  errors: GoalDraftErrors;
  onDraftChange: (draft: GoalDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  useScrollLock(open);

  if (!open) {
    return null;
  }

  const fields: Array<{
    key: keyof GoalDraft;
    label: string;
    helper: string;
    inputMode: "numeric";
    min: number;
    max?: number;
    step: string;
  }> = [
    {
      key: "caloriesGoal",
      label: "Daily calories",
      helper: "Positive kcal target",
      inputMode: "numeric",
      min: 1,
      step: "1",
    },
    {
      key: "proteinGoal",
      label: "Daily protein grams",
      helper: "Positive grams target",
      inputMode: "numeric",
      min: 1,
      step: "1",
    },
    {
      key: "weeklyWorkoutGoal",
      label: "Weekly workouts",
      helper: "Between 1 and 14",
      inputMode: "numeric",
      min: 1,
      max: 14,
      step: "1",
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/78 p-2 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close goal editor"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fitness-goals-dialog-title"
        className="system-panel relative max-h-[calc(100dvh-1.25rem-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto rounded-t-[20px] p-3 shadow-[0_28px_76px_rgba(0,0,0,0.8)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[24px] sm:p-4"
      >
        <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
          <div>
            <p className="system-label text-white/45">Fitness settings</p>
            <h3 id="fitness-goals-dialog-title" className="mt-1 text-base font-semibold tracking-tight text-white">
              Edit goals
            </h3>
            <p className="mt-1 text-sm text-white/50">
              These targets update Fitness and Home progress immediately.
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

        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {fields.map((field) => (
              <label
                key={field.key}
                className={field.key === "weeklyWorkoutGoal" ? "block sm:col-span-2" : "block"}
              >
                <span className="system-label mb-1.5 block text-white/45">{field.label}</span>
                <input
                  autoFocus={field.key === "caloriesGoal"}
                  inputMode={field.inputMode}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  type="number"
                  value={draft[field.key]}
                  onChange={(event) => onDraftChange({ ...draft, [field.key]: event.target.value })}
                  className={`system-input px-3 py-2.5 text-base placeholder:text-white/25 ${
                    errors[field.key] ? "border-[color-mix(in_srgb,var(--accent-danger)_45%,rgba(255,255,255,0.08))]" : ""
                  }`}
                />
                <span className="mt-1 block text-xs text-white/42">
                  {errors[field.key] ?? field.helper}
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="system-button-secondary min-h-10 px-4 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button type="submit" className="system-button-primary min-h-10 px-4 py-2.5 text-sm font-semibold">
              Save goals
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
  useScrollLock(open);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/78 p-2 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] sm:items-center sm:p-4">
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
        className="system-panel relative max-h-[calc(100dvh-1.25rem-env(safe-area-inset-bottom))] w-full max-w-sm overflow-y-auto rounded-t-[22px] p-4 shadow-[0_28px_76px_rgba(0,0,0,0.8)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[24px]"
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
                        ? "system-selected-control"
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
  const [isGoalEditorOpen, setIsGoalEditorOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(() =>
    createGoalDraft(createDefaultFitnessState().goals),
  );
  const [goalDraftErrors, setGoalDraftErrors] = useState<GoalDraftErrors>({});
  const [goalsSaved, setGoalsSaved] = useState(false);
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
  const visibleRecentLogs = showFullHistory ? recentLogs : recentLogs.slice(0, 2);
  const hasEnoughWeightLogsForTrend = useMemo(
    () => recentLogs.filter(({ log }) => log.weight !== null).length >= 2,
    [recentLogs],
  );
  const hasEnoughWeightPointsForChart = weightTrendEntries.length >= 2;
  const currentMonthLabel = monthYearFormatter.format(todayDate);

  const caloriesProgress = todayLog.calories / Math.max(fitnessState.goals.caloriesGoal, 1);
  const proteinProgress = todayLog.protein / Math.max(fitnessState.goals.proteinGoal, 1);

  useEffect(() => {
    if (!goalsSaved) {
      return;
    }

    const timeoutId = window.setTimeout(() => setGoalsSaved(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [goalsSaved]);

  const openDialog = (dialog: QuickAction) => {
    setDraftValue("");
    setActiveDialog(dialog);
  };

  const openGoalEditor = () => {
    setGoalDraft(createGoalDraft(fitnessState.goals));
    setGoalDraftErrors({});
    setIsGoalEditorOpen(true);
  };

  const closeGoalEditor = () => {
    setIsGoalEditorOpen(false);
    setGoalDraftErrors({});
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

  const handleGoalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedCaloriesGoal = Number(goalDraft.caloriesGoal);
    const parsedProteinGoal = Number(goalDraft.proteinGoal);
    const parsedWeeklyWorkoutGoal = Number(goalDraft.weeklyWorkoutGoal);
    const nextErrors: GoalDraftErrors = {};

    if (!Number.isFinite(parsedCaloriesGoal) || parsedCaloriesGoal <= 0) {
      nextErrors.caloriesGoal = "Enter a positive calorie goal.";
    }

    if (!Number.isFinite(parsedProteinGoal) || parsedProteinGoal <= 0) {
      nextErrors.proteinGoal = "Enter a positive protein goal.";
    }

    if (
      !Number.isFinite(parsedWeeklyWorkoutGoal) ||
      parsedWeeklyWorkoutGoal < 1 ||
      parsedWeeklyWorkoutGoal > 14
    ) {
      nextErrors.weeklyWorkoutGoal = "Choose 1 to 14 workouts.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setGoalDraftErrors(nextErrors);
      return;
    }

    const nextGoals = {
      caloriesGoal: Math.round(parsedCaloriesGoal),
      proteinGoal: Math.round(parsedProteinGoal),
      weeklyWorkoutGoal: Math.round(parsedWeeklyWorkoutGoal),
    };

    updateFitnessState((currentState) => ({
      ...currentState,
      goals: nextGoals,
    }));

    setGoalDraft(createGoalDraft(nextGoals));
    setGoalDraftErrors({});
    setIsGoalEditorOpen(false);
    setGoalsSaved(true);
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
      <div className="animate-fadeIn space-y-2.5 sm:space-y-6">
        <section className="space-y-1">
          <h2 className="system-page-heading text-[1.3rem] sm:text-2xl">
            Fitness
          </h2>
          <p className="system-page-copy max-w-[calc(100vw-2rem)] truncate text-[0.82rem] leading-5 [overflow-wrap:anywhere] sm:max-w-2xl sm:whitespace-normal sm:text-sm sm:leading-6">
            Quick logging for today, with deeper trends tucked behind Progress.
          </p>
          <div
            role="tablist"
            aria-label="Fitness views"
            className="system-tab-rail mt-2 inline-flex rounded-[14px] p-1 sm:mt-4 sm:rounded-[18px]"
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
            <section className="grid gap-2.5 md:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)] md:gap-4">
              <Card title="Quick actions" subtitle="Log today first" variant="dark">
                <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2">
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
                    <span className={`mt-0.5 block text-[0.72rem] font-medium sm:mt-1 sm:text-xs ${todayLog.workoutCompleted ? "text-white/45" : "text-white/70"}`}>
                      {todayLog.workoutCompleted ? "Clear today's training status" : "Keep today's streak current"}
                    </span>
                  </button>
                </div>
              </Card>

              <LatestWeightStrip
                hasHydrated={hasHydrated}
                latestWeight={latestWeight}
                helper={weightTrendHelperText ?? weightTrendSummary}
                onEditGoals={openGoalEditor}
                goalsSaved={goalsSaved}
              />
            </section>

            <DailySnapshotCard
              calories={todayLog.calories}
              caloriesGoal={fitnessState.goals.caloriesGoal}
              caloriesProgress={caloriesProgress}
              protein={todayLog.protein}
              proteinGoal={fitnessState.goals.proteinGoal}
              proteinProgress={proteinProgress}
              workoutCompleted={todayLog.workoutCompleted}
              weeklyWorkoutCount={weeklyWorkoutCount}
              weeklyWorkoutGoal={fitnessState.goals.weeklyWorkoutGoal}
              hasHydrated={hasHydrated}
            />

            <section>
              <Card title="Last 7 days" subtitle="Compact history preview" variant="dark">
                <div className="space-y-1.5 sm:space-y-2">
                  {visibleRecentLogs.map(({ date, log }) => (
                    <div
                      key={date}
                      className="system-subtle-panel flex flex-col gap-1.5 rounded-[12px] px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:rounded-[18px] sm:px-4 sm:py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[0.82rem] font-semibold text-white sm:text-sm">
                          {formatDayLabel(date, todayKey)}
                        </p>
                        <p className="text-[0.68rem] text-white/40 sm:text-xs">{formatShortDate(date)}</p>
                      </div>

                      <div className="flex flex-wrap gap-1 text-[10px] text-white/70 sm:gap-1.5 sm:text-[11px]">
                        <span className="system-pill px-2 py-0.5 sm:px-2.5 sm:py-1">
                          {formatNumber(log.calories)} kcal
                        </span>
                        <span className="system-pill px-2 py-0.5 sm:px-2.5 sm:py-1">
                          {formatNumber(log.protein)}g protein
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 ${
                            log.workoutCompleted
                              ? "semantic-success"
                              : "semantic-neutral"
                          }`}
                        >
                          {log.workoutCompleted ? "Workout done" : "No workout"}
                        </span>
                        <span className="system-pill px-2 py-0.5 sm:px-2.5 sm:py-1">
                          {log.weight === null ? "No weight" : `${log.weight} lb`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <p className="text-xs text-white/40">
                    {latestLogs.length > 0
                      ? `Tracking ${latestLogs.length} saved day${latestLogs.length === 1 ? "" : "s"} in local storage.`
                      : "No saved history yet."}
                  </p>

                  <button
                    type="button"
                    className="system-pill shrink-0 px-2.5 py-1 text-[11px] font-semibold text-white/72 sm:px-3 sm:py-1.5 sm:text-xs"
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
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
                      <span className="h-2 w-2 rounded-full bg-[rgba(64,150,112,0.9)] shadow-[0_0_10px_rgba(64,150,112,0.14)]" />
                      Workout
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.08)]" />
                      Protein goal
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-md border border-white/[0.16] bg-white/[0.055]" />
                      Calorie goal
                    </span>
                  </div>
                  <span>
                    {hasHydrated
                      ? `${currentMonthSummary.proteinGoalHits} protein goal day${currentMonthSummary.proteinGoalHits === 1 ? "" : "s"}`
                      : "Loading month summary"}
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-1 text-[10px] text-white/32 sm:gap-2 sm:text-[11px]">
                  {calendarWeekdayLabels.map((weekday) => (
                    <div key={weekday} className="px-1 py-1 text-center">
                      {weekday}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2">
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
                        className={`min-h-[48px] rounded-xl border px-1.5 py-1.5 transition-colors sm:min-h-[74px] sm:rounded-2xl sm:px-2.5 sm:py-2 ${
                          calorieGoalHit
                            ? "border-[color-mix(in_srgb,var(--accent-success)_24%,rgba(255,255,255,0.06))] bg-[rgba(64,150,112,0.045)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                            : "border-white/[0.06] bg-black/35"
                        } ${
                          inCurrentMonth ? "text-white/80" : "text-white/20"
                        } ${isToday ? "ring-1 ring-white/20" : ""} ${isFuture ? "opacity-45" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-sm font-semibold ${isToday ? "text-white" : ""}`}>
                            {dateNumber}
                          </span>
                          {isToday ? <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.1)]" /> : null}
                        </div>

                        <div className="mt-3 flex items-center gap-1 sm:mt-6 sm:gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              workoutCompleted ? "bg-[rgba(64,150,112,0.9)] shadow-[0_0_10px_rgba(64,150,112,0.14)]" : inactiveIndicatorClassName
                            }`}
                          />
                          <span
                            className={`h-2 w-2 rounded-full ${
                              proteinGoalHit ? "bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.08)]" : inactiveIndicatorClassName
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
              <details className="system-panel system-card-shell group relative overflow-hidden rounded-[16px] p-3 md:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 outline-none focus-visible:ring-2 focus-visible:ring-white/20 [&::-webkit-details-marker]:hidden">
                  <div>
                    <p className="system-label">Strength</p>
                    <h3 className="mt-1 text-sm font-black text-white">
                      {latestStrengthEntry
                        ? `${LIFT_LABELS[latestStrengthEntry.lift]} · ${formatLiftPerformance(latestStrengthEntry)}`
                        : "Lift tracking"}
                    </h3>
                  </div>
                  <span className="system-pill px-2.5 py-1 text-[11px] font-semibold text-white/58 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="mt-3 space-y-3">
                  <button
                    type="button"
                    className={`${compactPrimaryButtonClassName} min-h-10 w-full`}
                    onClick={openLiftDialog}
                  >
                    Log lift
                  </button>
                  <p className="text-xs leading-5 text-white/45">
                    {hasLiftEntries
                      ? `${liftEntries.length} strength entr${liftEntries.length === 1 ? "y" : "ies"} saved locally.`
                      : "Strength logs are stored locally on this device."}
                  </p>
                </div>
              </details>
              <Card title="Strength" subtitle="Compact lift tracking" variant="dark" className="hidden md:block">
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
                        className="system-stat-tile rounded-2xl px-4 py-3.5"
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
      <GoalEditorDialog
        open={isGoalEditorOpen}
        draft={goalDraft}
        errors={goalDraftErrors}
        onDraftChange={(nextDraft) => {
          setGoalDraft(nextDraft);
          setGoalDraftErrors({});
        }}
        onClose={closeGoalEditor}
        onSubmit={handleGoalSubmit}
      />
    </>
  );
}
