"use client";

import { formatDate } from "@/lib/academics/utils";
import { useFocusMode } from "@/components/focus/focus-provider";
import { completeFocusSessionTask } from "@/lib/focus/task-completion";

const secondaryButtonClassName =
  "system-button-secondary px-3 py-2 text-sm";
const primaryButtonClassName =
  "system-button-primary px-3 py-2 text-sm font-semibold";

export function FocusModeBar() {
  const {
    hasHydrated,
    session,
    formattedRemainingTime,
    isComplete,
    isHardFocus,
    dailyStatsLabel,
    startAnotherSession,
    pauseFocus,
    resumeFocus,
    toggleHardFocus,
    endFocus,
  } = useFocusMode();

  if (!hasHydrated || !session.isActive || isHardFocus) {
    return null;
  }

  const dueDateLabel = session.dueDate ? formatDate(session.dueDate) : null;

  const handleMarkComplete = () => {
    completeFocusSessionTask(session);
    endFocus();
  };

  return (
    <aside className="pointer-events-none fixed inset-x-3 bottom-24 z-40 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[25rem]">
      <div className="pointer-events-auto relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#050506]/98 p-4 shadow-[0_22px_58px_rgba(0,0,0,0.68)]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
        <div className="relative space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="system-label">Focus Mode</p>
              <span className="system-pill px-2.5 py-1 text-[11px]">
                {isComplete ? "Complete" : session.isPaused ? "Paused" : "In Session"}
              </span>
            </div>
            <p className="text-base font-semibold leading-6 text-white">
              {session.taskTitle ?? "Active focus session"}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-white/42">
              {session.category ? (
                <span className="system-pill px-2.5 py-1">
                  {session.category}
                </span>
              ) : null}
              {dueDateLabel ? (
                <span className="system-pill px-2.5 py-1">
                  Due {dueDateLabel}
                </span>
              ) : null}
              <span className="system-pill px-2.5 py-1 text-white/50">
                {dailyStatsLabel}
              </span>
            </div>
          </div>

          <div
            className={`rounded-[18px] border border-white/[0.06] bg-[#070708]/96 px-4 py-3 ${
              isComplete ? "animate-focusCompleteIn shadow-[0_0_32px_rgba(255,255,255,0.05)]" : ""
            }`}
          >
            <p className="system-label">{isComplete ? "Complete" : "Timer"}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {isComplete ? "Session Complete" : formattedRemainingTime}
            </p>
            <p className="mt-1 text-sm text-white/48">
              {isComplete
                ? "Nice work. Mark the task done or roll straight into another block."
                : session.isPaused
                  ? "Timer is paused and will resume from the stored remaining time."
                  : "Countdown stays accurate across page changes and refreshes."}
            </p>
          </div>

          {isComplete ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleMarkComplete}
                className={`w-full sm:w-auto ${primaryButtonClassName}`}
              >
                Mark Complete
              </button>
              <button
                type="button"
                onClick={startAnotherSession}
                className={`w-full sm:w-auto ${secondaryButtonClassName}`}
              >
                Start Another Session
              </button>
              <button
                type="button"
                onClick={endFocus}
                className={`w-full sm:w-auto ${secondaryButtonClassName}`}
              >
                End Focus
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={toggleHardFocus}
                className={`w-full sm:w-auto ${secondaryButtonClassName}`}
              >
                {session.isHardFocus ? "Hard Focus On" : "Enter Hard Focus"}
              </button>
              <button
                type="button"
                onClick={session.isPaused ? resumeFocus : pauseFocus}
                className={`w-full sm:w-auto ${secondaryButtonClassName}`}
              >
                {session.isPaused ? "Resume" : "Pause"}
              </button>
              <button
                type="button"
                onClick={endFocus}
                className={`w-full sm:w-auto ${secondaryButtonClassName}`}
              >
                End Focus
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
