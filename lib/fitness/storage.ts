"use client";

export type FitnessDayLog = {
  date: string;
  calories: number;
  protein: number;
  workoutCompleted: boolean;
  weight: number | null;
};

export type FitnessGoals = {
  caloriesGoal: number;
  proteinGoal: number;
};

export type FitnessState = {
  dailyLogs: Record<string, FitnessDayLog>;
  goals: FitnessGoals;
};

export type FitnessWindowSummary = {
  startDate: string;
  endDate: string;
  totalDays: number;
  workoutsCompleted: number;
  calorieGoalHits: number;
  proteinGoalHits: number;
  averageCalories: number;
  averageProtein: number;
};

export type FitnessStreakKind = "calories" | "protein" | "workout";

const FITNESS_STORAGE_KEY = "campus-life-os.fitness.v1";
const FITNESS_STATE_UPDATED_EVENT = "campus-life-os.fitness-updated";

export const DEFAULT_FITNESS_GOALS: FitnessGoals = {
  caloriesGoal: 4000,
  proteinGoal: 180,
};

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeNonNegativeNumber(value: unknown, fallback = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

function normalizeWeight(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPreviousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return getLocalDateKey(date);
}

export function createEmptyFitnessDayLog(date: string): FitnessDayLog {
  return {
    date,
    calories: 0,
    protein: 0,
    workoutCompleted: false,
    weight: null,
  };
}

export function createDefaultFitnessState(): FitnessState {
  return {
    dailyLogs: {},
    goals: { ...DEFAULT_FITNESS_GOALS },
  };
}

function normalizeGoals(value: unknown): FitnessGoals {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_FITNESS_GOALS };
  }

  const parsed = value as Partial<FitnessGoals>;

  return {
    caloriesGoal: normalizeNonNegativeNumber(parsed.caloriesGoal, DEFAULT_FITNESS_GOALS.caloriesGoal),
    proteinGoal: normalizeNonNegativeNumber(parsed.proteinGoal, DEFAULT_FITNESS_GOALS.proteinGoal),
  };
}

function normalizeDailyLogs(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, FitnessDayLog>>(
    (logs, [date, log]) => {
      if (!isDateKey(date) || !log || typeof log !== "object") {
        return logs;
      }

      const parsed = log as Partial<FitnessDayLog>;
      logs[date] = {
        date,
        calories: normalizeNonNegativeNumber(parsed.calories),
        protein: normalizeNonNegativeNumber(parsed.protein),
        workoutCompleted: Boolean(parsed.workoutCompleted),
        weight: normalizeWeight(parsed.weight),
      };

      return logs;
    },
    {},
  );
}

function normalizeStoredState(value: unknown): FitnessState {
  if (!value || typeof value !== "object") {
    return createDefaultFitnessState();
  }

  const parsed = value as Partial<FitnessState>;

  return {
    dailyLogs: normalizeDailyLogs(parsed.dailyLogs),
    goals: normalizeGoals(parsed.goals),
  };
}

export function ensureFitnessDayLog(state: FitnessState, date: string) {
  if (state.dailyLogs[date]) {
    return state;
  }

  return {
    ...state,
    dailyLogs: {
      ...state.dailyLogs,
      [date]: createEmptyFitnessDayLog(date),
    },
  };
}

export function readFitnessState() {
  const today = getLocalDateKey();

  if (typeof window === "undefined") {
    return ensureFitnessDayLog(createDefaultFitnessState(), today);
  }

  try {
    const raw = window.localStorage.getItem(FITNESS_STORAGE_KEY);

    if (!raw) {
      return ensureFitnessDayLog(createDefaultFitnessState(), today);
    }

    return ensureFitnessDayLog(normalizeStoredState(JSON.parse(raw)), today);
  } catch {
    return ensureFitnessDayLog(createDefaultFitnessState(), today);
  }
}

export function persistFitnessState(state: FitnessState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FITNESS_STORAGE_KEY, JSON.stringify(state));
  window.queueMicrotask(() => {
    window.dispatchEvent(new Event(FITNESS_STATE_UPDATED_EVENT));
  });
}

