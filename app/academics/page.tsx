"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { parseCanvasDueDate } from "@/lib/academics/dates";
import {
  getCurrentEffectiveAssignments,
  type EffectiveAssignment,
} from "@/lib/academics/getEffectiveAssignments";
import { mockCourses } from "@/lib/academics/mockData";
import { AssignmentStatus, Course } from "@/lib/academics/types";
import {
  markCanvasAcademicAssignmentCompleteInStorage,
  useCanvasImportSnapshot,
} from "@/lib/integrations/canvas/store";
import { recordTaskCompletion } from "@/lib/streak";
import {
  formatDate,
  statusLabel,
} from "@/lib/academics/utils";

const ACADEMICS_STORAGE_KEY = "campus-life-os.academics.v1";
const seedCourses = mockCourses;

const checklistGroupBadgeClasses = {
  overdue: "semantic-danger",
  today: "semantic-warning",
  tomorrow: "semantic-neutral",
  thisWeek: "semantic-neutral",
  later: "semantic-neutral",
  noDueDate: "semantic-neutral",
} as const;
const checklistRowClasses = {
  overdue:
    "border-[color-mix(in_srgb,var(--accent-danger)_24%,rgba(255,255,255,0.04))] bg-[linear-gradient(90deg,rgba(184,58,77,0.06),rgba(0,0,0,0)_18%),linear-gradient(180deg,rgba(255,255,255,0.014),transparent_34%),var(--bg-2)]",
  today:
    "border-[color-mix(in_srgb,var(--accent-warning)_22%,rgba(255,255,255,0.04))] bg-[linear-gradient(90deg,rgba(201,147,58,0.045),rgba(0,0,0,0)_18%),linear-gradient(180deg,rgba(255,255,255,0.014),transparent_34%),var(--bg-2)]",
  tomorrow:
    "border-white/[0.105] bg-[radial-gradient(ellipse_at_0%_0%,rgba(255,255,255,0.052),transparent_56%),linear-gradient(90deg,rgba(255,255,255,0.028),rgba(0,0,0,0)_76%)]",
  thisWeek:
    "border-white/[0.085] bg-[radial-gradient(ellipse_at_0%_0%,rgba(255,255,255,0.044),transparent_56%),linear-gradient(90deg,rgba(255,255,255,0.022),rgba(0,0,0,0)_76%)]",
  later:
    "border-white/[0.065] bg-[radial-gradient(ellipse_at_0%_0%,rgba(255,255,255,0.035),transparent_58%),linear-gradient(90deg,rgba(255,255,255,0.018),rgba(0,0,0,0)_76%)]",
  noDueDate:
    "border-white/[0.08] bg-[radial-gradient(ellipse_at_0%_0%,rgba(255,255,255,0.055),transparent_58%),linear-gradient(90deg,rgba(255,255,255,0.025),rgba(0,0,0,0)_76%)]",
} as const;
const secondaryButtonClassName =
  "system-button-secondary px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:py-2 sm:text-sm";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CHECKLIST_THIS_WEEK_MAX_DAY_OFFSET = 7;
const CHECKLIST_COMPLETION_ANIMATION_MS = 180;
const DATE_ONLY_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type AssignmentChecklistGroupKey =
  | "overdue"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "later"
  | "noDueDate";

type AssignmentChecklistGroup = {
  key: AssignmentChecklistGroupKey;
  title: string;
  description: string;
  accentClassName: string;
  items: EffectiveAssignment[];
};

function toAcademicAssignmentStatus(
  status: EffectiveAssignment["status"],
): AssignmentStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "in_progress":
      return "in-progress";
    case "not_started":
    default:
      return "not-started";
  }
}

function getNormalizedChecklistDueDate(dueDate: string | null) {
  return parseCanvasDueDate(dueDate);
}

function getLocalCalendarDayIndex(date: Date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS);
}

