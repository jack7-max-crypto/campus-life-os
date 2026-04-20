"use client";

import type { ReactNode } from "react";
import { useFocusMode } from "@/components/focus/focus-provider";
import { completeFocusSessionTask } from "@/lib/focus/task-completion";
import { formatDate } from "@/lib/academics/utils";

const secondaryButtonClassName =
  "system-button-secondary px-3 py-2 text-sm";
const primaryButtonClassName =
  "system-button-primary px-3 py-2 text-sm font-semibold";

export function FocusLayoutShell({
  sidebar,
  header,
  bottomNav,
  children,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  bottomNav: ReactNode;
  children: ReactNode;
}) {
  const { hasHydrated, session, isHardFocus } = useFocusMode();
  const hardFocusActive = hasHydrated && session.isActive && isHardFocus;

  return (
    <>
      <div className="relative z-10 min-h-screen lg:flex">
        <div
          className={`transition-all duration-300 ease-out ${
            hardFocusActive ? "pointer-events-none hidden opacity-0 lg:hidden" : "opacity-100"
          }`}
        >
          {sidebar}
        </div>
        <div className="flex min-h-screen flex-1 flex-col">
          <div
            className={`transition-all duration-300 ease-out ${
              hardFocusActive ? "pointer-events-none h-0 overflow-hidden opacity-0" : "opacity-100"
            }`}
          >
            {header}
          </div>
          <main
            className={`relative flex-1 overflow-hidden px-4 pt-5 pb-28 sm:px-6 sm:pt-6 sm:pb-32 lg:px-8 lg:py-6 ${
              hardFocusActive ? "pb-24 sm:pb-24" : ""
            }`}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.02),transparent_58%)]" />
            <div className={`relative mx-auto w-full ${hardFocusActive ? "max-w-5xl" : "max-w-7xl"}`}>
              {children}
            </div>
          </main>
          <div className={hardFocusActive ? "hidden" : "block"}>{bottomNav}</div>
        </div>
      </div>
      {hardFocusActive ? <HardFocusOverlay /> : null}
    </>
  );
}

function HardFocusOverlay() {
  const {
    session,
    formattedRemainingTime,
    isComplete,
    dailyStatsLabel,
    pauseFocus,
    resumeFocus,
    toggleHardFocus,
    startAnotherSession,
    endFocus,
  } = useFocusMode();

  const handleMarkComplete = () => {
    completeFocusSessionTask(session);
    endFocus();
  };

  const dueDateLabel = session.dueDate ? formatDate(session.dueDate) : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <div className="absolute inset-0 bg-[#010102]/92" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.028),transparent_48%)]" />
      <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
        <div className="pointer-events-auto relative w-full max-w-3xl rounded-[24px] border border-white/[0.07] bg-[#050506]/98 p-6 shadow-[0_28px_76px_rgba(0,0,0,0.8)] sm:p-8">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
          <div className="relative space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <p className="system-label">Hard Focus</p>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-[3.2rem]">
                    {isComplete ? "Session Complete" : formattedRemainingTime}
                  </h2>
                  <p className="text-xl font-semibold text-white sm:text-2xl">
                    {session.taskTitle ?? "Active focus session"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-white/50">
                  {session.category ? (
                    <span className="system-pill px-3 py-1">
                      {session.category}
                    </span>
                  ) : null}
                  {dueDateLabel ? (
                    <span className="system-pill px-3 py-1">
                      Due {dueDateLabel}
                    </span>
                  ) : null}
                  <span className="system-pill px-3 py-1 text-white/45">
                    {dailyStatsLabel}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={endFocus}
                className={`w-full sm:w-auto ${secondaryButtonClassName}`}
              >
                Exit Focus
              </button>
            </div>

            <div
              className={`rounded-[24px] border border-white/[0.06] bg-[#070708]/96 p-6 ${
                isComplete
                  ? "animate-focusCompleteIn shadow-[0_0_32px_rgba(255,255,255,0.05)]"
                  : "shadow-[0_18px_48px_rgba(0,0,0,0.62)]"
              }`}
            >
              {isComplete ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="system-label">Session Complete</p>
                    <p className="text-2xl font-semibold text-white sm:text-[2.4rem]">
                      {session.taskTitle ?? "You finished the block."}
                    </p>
                    <p className="text-sm leading-6 text-white/50">Nice work. Keep going.</p>
                  </div>
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
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="max-w-2xl text-sm leading-6 text-white/50">
                    Strip the interface down to the work itself. Stay on one task until the timer runs out
                    or you end the session.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={toggleHardFocus}
                      className={`w-full sm:w-auto ${secondaryButtonClassName}`}
                    >
                      Turn Off Hard Focus
                    </button>
                    <button
                      type="button"
                      onClick={session.isPaused ? resumeFocus : pauseFocus}
                      className={`w-full sm:w-auto ${secondaryButtonClassName}`}
                    >
                      {session.isPaused ? "Resume" : "Pause"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
