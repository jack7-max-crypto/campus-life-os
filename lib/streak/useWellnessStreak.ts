"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { fetchStreaks, type SupabaseStreak, upsertStreak } from "@/lib/supabase/streaks";

type WellnessDayHistory = {
  calorieHit: boolean;
  workoutDone: boolean;
};

type WellnessStreak = {
  count: number;
  lastCompleted: string | null;
};

type WellnessStreakStatus = "done" | "pending";

type LegacyWellnessStreakState = {
  calorieStreak?: unknown;
  workoutStreak?: unknown;
  perfectDayStreak?: unknown;
  lastCalorieHitDate?: unknown;
  lastWorkoutDoneDate?: unknown;
  lastPerfectDayDate?: unknown;
  bestCalorieStreak?: unknown;
  bestWorkoutStreak?: unknown;
  bestPerfectDayStreak?: unknown;
  dailyHistory?: unknown;
};

type WellnessStreakState = {
  calorie: WellnessStreak;
  workout: WellnessStreak;
  perfectDay: WellnessStreak;
  bestCalorieStreak: number;
  bestWorkoutStreak: number;
  bestPerfectDayStreak: number;
  dailyHistory: Record<string, WellnessDayHistory>;
};

const WELLNESS_STREAK_STORAGE_KEY = "campus-life-os.wellness-streak.v1";

type SyncedStreakKey = "calorie" | "workout" | "perfectDay";
type SupabaseStreakType = "calorie" | "gym" | "school";
type SyncedStreakSnapshot = Record<SyncedStreakKey, WellnessStreak>;

function createDefaultStreak(): WellnessStreak {
  return {
    count: 0,
    lastCompleted: null,
  };
}

function createDefaultWellnessStreakState(): WellnessStreakState {
  return {
    calorie: createDefaultStreak(),
    workout: createDefaultStreak(),
    perfectDay: createDefaultStreak(),
    bestCalorieStreak: 0,
    bestWorkoutStreak: 0,
    bestPerfectDayStreak: 0,
    dailyHistory: {},
  };
}

const getToday = () => new Date().toISOString().split("T")[0];

function getPreviousDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split("T")[0];
}

function normalizeDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeSupabaseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function normalizeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeDailyHistory(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, WellnessDayHistory>>(
    (history, [date, entry]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !entry || typeof entry !== "object") {
        return history;
      }

      history[date] = {
        calorieHit: Boolean((entry as Partial<WellnessDayHistory>).calorieHit),
        workoutDone: Boolean((entry as Partial<WellnessDayHistory>).workoutDone),
      };

      return history;
    },
    {},
  );
}

function normalizeStreak(value: unknown, legacyCount?: unknown, legacyLastCompleted?: unknown): WellnessStreak {
  if (value && typeof value === "object") {
    const parsed = value as Partial<WellnessStreak>;

    return {
      count: normalizeCount(parsed.count),
      lastCompleted: normalizeDate(parsed.lastCompleted),
    };
  }

  return {
    count: normalizeCount(legacyCount),
    lastCompleted: normalizeDate(legacyLastCompleted),
  };
}

function resetStaleStreak(streak: WellnessStreak, yesterday: string): WellnessStreak {
  if (!streak.lastCompleted || streak.lastCompleted >= yesterday) {
    return streak;
  }

  return {
    ...streak,
    count: 0,
  };
}

function normalizeStoredState(value: unknown, today: string): WellnessStreakState {
  if (!value || typeof value !== "object") {
    return createDefaultWellnessStreakState();
  }

  const parsed = value as Partial<WellnessStreakState> & LegacyWellnessStreakState;
  const yesterday = getPreviousDate(today);
  const calorie = resetStaleStreak(
    normalizeStreak(parsed.calorie, parsed.calorieStreak, parsed.lastCalorieHitDate),
    yesterday,
  );
  const workout = resetStaleStreak(
    normalizeStreak(parsed.workout, parsed.workoutStreak, parsed.lastWorkoutDoneDate),
    yesterday,
  );
  const perfectDay = resetStaleStreak(
    normalizeStreak(parsed.perfectDay, parsed.perfectDayStreak, parsed.lastPerfectDayDate),
    yesterday,
  );

  return {
    calorie,
    workout,
    perfectDay,
    bestCalorieStreak: normalizeCount(parsed.bestCalorieStreak),
    bestWorkoutStreak: normalizeCount(parsed.bestWorkoutStreak),
    bestPerfectDayStreak: normalizeCount(parsed.bestPerfectDayStreak),
    dailyHistory: normalizeDailyHistory(parsed.dailyHistory),
  };
}

