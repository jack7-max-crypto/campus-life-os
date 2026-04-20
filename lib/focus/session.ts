export type FocusSessionTaskType = "assignment" | "task";

export type FocusSession = {
  isActive: boolean;
  taskId: string | null;
  taskTitle: string | null;
  taskType: FocusSessionTaskType | null;
  sourceId: string | null;
  courseId: string | null;
  category?: string | null;
  dueDate?: string | null;
  reason?: string | null;
  startedAt: number | null;
  durationMinutes: number;
  isPaused: boolean;
  isHardFocus: boolean;
  completedAt: number | null;
  pausedRemainingSeconds: number | null;
};

export const FOCUS_SESSION_STORAGE_KEY = "campus-life-os.focus-session.v1";
export const DEFAULT_FOCUS_DURATION_MINUTES = 25;

export const defaultFocusSession: FocusSession = {
  isActive: false,
  taskId: null,
  taskTitle: null,
  taskType: null,
  sourceId: null,
  courseId: null,
  category: null,
  dueDate: null,
  reason: null,
  startedAt: null,
  durationMinutes: DEFAULT_FOCUS_DURATION_MINUTES,
  isPaused: false,
  isHardFocus: false,
  completedAt: null,
  pausedRemainingSeconds: null,
};

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function sanitizeFocusSession(value: unknown): FocusSession {
  if (!value || typeof value !== "object") {
    return defaultFocusSession;
  }

  const session = value as Partial<FocusSession>;
  const durationMinutes =
    typeof session.durationMinutes === "number" && Number.isFinite(session.durationMinutes)
      ? Math.max(1, Math.floor(session.durationMinutes))
      : DEFAULT_FOCUS_DURATION_MINUTES;

  return {
    isActive: Boolean(session.isActive),
    taskId: asNullableString(session.taskId),
    taskTitle: asNullableString(session.taskTitle),
    taskType: session.taskType === "assignment" || session.taskType === "task" ? session.taskType : null,
    sourceId: asNullableString(session.sourceId),
    courseId: asNullableString(session.courseId),
    category: asNullableString(session.category),
    dueDate: asNullableString(session.dueDate),
    reason: asNullableString(session.reason),
    startedAt: asNullableNumber(session.startedAt),
    durationMinutes,
    isPaused: Boolean(session.isPaused),
    isHardFocus: Boolean(session.isHardFocus),
    completedAt: asNullableNumber(session.completedAt),
    pausedRemainingSeconds: asNullableNumber(session.pausedRemainingSeconds),
  };
}

export function getFocusSessionRemainingSeconds(session: FocusSession, now = Date.now()) {
  if (!session.isActive) {
    return 0;
  }

  const defaultDurationSeconds = Math.max(0, Math.floor(session.durationMinutes * 60));
  const trackedDurationSeconds = Math.max(
    0,
    Math.floor(session.pausedRemainingSeconds ?? defaultDurationSeconds),
  );

  if (session.isPaused || !session.startedAt) {
    return trackedDurationSeconds;
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - session.startedAt) / 1000));
  return Math.max(0, trackedDurationSeconds - elapsedSeconds);
}

export function formatFocusRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