function getChecklistGroupingDecision(
  assignment: EffectiveAssignment,
  now: Date,
): AssignmentChecklistGroupKey {
  const parsedDueDate = getNormalizedChecklistDueDate(assignment.dueDate);

  if (!parsedDueDate) {
    return "noDueDate";
  }

  const dayDifference = getLocalCalendarDayIndex(parsedDueDate) - getLocalCalendarDayIndex(now);

  if (dayDifference < 0) {
    return "overdue";
  }

  return dayDifference === 0
    ? "today"
    : dayDifference === 1
      ? "tomorrow"
      : dayDifference <= CHECKLIST_THIS_WEEK_MAX_DAY_OFFSET
        ? "thisWeek"
        : "later";
}

function compareChecklistAssignments(a: EffectiveAssignment, b: EffectiveAssignment) {
  const dueDifference =
    (getNormalizedChecklistDueDate(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY) -
    (getNormalizedChecklistDueDate(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY);
  if (dueDifference !== 0) {
    return dueDifference;
  }

  const statusDifference = getAssignmentStatusPriority(b.status) - getAssignmentStatusPriority(a.status);
  if (statusDifference !== 0) {
    return statusDifference;
  }

  const courseDifference = a.courseName.localeCompare(b.courseName);
  if (courseDifference !== 0) {
    return courseDifference;
  }

  return a.title.localeCompare(b.title);
}

function getAssignmentStatusPriority(status: EffectiveAssignment["status"]) {
  switch (status) {
    case "not_started":
      return 2;
    case "in_progress":
      return 1;
    case "completed":
    default:
      return 0;
  }
}

function getChecklistStatusClassName(status: EffectiveAssignment["status"]) {
  switch (status) {
    case "in_progress":
      return checklistGroupBadgeClasses.today;
    case "completed":
      return "semantic-success";
    case "not_started":
    default:
      return "semantic-neutral";
  }
}

function formatChecklistDueDate(dueDate: string | null) {
  if (!dueDate) {
    return "No due date";
  }

  const parsedDueDate = getNormalizedChecklistDueDate(dueDate);
  if (!parsedDueDate) {
    return formatDate(dueDate);
  }

  const now = new Date();
  const dayDifference = getLocalCalendarDayIndex(parsedDueDate) - getLocalCalendarDayIndex(now);
  const hasExplicitTime = !DATE_ONLY_VALUE_PATTERN.test(dueDate.trim());
  const dateLabel =
    dayDifference === 0
      ? "today"
      : dayDifference === 1
        ? "tomorrow"
        : new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            ...(parsedDueDate.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
          }).format(parsedDueDate);

  if (!hasExplicitTime) {
    return dateLabel;
  }

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDueDate);

  return `${dateLabel} at ${timeLabel}`;
}

function getChecklistAssignmentKey(assignment: EffectiveAssignment) {
  return `${assignment.source}-${assignment.id}`;
}