function readWellnessStreakState() {
  if (typeof window === "undefined") {
    return createDefaultWellnessStreakState();
  }

  const today = getToday();

  try {
    const raw = window.localStorage.getItem(WELLNESS_STREAK_STORAGE_KEY);
    if (!raw) {
      return createDefaultWellnessStreakState();
    }

    return normalizeStoredState(JSON.parse(raw), today);
  } catch {
    return createDefaultWellnessStreakState();
  }
}

function persistWellnessStreakState(state: WellnessStreakState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WELLNESS_STREAK_STORAGE_KEY, JSON.stringify(state));
}

function isCompletedToday(streak: WellnessStreak, today: string) {
  return streak.lastCompleted === today;
}

function getStatus(streak: WellnessStreak, today: string): WellnessStreakStatus {
  return isCompletedToday(streak, today) ? "done" : "pending";
}

function completeStreak(streak: WellnessStreak, today: string): WellnessStreak {
  if (streak.lastCompleted === today) {
    return streak;
  }

  const yesterday = getPreviousDate(today);

  if (streak.lastCompleted === yesterday) {
    return {
      count: streak.count + 1,
      lastCompleted: today,
    };
  }

  return {
    count: 1,
    lastCompleted: today,
  };
}

function undoTodayCompletion(streak: WellnessStreak, today: string): WellnessStreak {
  if (streak.lastCompleted !== today) {
    return streak;
  }

  if (streak.count > 1) {
    return {
      count: streak.count - 1,
      lastCompleted: getPreviousDate(today),
    };
  }

  return {
    count: 0,
    lastCompleted: null,
  };
}

function maybeRecordPerfectDay(state: WellnessStreakState, today: string) {
  const todayHistory = state.dailyHistory[today];

  if (!todayHistory?.calorieHit || !todayHistory.workoutDone) {
    return state;
  }

  const perfectDay = completeStreak(state.perfectDay, today);

  if (perfectDay === state.perfectDay) {
    return state;
  }

  return {
    ...state,
    perfectDay,
    bestPerfectDayStreak: Math.max(state.bestPerfectDayStreak, perfectDay.count),
  };
}

function getSupabaseStreakKey(streakType: string): SyncedStreakKey | null {
  switch (streakType) {
    case "calorie":
      return "calorie";
    case "gym":
      return "workout";
    case "school":
      return "perfectDay";
    default:
      return null;
  }
}

function getSupabaseStreakType(streakKey: SyncedStreakKey): SupabaseStreakType {
  switch (streakKey) {
    case "calorie":
      return "calorie";
    case "workout":
      return "gym";
    case "perfectDay":
      return "school";
  }
}

function getSyncedStreakSnapshot(state: WellnessStreakState): SyncedStreakSnapshot {
  return {
    calorie: state.calorie,
    workout: state.workout,
    perfectDay: state.perfectDay,
  };
}

function getChangedStreakKeys(
  previous: SyncedStreakSnapshot | null,
  next: SyncedStreakSnapshot,
): SyncedStreakKey[] {
  if (!previous) {
    return [];
  }

  return (Object.keys(next) as SyncedStreakKey[]).filter((key) => {
    const previousStreak = previous[key];
    const nextStreak = next[key];

    return (
      previousStreak.count !== nextStreak.count ||
      previousStreak.lastCompleted !== nextStreak.lastCompleted
    );
  });
}

function applySupabaseStreaks(
  currentState: WellnessStreakState,
  streaks: SupabaseStreak[],
  today: string,
): WellnessStreakState {
  const baseState = normalizeStoredState(currentState, today);
  const nextState: WellnessStreakState = {
    ...baseState,
    calorie: createDefaultStreak(),
    workout: createDefaultStreak(),
    perfectDay: createDefaultStreak(),
  };

  streaks.forEach((streak) => {
    const streakKey = getSupabaseStreakKey(streak.streak_type);

    if (!streakKey) {
      return;
    }

    nextState[streakKey] = {
      count: normalizeCount(streak.count),
      lastCompleted: normalizeSupabaseDate(streak.last_completed),
    };
  });

  return normalizeStoredState(nextState, today);
}

