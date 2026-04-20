export type FocusDailyStats = {
  dateKey: string;
  sessionsCompletedToday: number;
  totalFocusMinutesToday: number;
};

export const FOCUS_STATS_STORAGE_KEY = "campus-life-os.focus-stats.v1";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function getTodayFocusDateKey(now = new Date()) {
  return toDateKey(now);
}

export function createEmptyFocusDailyStats(now = new Date()): FocusDailyStats {
  return {
    dateKey: getTodayFocusDateKey(now),
    sessionsCompletedToday: 0,
    totalFocusMinutesToday: 0,
  };
}

export function sanitizeFocusDailyStats(value: unknown, now = new Date()): FocusDailyStats {
  const todayKey = getTodayFocusDateKey(now);
  if (!value || typeof value !== "object") {
    return createEmptyFocusDailyStats(now);
  }

  const stats = value as Partial<FocusDailyStats>;
  if (typeof stats.dateKey !== "string" || stats.dateKey !== todayKey) {
    return createEmptyFocusDailyStats(now);
  }

  return {
    dateKey: todayKey,
    sessionsCompletedToday: asPositiveInteger(stats.sessionsCompletedToday),
    totalFocusMinutesToday: asPositiveInteger(stats.totalFocusMinutesToday),
  };
}

export function getStoredFocusDailyStats(now = new Date()) {
  if (typeof window === "undefined") {
    return createEmptyFocusDailyStats(now);
  }

  try {
    const raw = window.localStorage.getItem(FOCUS_STATS_STORAGE_KEY);
    if (!raw) {
      return createEmptyFocusDailyStats(now);
    }

    return sanitizeFocusDailyStats(JSON.parse(raw), now);
  } catch {
    return createEmptyFocusDailyStats(now);
  }
}

export function persistFocusDailyStats(stats: FocusDailyStats) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FOCUS_STATS_STORAGE_KEY, JSON.stringify(stats));
}

export function ensureCurrentFocusDailyStats(now = new Date()) {
  const current = getStoredFocusDailyStats(now);
  persistFocusDailyStats(current);
  return current;
}

export function recordFocusSessionCompletion(durationMinutes: number, now = new Date()) {
  const baseStats = getStoredFocusDailyStats(now);
  const nextStats: FocusDailyStats = {
    dateKey: baseStats.dateKey,
    sessionsCompletedToday: baseStats.sessionsCompletedToday + 1,
    totalFocusMinutesToday:
      baseStats.totalFocusMinutesToday + Math.max(1, Math.floor(durationMinutes)),
  };

  persistFocusDailyStats(nextStats);
  return nextStats;
}

export function formatFocusDailyStats(stats: FocusDailyStats) {
  const sessionLabel = stats.sessionsCompletedToday === 1 ? "session" : "sessions";
  return `${stats.sessionsCompletedToday} ${sessionLabel} • ${stats.totalFocusMinutesToday} min today`;
}
