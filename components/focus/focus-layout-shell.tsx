"use client";

import type { ReactNode } from "react";
import { useFocusMode } from "@/components/focus/focus-provider";
import { completeFocusSessionTask } from "@/lib/focus/task-completion";
import { formatDate } from "@/lib/academics/utils";
import { useScrollLock } from "@/lib/ui/useScrollLock";
import { BodyPortal } from "@/components/ui/body-portal";

const secondaryButtonClassName =
  "system-button-secondary px-3 py-2 text-sm";
const primaryButtonClassName =
  "system-button-primary px-3 py-2 text-sm font-semibold";

export function FocusLayoutShell({
  sidebar,
  header,
  children,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}) {
  const { hasHydrated, session, isHardFocus } = useFocusMode();
  const hardFocusActive = hasHydrated && session.isActive && isHardFocus;
  const mobileFocusActive = hasHydrated && session.isActive && !isHardFocus;
  useScrollLock(hardFocusActive);
  useScrollLock(mobileFocusActive, "(max-width: 767px)");

  return (
    <>
      <div className="system-shell-entry relative z-10 min-h-screen max-lg:flex max-lg:h-[100dvh] max-lg:min-h-[100dvh] max-lg:overflow-hidden lg:flex">
        <div
          className={`transition-all duration-300 ease-out ${
            hardFocusActive ? "pointer-events-none hidden opacity-0 lg:hidden" : "opacity-100"
          }`}
        >
          {sidebar}
        </div>
        <div className="flex min-h-screen flex-1 flex-col max-lg:h-full max-lg:min-h-0">
          <div
            className={`hidden transition-all duration-300 ease-out lg:block ${
              hardFocusActive ? "pointer-events-none h-0 overflow-hidden opacity-0" : "opacity-100"
            }`}
          >
            {header}
          </div>
          <main
            data-app-scroll-container="true"
            className={`relative flex-1 overflow-x-hidden overflow-y-auto px-2.5 pt-2.5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] overscroll-contain [-webkit-overflow-scrolling:touch] max-lg:h-full max-lg:min-h-0 sm:px-6 sm:pt-6 sm:pb-32 lg:overflow-hidden lg:px-8 lg:py-6 ${
              hardFocusActive ? "pb-24 sm:pb-24" : ""
            }`}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.026),transparent_62%)]" />
            <div className={`relative mx-auto w-full ${hardFocusActive ? "max-w-5xl" : "max-w-7xl"}`}>
              {children}
            </div>
          </main>
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
    <BodyPortal>
    <div className="pointer-events-none fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-[#030304]/96" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,247,248,0.07),rgba(180,184,194,0.022)_24%,transparent_58%),radial-gradient(ellipse_at_center,transparent_0%,transparent_42%,rgba(0,0,0,0.9)_100%)]" />
      <div className="absolute inset-0 system-grain" />
      <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
        <div
          data-scroll-lock-scrollable="true"
          className="system-panel system-card-shell pointer-events-auto relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto border-white/[0.14] p-6 shadow-[0_32px_110px_rgba(0,0,0,0.9),0_0_24px_rgba(255,255,255,0.028)] sm:max-h-[calc(100dvh-4rem)] sm:p-8"
        >
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent" />
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
              className={`system-inset-panel rounded-[24px] p-6 ${
                isComplete
                  ? "animate-focusCompleteIn shadow-[0_0_18px_rgba(92,190,160,0.1)]"
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
    </BodyPortal>
  );
}
