"use client";

export type DailyStreak = {
  lastCompletionDate: string | null;
  currentStreak: number;
};

export const DAILY_STREAK_STORAGE_KEY = "campus-life-os.daily-streak.v1";
export const DAILY_STREAK_UPDATED_EVENT = "campus-life-os.daily-streak-updated";

const defaultDailyStreak: DailyStreak = {
  lastCompletionDate: null,
  currentStreak: 0,
};

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPreviousDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return toLocalDateString(date);
}

export function getDailyStreak() {
  if (typeof window === "undefined") {
    return defaultDailyStreak;
  }

  try {
    const raw = window.localStorage.getItem(DAILY_STREAK_STORAGE_KEY);
    if (!raw) {
      return defaultDailyStreak;
    }

    const parsed = JSON.parse(raw) as Partial<DailyStreak>;
    const lastCompletionDate =
      typeof parsed.lastCompletionDate === "string" ? parsed.lastCompletionDate : null;
    const currentStreak =
      typeof parsed.currentStreak === "number" && parsed.currentStreak > 0
        ? Math.floor(parsed.currentStreak)
        : 0;

    return {
      lastCompletionDate,
      currentStreak,
    };
  } catch {
    return defaultDailyStreak;
  }
}

export function recordTaskCompletion() {
  if (typeof window === "undefined") {
    return defaultDailyStreak;
  }

  const today = toLocalDateString(new Date());
  const current = getDailyStreak();

  if (current.lastCompletionDate === today) {
    return current;
  }

  const nextStreak =
    current.lastCompletionDate === getPreviousDate(today) ? current.currentStreak + 1 : 1;

  const next: DailyStreak = {
    lastCompletionDate: today,
    currentStreak: nextStreak,
  };

  window.localStorage.setItem(DAILY_STREAK_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<DailyStreak>(DAILY_STREAK_UPDATED_EVENT, { detail: next }));

  return next;
}
