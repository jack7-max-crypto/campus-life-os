"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createEmptyFocusDailyStats,
  ensureCurrentFocusDailyStats,
  formatFocusDailyStats,
  recordFocusSessionCompletion,
  type FocusDailyStats,
} from "@/lib/focus/stats";
import {
  DEFAULT_FOCUS_DURATION_MINUTES,
  FOCUS_SESSION_STORAGE_KEY,
  defaultFocusSession,
  formatFocusRemainingTime,
  getFocusSessionRemainingSeconds,
  sanitizeFocusSession,
  type FocusSession,
  type FocusSessionTaskType,
} from "@/lib/focus/session";

type StartFocusInput = {
  taskId: string | null;
  taskTitle: string | null;
  taskType?: FocusSessionTaskType | null;
  sourceId?: string | null;
  courseId?: string | null;
  category?: string | null;
  dueDate?: string | null;
  reason?: string | null;
  durationMinutes?: number;
  isHardFocus?: boolean;
};

type FocusModeContextValue = {
  hasHydrated: boolean;
  session: FocusSession;
  remainingSeconds: number;
  formattedRemainingTime: string;
  isComplete: boolean;
  isHardFocus: boolean;
  dailyStats: FocusDailyStats;
  dailyStatsLabel: string;
  startFocus: (input: StartFocusInput) => void;
  startAnotherSession: () => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  toggleHardFocus: () => void;
  endFocus: () => void;
};

const FocusModeContext = createContext<FocusModeContextValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<FocusSession>(defaultFocusSession);
  const [dailyStats, setDailyStats] = useState<FocusDailyStats>(() => createEmptyFocusDailyStats());
  const [hasHydrated, setHasHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY);
      if (raw) {
        setSession(sanitizeFocusSession(JSON.parse(raw)));
      }
    } catch {
      // fall back to an inactive session if stored data is invalid
    } finally {
      setDailyStats(ensureCurrentFocusDailyStats());
      setNow(Date.now());
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!session.isActive) {
      window.localStorage.removeItem(FOCUS_SESSION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(FOCUS_SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [hasHydrated, session]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const syncStats = () => {
      setDailyStats(ensureCurrentFocusDailyStats());
    };

    syncStats();
    window.addEventListener("focus", syncStats);
    document.addEventListener("visibilitychange", syncStats);

    return () => {
      window.removeEventListener("focus", syncStats);
      document.removeEventListener("visibilitychange", syncStats);
    };
  }, [hasHydrated]);

  const remainingSeconds = getFocusSessionRemainingSeconds(session, now);
  const isComplete = session.isActive && (Boolean(session.completedAt) || remainingSeconds === 0);

  useEffect(() => {
    if (!session.isActive || session.isPaused || isComplete) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isComplete, session.isActive, session.isPaused]);

  useEffect(() => {
    if (!hasHydrated || !session.isActive || session.isPaused || remainingSeconds !== 0 || session.completedAt) {
      return;
    }

    const completedAt = Date.now();
    setNow(completedAt);
    setSession((currentSession) =>
      currentSession.isActive && !currentSession.completedAt
        ? {
            ...currentSession,
            completedAt,
            startedAt: null,
            isPaused: false,
            pausedRemainingSeconds: 0,
          }
        : currentSession,
    );
    setDailyStats(recordFocusSessionCompletion(session.durationMinutes, new Date(completedAt)));
  }, [
    hasHydrated,
    remainingSeconds,
    session.completedAt,
    session.durationMinutes,
    session.isActive,
    session.isPaused,
  ]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const currentStats = ensureCurrentFocusDailyStats(new Date(now));
    if (
      currentStats.dateKey !== dailyStats.dateKey ||
      currentStats.sessionsCompletedToday !== dailyStats.sessionsCompletedToday ||
      currentStats.totalFocusMinutesToday !== dailyStats.totalFocusMinutesToday
    ) {
      setDailyStats(currentStats);
    }
  }, [dailyStats, hasHydrated, now]);

  const value = useMemo<FocusModeContextValue>(() => {
    const startFocus = (input: StartFocusInput) => {
      const startedAt = Date.now();
      const durationMinutes = Math.max(
        1,
        Math.floor(input.durationMinutes ?? DEFAULT_FOCUS_DURATION_MINUTES),
      );

      setNow(startedAt);
      setSession({
        isActive: true,
        taskId: input.taskId,
        taskTitle: input.taskTitle,
        taskType: input.taskType ?? null,
        sourceId: input.sourceId ?? null,
        courseId: input.courseId ?? null,
        category: input.category ?? null,
        dueDate: input.dueDate ?? null,
        reason: input.reason ?? null,
        startedAt,
        durationMinutes,
        isPaused: false,
        isHardFocus: Boolean(input.isHardFocus),
        completedAt: null,
        pausedRemainingSeconds: null,
      });
    };

    const startAnotherSession = () => {
      if (!session.isActive) {
        return;
      }

      const restartedAt = Date.now();
      setNow(restartedAt);
      setSession({
        ...session,
        startedAt: restartedAt,
        isPaused: false,
        completedAt: null,
        pausedRemainingSeconds: null,
      });
    };

    const pauseFocus = () => {
      if (!session.isActive || session.isPaused || isComplete) {
        return;
      }

      const pausedAt = Date.now();
      const remaining = getFocusSessionRemainingSeconds(session, pausedAt);
      if (remaining === 0) {
        return;
      }

      setNow(pausedAt);
      setSession({
        ...session,
        startedAt: null,
        isPaused: true,
        pausedRemainingSeconds: remaining,
      });
    };

    const resumeFocus = () => {
      if (!session.isActive || !session.isPaused || isComplete) {
        return;
      }

      const remaining =
        session.pausedRemainingSeconds ?? Math.max(0, Math.floor(session.durationMinutes * 60));
      if (remaining === 0) {
        return;
      }

      const resumedAt = Date.now();
      setNow(resumedAt);
      setSession({
        ...session,
        startedAt: resumedAt,
        isPaused: false,
        pausedRemainingSeconds: remaining,
      });
    };

    const toggleHardFocus = () => {
      if (!session.isActive) {
        return;
      }

      setSession({
        ...session,
        isHardFocus: !session.isHardFocus,
      });
    };

    const endFocus = () => {
      setNow(Date.now());
      setSession(defaultFocusSession);
    };

    return {
      hasHydrated,
      session,
      remainingSeconds,
      formattedRemainingTime: formatFocusRemainingTime(remainingSeconds),
      isComplete,
      isHardFocus: session.isActive && session.isHardFocus,
      dailyStats,
      dailyStatsLabel: formatFocusDailyStats(dailyStats),
      startFocus,
      startAnotherSession,
      pauseFocus,
      resumeFocus,
      toggleHardFocus,
      endFocus,
    };
  }, [dailyStats, hasHydrated, isComplete, remainingSeconds, session]);

  return (
    <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>
  );
}

export function useFocusMode() {
  const context = useContext(FocusModeContext);

  if (!context) {
    throw new Error("useFocusMode must be used within a FocusProvider");
  }

  return context;
}