export default function AcademicsPage() {
  const [courses, setCourses] = useState<Course[]>(seedCourses);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [completingAssignmentKeys, setCompletingAssignmentKeys] = useState<string[]>([]);
  const completionTimeoutIdsRef = useRef<Map<string, number>>(new Map());
  const { snapshot: canvasSnapshot } = useCanvasImportSnapshot();
  const effectiveAssignments = useMemo(() => {
    if (!mounted) {
      return [];
    }

    return getCurrentEffectiveAssignments(courses, canvasSnapshot);
  }, [canvasSnapshot, courses, mounted]);
  const checklistGrouping = useMemo(() => {
    const now = new Date();
    const groupedAssignments: Record<AssignmentChecklistGroupKey, EffectiveAssignment[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDueDate: [],
    };

    effectiveAssignments
      .filter((assignment) => assignment.status !== "completed")
      .slice()
      .sort(compareChecklistAssignments)
      .forEach((assignment) => {
        const bucket = getChecklistGroupingDecision(assignment, now);
        groupedAssignments[bucket].push(assignment);
      });

    return {
      groups: [
        {
          key: "overdue",
          title: "Overdue",
          description: "Past due and still open",
          accentClassName: checklistGroupBadgeClasses.overdue,
          items: groupedAssignments.overdue,
        },
        {
          key: "today",
          title: "Today",
          description: "Due on your local calendar today",
          accentClassName: checklistGroupBadgeClasses.today,
          items: groupedAssignments.today,
        },
        {
          key: "tomorrow",
          title: "Tomorrow",
          description: "Due on your local calendar tomorrow",
          accentClassName: checklistGroupBadgeClasses.tomorrow,
          items: groupedAssignments.tomorrow,
        },
        {
          key: "thisWeek",
          title: "This Week",
          description: "Due in 2 to 7 calendar days",
          accentClassName: checklistGroupBadgeClasses.thisWeek,
          items: groupedAssignments.thisWeek,
        },
        {
          key: "later",
          title: "Later",
          description: "Due more than 7 days out or unscheduled",
          accentClassName: checklistGroupBadgeClasses.later,
          items: [...groupedAssignments.later, ...groupedAssignments.noDueDate],
        },
      ] satisfies AssignmentChecklistGroup[],
    };
  }, [effectiveAssignments]);
  const checklistGroups = checklistGrouping.groups;
  const incompleteChecklistCount = useMemo(
    () => checklistGroups.reduce((sum, group) => sum + group.items.length, 0),
    [checklistGroups],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ACADEMICS_STORAGE_KEY);
      if (!raw) {
        setHasHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Course[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCourses(parsed);
      }
    } catch {
      // keep mock seed data fallback
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(ACADEMICS_STORAGE_KEY, JSON.stringify(courses));
  }, [courses, hasHydrated]);

  useEffect(() => {
    const timeoutIds = completionTimeoutIdsRef.current;

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIds.clear();
    };
  }, []);

  const commitChecklistAssignmentComplete = (assignment: EffectiveAssignment) => {
    if (assignment.status === "completed") {
      return;
    }

    if (assignment.source === "canvas") {
      const didUpdate = markCanvasAcademicAssignmentCompleteInStorage(assignment.id);
      if (didUpdate) {
        recordTaskCompletion();
      }
      return;
    }

    let hasUpdated = false;
    const nextCourses = courses.map((course) => {
      if (course.id !== assignment.courseId) {
        return course;
      }

      return {
        ...course,
        assignments: course.assignments.map((courseAssignment) => {
          if (courseAssignment.id !== assignment.sourceId || courseAssignment.status === "completed") {
            return courseAssignment;
          }

          hasUpdated = true;
          return {
            ...courseAssignment,
            status: "completed" as const,
          };
        }),
      };
    });

    if (hasUpdated) {
      setCourses(nextCourses);
      recordTaskCompletion();
    }
  };

  const markChecklistAssignmentComplete = (assignment: EffectiveAssignment) => {
    if (assignment.status === "completed") {
      return;
    }

    const assignmentKey = getChecklistAssignmentKey(assignment);
    if (completionTimeoutIdsRef.current.has(assignmentKey)) {
      return;
    }

    setCompletingAssignmentKeys((prev) => [...prev, assignmentKey]);

    const timeoutId = window.setTimeout(() => {
      completionTimeoutIdsRef.current.delete(assignmentKey);
      commitChecklistAssignmentComplete(assignment);
      setCompletingAssignmentKeys((prev) => prev.filter((key) => key !== assignmentKey));
    }, CHECKLIST_COMPLETION_ANIMATION_MS);

    completionTimeoutIdsRef.current.set(assignmentKey, timeoutId);
  };

  return (
    <div className="animate-fadeIn space-y-2.5 sm:space-y-6 lg:space-y-7">
      <section className="space-y-1.5">
        <div>
          <h2 className="system-page-heading text-[1.3rem] sm:text-2xl">
            Academics
          </h2>
          <p className="system-page-copy mt-0.5 max-w-[calc(100vw-2rem)] text-[0.82rem] [overflow-wrap:anywhere] sm:mt-1 sm:max-w-2xl sm:text-sm">
            Current manual and Canvas assignments, grouped by due date.
          </p>
        </div>
      </section>

      <Card
        title="Assignment Checklist"
        subtitle={
          canvasSnapshot.status === "ready"
            ? "Calendar-day grouped across manual and Canvas current-course assignments"
            : "Calendar-day grouped current-course assignments"
        }
      >
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="system-pill px-2.5 py-0.5 text-[11px] font-semibold text-white/75 sm:px-3 sm:py-1 sm:text-xs">
            {incompleteChecklistCount} open
          </span>
          {canvasSnapshot.status === "ready" ? (
            <span className="semantic-primary px-2.5 py-0.5 text-[11px] font-semibold sm:px-3 sm:py-1 sm:text-xs">
              Canvas synced
            </span>
          ) : null}
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          {checklistGroups.map((group) => (
            <details
              key={group.key}
              className="system-inset-panel group rounded-[12px] px-2 py-1.5 sm:rounded-2xl sm:px-3 sm:py-3"
              open={group.items.length > 0 && group.key !== "later"}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2.5 rounded-xl py-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/20 sm:gap-3 sm:py-1 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[0.8rem] font-semibold text-white sm:text-sm">{group.title}</h4>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-[11px] ${group.accentClassName}`}
                    >
                      {group.items.length}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[10.5px] text-white/46 sm:mt-1 sm:text-xs">{group.description}</p>
                </div>
                <span className="system-pill shrink-0 px-2 py-0.5 text-[10px] font-semibold text-white/58 transition-transform group-open:rotate-180 sm:px-2.5 sm:py-1 sm:text-[11px]">
                  ▾
                </span>
              </summary>

              {group.items.length > 0 ? (
                <div className="mt-1.5 space-y-1.5 sm:mt-3 sm:space-y-2">
                  {group.items.map((assignment) => {
                    const assignmentKey = getChecklistAssignmentKey(assignment);
                    const isCompleting = completingAssignmentKeys.includes(assignmentKey);

                    return (
                      <div
                        key={assignmentKey}
                        className={`origin-top overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none ${
                          isCompleting
                            ? "pointer-events-none max-h-0 scale-[0.985] opacity-0"
                            : "max-h-48 opacity-100"
                        }`}
                      >
                        <div
                          className={`system-subtle-panel system-card-object rounded-[12px] border px-2 py-2 sm:rounded-2xl sm:px-3 sm:py-3 ${checklistRowClasses[group.key]}`}
                        >
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                              <button
                                type="button"
                                onClick={() => markChecklistAssignmentComplete(assignment)}
                                disabled={isCompleting}
                                className="system-button-subtle mt-0.5 inline-flex h-6 min-h-0 w-6 shrink-0 items-center justify-center rounded-full p-0 text-[10px] font-bold disabled:cursor-default disabled:opacity-60 sm:h-7 sm:w-7 sm:text-xs"
                                aria-label={`Mark ${assignment.title} complete`}
                              >
                                ✓
                              </button>

                              <div className="min-w-0">
                                <p className="line-clamp-1 text-[0.8rem] font-semibold leading-4 text-white sm:text-sm sm:leading-5">
                                  {assignment.title}
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-[0.72rem] text-white/56 sm:mt-1 sm:text-xs">{assignment.courseName}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.72rem] text-white/60 sm:mt-2 sm:gap-2 sm:text-xs">
                                  <span>Due {formatChecklistDueDate(assignment.dueDate)}</span>
                                  <span className="text-white/28">•</span>
                                  <span
                                    className={`px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-[11px] ${getChecklistStatusClassName(assignment.status)}`}
                                  >
                                    {statusLabel(toAcademicAssignmentStatus(assignment.status))}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {assignment.htmlUrl ? (
                                <a
                                  href={assignment.htmlUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                className="system-button-secondary min-h-8 flex-1 px-2.5 py-1 text-center text-xs font-medium sm:min-h-11 sm:flex-none sm:px-3 sm:py-2"
                                >
                                  Open
                                </a>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => markChecklistAssignmentComplete(assignment)}
                                disabled={isCompleting}
                                className={`${secondaryButtonClassName} min-h-8 flex-1 sm:min-h-11 sm:flex-none`}
                              >
                                {isCompleting ? "Completing..." : "Mark complete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 rounded-lg border border-white/[0.035] bg-black/15 px-2.5 py-1.5 text-xs text-white/42 sm:mt-3 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
                  No {group.title.toLowerCase()} assignments.
                </div>
              )}
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