export function subscribeToFitnessState(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === FITNESS_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(FITNESS_STATE_UPDATED_EVENT, listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(FITNESS_STATE_UPDATED_EVENT, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getDateKeysInRange(startDate: Date, endDate: Date) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);

  if (start.getTime() > end.getTime()) {
    return [];
  }

  const dateKeys: string[] = [];
  const current = new Date(start);

  while (current.getTime() <= end.getTime()) {
    dateKeys.push(getLocalDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dateKeys;
}

export function listFitnessLogs(state: FitnessState) {
  return Object.values(state.dailyLogs).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function listWeightLogs(state: FitnessState) {
  return Object.values(state.dailyLogs)
    .filter((log): log is FitnessDayLog & { weight: number } => {
      return typeof log.weight === "number" && Number.isFinite(log.weight) && log.weight > 0;
    })
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

export function getLatestWeight(state: FitnessState) {
  const latestLog = listFitnessLogs(state).find((log) => log.weight !== null);
  return latestLog?.weight ?? null;
}

export function getFitnessWindowSummary(
  state: FitnessState,
  startDate: Date,
  endDate: Date,
): FitnessWindowSummary {
  const dateKeys = getDateKeysInRange(startDate, endDate);

  const summary = dateKeys.reduce(
    (accumulator, dateKey) => {
      const log = state.dailyLogs[dateKey];
      const calories = log?.calories ?? 0;
      const protein = log?.protein ?? 0;

      accumulator.workoutsCompleted += log?.workoutCompleted ? 1 : 0;
      accumulator.calorieGoalHits += calories >= state.goals.caloriesGoal ? 1 : 0;
      accumulator.proteinGoalHits += protein >= state.goals.proteinGoal ? 1 : 0;
      accumulator.totalCalories += calories;
      accumulator.totalProtein += protein;

      return accumulator;
    },
    {
      workoutsCompleted: 0,
      calorieGoalHits: 0,
      proteinGoalHits: 0,
      totalCalories: 0,
      totalProtein: 0,
    },
  );

  const totalDays = Math.max(dateKeys.length, 1);

  return {
    startDate: dateKeys[0] ?? getLocalDateKey(startDate),
    endDate: dateKeys[dateKeys.length - 1] ?? getLocalDateKey(endDate),
    totalDays,
    workoutsCompleted: summary.workoutsCompleted,
    calorieGoalHits: summary.calorieGoalHits,
    proteinGoalHits: summary.proteinGoalHits,
    averageCalories: summary.totalCalories / totalDays,
    averageProtein: summary.totalProtein / totalDays,
  };
}

export function getWeeklyWorkoutCount(state: FitnessState, referenceDate = new Date()) {
  const endOfWindow = new Date(referenceDate);
  endOfWindow.setHours(12, 0, 0, 0);

  let completed = 0;

  for (let index = 0; index < 7; index += 1) {
    const current = new Date(endOfWindow);
    current.setDate(endOfWindow.getDate() - index);

    const log = state.dailyLogs[getLocalDateKey(current)];
    if (log?.workoutCompleted) {
      completed += 1;
    }
  }

  return completed;
}

export function isFitnessCheckComplete(
  state: FitnessState,
  dateKey: string,
  kind: FitnessStreakKind,
) {
  const log = state.dailyLogs[dateKey];

  if (!log) {
    return false;
  }

  switch (kind) {
    case "calories":
      return state.goals.caloriesGoal > 0 && log.calories >= state.goals.caloriesGoal;
    case "protein":
      return state.goals.proteinGoal > 0 && log.protein >= state.goals.proteinGoal;
    case "workout":
      return log.workoutCompleted;
  }
}

export function getFitnessStreak(
  state: FitnessState,
  kind: FitnessStreakKind,
  referenceDate = new Date(),
) {
  const todayKey = getLocalDateKey(referenceDate);
  let cursorDateKey = isFitnessCheckComplete(state, todayKey, kind)
    ? todayKey
    : getPreviousDateKey(todayKey);
  let count = 0;

  while (isFitnessCheckComplete(state, cursorDateKey, kind)) {
    count += 1;
    cursorDateKey = getPreviousDateKey(cursorDateKey);
  }

  return count;
}

export function getWeightTrendSummary(state: FitnessState, referenceDate = new Date()) {
  const endOfWindow = new Date(referenceDate);
  endOfWindow.setHours(12, 0, 0, 0);

  const weights: Array<FitnessDayLog & { weight: number }> = [];

  for (let index = 6; index >= 0; index -= 1) {
    const current = new Date(endOfWindow);
    current.setDate(endOfWindow.getDate() - index);

    const log = state.dailyLogs[getLocalDateKey(current)];
    if (log && typeof log.weight === "number" && Number.isFinite(log.weight)) {
      weights.push({
        ...log,
        weight: log.weight,
      });
    }
  }

  if (weights.length < 2) {
    return "Log 2 weigh-ins to see a trend";
  }

  const first = weights[0];
  const last = weights[weights.length - 1];
  const delta = Number((last.weight - first.weight).toFixed(1));

  if (delta === 0) {
    return `Stable over ${weights.length} weigh-ins`;
  }

  return delta > 0 ? `Up ${delta} lb this week` : `Down ${Math.abs(delta)} lb this week`;
}