export function useWellnessStreak() {
  const [state, setState] = useState<WellnessStreakState>(createDefaultWellnessStreakState);
  const [hasHydrated, setHasHydrated] = useState(false);
  const hasLoadedSupabase = useRef(false);
  const lastSyncedSnapshot = useRef<SyncedStreakSnapshot | null>(null);

  useEffect(() => {
    const nextState = readWellnessStreakState();
    persistWellnessStreakState(nextState);
    lastSyncedSnapshot.current = getSyncedStreakSnapshot(nextState);

    startTransition(() => {
      setState(nextState);
      setHasHydrated(true);
    });

    let isCancelled = false;

    const loadSupabaseStreakState = async () => {
      const streaks = await fetchStreaks();

      if (isCancelled) {
        return;
      }

      const today = getToday();
      hasLoadedSupabase.current = true;

      startTransition(() => {
        setState((currentState) => {
          const nextSupabaseState = applySupabaseStreaks(currentState, streaks, today);
          persistWellnessStreakState(nextSupabaseState);
          lastSyncedSnapshot.current = getSyncedStreakSnapshot(nextSupabaseState);
          return nextSupabaseState;
        });
      });
    };

    void loadSupabaseStreakState();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated || !hasLoadedSupabase.current) {
      return;
    }

    const nextSnapshot = getSyncedStreakSnapshot(state);
    const changedKeys = getChangedStreakKeys(lastSyncedSnapshot.current, nextSnapshot);

    if (changedKeys.length === 0) {
      return;
    }

    lastSyncedSnapshot.current = nextSnapshot;

    changedKeys.forEach((key) => {
      const streak = nextSnapshot[key];
      void upsertStreak(getSupabaseStreakType(key), streak.count, streak.lastCompleted);
    });
  }, [hasHydrated, state]);

  const updateState = (updater: (current: WellnessStreakState, today: string) => WellnessStreakState) => {
    const today = getToday();

    setState((currentState) => {
      const normalizedState = normalizeStoredState(currentState, today);
      const nextState = updater(normalizedState, today);
      persistWellnessStreakState(nextState);
      return nextState;
    });
  };

  const setCalorieHitToday = () => {
    updateState((currentState, today) => {
      if (isCompletedToday(currentState.calorie, today)) {
        return currentState;
      }

      const calorie = completeStreak(currentState.calorie, today);
      const nextState = {
        ...currentState,
        calorie,
        bestCalorieStreak: Math.max(currentState.bestCalorieStreak, calorie.count),
        dailyHistory: {
          ...currentState.dailyHistory,
          [today]: {
            calorieHit: true,
            workoutDone:
              currentState.dailyHistory[today]?.workoutDone ?? isCompletedToday(currentState.workout, today),
          },
        },
      };

      return maybeRecordPerfectDay(nextState, today);
    });
  };

  const setWorkoutDoneToday = () => {
    updateState((currentState, today) => {
      if (isCompletedToday(currentState.workout, today)) {
        return currentState;
      }

      const workout = completeStreak(currentState.workout, today);
      const nextState = {
        ...currentState,
        workout,
        bestWorkoutStreak: Math.max(currentState.bestWorkoutStreak, workout.count),
        dailyHistory: {
          ...currentState.dailyHistory,
          [today]: {
            calorieHit:
              currentState.dailyHistory[today]?.calorieHit ?? isCompletedToday(currentState.calorie, today),
            workoutDone: true,
          },
        },
      };

      return maybeRecordPerfectDay(nextState, today);
    });
  };

  const resetToday = () => {
    updateState((currentState, today) => ({
      ...currentState,
      calorie: undoTodayCompletion(currentState.calorie, today),
      workout: undoTodayCompletion(currentState.workout, today),
      perfectDay: undoTodayCompletion(currentState.perfectDay, today),
      dailyHistory: {
        ...currentState.dailyHistory,
        [today]: {
          calorieHit: false,
          workoutDone: false,
        },
      },
    }));
  };

  const today = getToday();
  const calorieHitToday = isCompletedToday(state.calorie, today);
  const workoutDoneToday = isCompletedToday(state.workout, today);

  return {
    hasHydrated,
    calorieStreak: state.calorie.count,
    workoutStreak: state.workout.count,
    perfectDayStreak: state.perfectDay.count,
    bestCalorieStreak: state.bestCalorieStreak,
    bestWorkoutStreak: state.bestWorkoutStreak,
    bestPerfectDayStreak: state.bestPerfectDayStreak,
    calorieHitToday,
    workoutDoneToday,
    calorieStatus: getStatus(state.calorie, today),
    workoutStatus: getStatus(state.workout, today),
    calorieStreakState: state.calorie,
    workoutStreakState: state.workout,
    perfectDayStreakState: state.perfectDay,
    wellnessHistory: state.dailyHistory,
    setCalorieHitToday,
    setWorkoutDoneToday,
    resetToday,
  };
}
