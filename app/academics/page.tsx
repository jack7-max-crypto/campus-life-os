"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, MetricRow } from "@/components/ui/card";
import { parseCanvasDueDate } from "@/lib/academics/dates";
import {
  getCurrentEffectiveAssignments,
  type EffectiveAssignment,
} from "@/lib/academics/getEffectiveAssignments";
import { mockCourses } from "@/lib/academics/mockData";
import { AssignmentStatus, Course, GradeCategory } from "@/lib/academics/types";
import {
  markCanvasAcademicAssignmentCompleteInStorage,
  useCanvasImportSnapshot,
} from "@/lib/integrations/canvas/store";
import { recordTaskCompletion } from "@/lib/streak";
import {
  calculateCourseMetrics,
  describeRecoveryOutlook,
  explainNeededScore,
  formatDate,
  formatPercent,
  getCourseIntelligence,
  getNeededScoreState,
  statusLabel,
  toLetterGrade,
} from "@/lib/academics/utils";

type CategoryDraft = {
  name: string;
  weight: string;
};

type CourseDraft = {
  id?: string;
  name: string;
  credits: string;
  targetGrade: string;
  finalExamWeight: string;
  categories: CategoryDraft[];
};

type ActiveTab = "tasks" | "progress";

const neededStateClasses: Record<string, string> = {
  secured: "border border-emerald-500/18 bg-emerald-500/10 text-emerald-100",
  possible: "border border-white/[0.08] bg-white/[0.06] text-white/75",
  impossible: "border border-rose-500/18 bg-rose-500/10 text-rose-100",
};

const ACADEMICS_STORAGE_KEY = "campus-life-os.academics.v1";
const seedCourses = mockCourses;

const priorityClasses: Record<string, string> = {
  High: "border border-rose-500/18 bg-rose-500/10 text-rose-100",
  Medium: "border border-amber-500/18 bg-amber-500/10 text-amber-100",
  Low: "border border-white/[0.08] bg-white/[0.06] text-white/75",
};
const recoveryClasses: Record<string, string> = {
  secured: "border border-emerald-500/18 bg-emerald-500/10 text-emerald-100",
  comfortable: "border border-sky-500/18 bg-sky-500/10 text-sky-100",
  possible: "border border-white/[0.08] bg-white/[0.06] text-white/75",
  tight: "border border-amber-500/18 bg-amber-500/10 text-amber-100",
  difficult: "border border-orange-500/18 bg-orange-500/10 text-orange-100",
  unlikely: "border border-rose-500/18 bg-rose-500/10 text-rose-100",
};
const checklistGroupBadgeClasses = {
  overdue: "border border-rose-500/18 bg-rose-500/10 text-rose-100",
  today: "border border-amber-500/18 bg-amber-500/10 text-amber-100",
  tomorrow: "border border-sky-500/18 bg-sky-500/10 text-sky-100",
  thisWeek: "border border-white/[0.08] bg-white/[0.06] text-white/78",
  later: "border border-white/[0.08] bg-white/[0.04] text-white/68",
  noDueDate: "border border-white/[0.08] bg-white/[0.06] text-white/75",
} as const;
const checklistRowClasses = {
  overdue:
    "border-rose-500/20 bg-gradient-to-r from-rose-500/10 via-rose-500/4 to-transparent",
  today:
    "border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/4 to-transparent",
  tomorrow:
    "border-sky-500/20 bg-gradient-to-r from-sky-500/10 via-sky-500/4 to-transparent",
  thisWeek:
    "border-white/[0.08] bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-transparent",
  later:
    "border-white/[0.06] bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-transparent",
  noDueDate:
    "border-white/[0.08] bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-transparent",
} as const;
const fieldClassName =
  "system-input mt-1 px-3 py-2 text-sm";
const compactFieldClassName =
  "system-input px-3 py-2 text-sm";
const mutedLabelClassName = "system-label text-white/45";
const primaryButtonClassName =
  "system-button-primary px-3 py-2 text-sm font-semibold";
const secondaryButtonClassName =
  "system-button-secondary px-3 py-2 text-sm font-medium";
const subtleButtonClassName =
  "system-button-subtle px-3 py-1.5 text-xs font-semibold";
const noteSurfaceClassName =
  "system-subtle-panel system-card-interactive rounded-[14px] px-3 py-2 text-sm text-white/70";

function createEmptyCourseDraft(): CourseDraft {
  return {
    name: "",
    credits: "3",
    targetGrade: "90",
    finalExamWeight: "30",
    categories: [
      { name: "Assignments", weight: "70" },
      { name: "Final Exam", weight: "30" },
    ],
  };
}

function createCourseDraftFromCourse(course: Course): CourseDraft {
  return {
    id: course.id,
    name: course.name,
    credits: String(course.credits),
    targetGrade: String(course.targetGrade),
    finalExamWeight: String(course.finalExamWeight),
    categories: course.categories.map((category) => ({
      name: category.name,
      weight: String(category.weight),
    })),
  };
}

function normalizeCategories(categories: CategoryDraft[]): GradeCategory[] {
  return categories
    .map((category) => ({
      name: category.name.trim(),
      weight: Number(category.weight),
    }))
    .filter((category) => category.name.length > 0);
}

function categoryWeightTotal(categories: CategoryDraft[]): number {
  return categories.reduce((sum, category) => sum + (Number(category.weight) || 0), 0);
}
type GpaScale = "seven_point" | "ten_point";

function percentageToGpa(percent: number, scale: GpaScale): number {
  const p = Math.max(0, Math.min(100, percent));

  if (scale === "seven_point") {
    if (p >= 93) return 4.0;
    if (p >= 90) return 3.7;
    if (p >= 87) return 3.3;
    if (p >= 83) return 3.0;
    if (p >= 80) return 2.7;
    if (p >= 77) return 2.3;
    if (p >= 73) return 2.0;
    if (p >= 70) return 1.7;
    if (p >= 67) return 1.3;
    if (p >= 63) return 1.0;
    if (p >= 60) return 0.7;
    return 0;
  }

  if (p >= 90) return 4.0;
  if (p >= 80) return 3.0;
  if (p >= 70) return 2.0;
  if (p >= 60) return 1.0;
  return 0;
}

function formatGpa(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function formatGapSummary(gap: number): string {
  if (gap > 0) return `${formatPercent(gap)} behind`;
  if (gap < 0) return `${formatPercent(Math.abs(gap))} ahead`;
  return "On target";
}

function formatDueWindow(days: number | null): string {
  if (days === null) return "No upcoming assignments";
  if (days <= 0) return "Work is already due";

  const roundedDays = Math.ceil(days);
  return roundedDays === 1 ? "Next due in 1 day" : `Next due in ${roundedDays} days`;
}

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
      return "border border-emerald-500/18 bg-emerald-500/10 text-emerald-100";
    case "not_started":
    default:
      return "border border-white/[0.08] bg-white/[0.06] text-white/72";
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

function TabButton({
  label,
  tab,
  activeTab,
  onClick,
}: {
  label: string;
  tab: ActiveTab;
  activeTab: ActiveTab;
  onClick: (tab: ActiveTab) => void;
}) {
  const isActive = activeTab === tab;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className="system-segmented-tab px-4 py-2 text-sm font-semibold"
      onClick={() => onClick(tab)}
    >
      {label}
    </button>
  );
}

export default function AcademicsPage() {
  const [courses, setCourses] = useState<Course[]>(seedCourses);
  const [activeTab, setActiveTab] = useState<ActiveTab>("tasks");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(seedCourses[0]?.id ?? "");
  const [courseDraft, setCourseDraft] = useState<CourseDraft | null>(null);
  const [isEditCourseMode, setIsEditCourseMode] = useState(false);
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [gpaScale, setGpaScale] = useState<GpaScale>("seven_point");
  const [whatIfGrade, setWhatIfGrade] = useState("");
  const [completingAssignmentKeys, setCompletingAssignmentKeys] = useState<string[]>([]);
  const completionTimeoutIdsRef = useRef<Map<string, number>>(new Map());
  const { snapshot: canvasSnapshot } = useCanvasImportSnapshot();
  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0],
    [courses, selectedCourseId],
  );

  const courseInsights = useMemo(() => {
    return [...courses]
      .map((course) => {
        return {
          course,
          ...getCourseIntelligence(course),
        };
      })
      .sort(
        (a, b) =>
          b.priorityScore - a.priorityScore ||
          b.payoffScore - a.payoffScore ||
          a.metrics.currentGrade - b.metrics.currentGrade,
      );
  }, [courses]);

  const selectedCourseInsight = useMemo(
    () => courseInsights.find((course) => course.course.id === selectedCourseId) ?? null,
    [courseInsights, selectedCourseId],
  );

  const metrics = useMemo(
    () => selectedCourseInsight?.metrics ?? (selectedCourse ? calculateCourseMetrics(selectedCourse) : null),
    [selectedCourse, selectedCourseInsight],
  );

  const remainingState = selectedCourseInsight?.neededState ?? "possible";
  const finalState = metrics ? getNeededScoreState(metrics.neededOnFinal) : "possible";
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
          description: "Due more than 7 calendar days out",
          accentClassName: checklistGroupBadgeClasses.later,
          items: groupedAssignments.later,
        },
        {
          key: "noDueDate",
          title: "No Due Date",
          description: "Incomplete work without a usable due date",
          accentClassName: checklistGroupBadgeClasses.noDueDate,
          items: groupedAssignments.noDueDate,
        },
      ] satisfies AssignmentChecklistGroup[],
    };
  }, [effectiveAssignments]);
  const checklistGroups = checklistGrouping.groups;
  const incompleteChecklistCount = useMemo(
    () => checklistGroups.reduce((sum, group) => sum + group.items.length, 0),
    [checklistGroups],
  );

  const courseGpaRows = useMemo(() => {
    return courseInsights.map(({ course, metrics: courseMetrics }) => {
      const currentPercent = courseMetrics.currentGrade;
      const projectedPercent = courseMetrics.projectedGrade;

      return {
        course,
        credits: course.credits,
        currentPercent,
        projectedPercent,
        currentGpa: percentageToGpa(currentPercent, gpaScale),
        projectedGpa: percentageToGpa(projectedPercent, gpaScale),
      };
    });
  }, [courseInsights, gpaScale]);

  const totalCredits = useMemo(
    () => courseGpaRows.reduce((sum, row) => sum + row.credits, 0),
    [courseGpaRows],
  );

  const currentGpa = useMemo(() => {
    if (totalCredits === 0) return 0;

    return (
      courseGpaRows.reduce((sum, row) => sum + row.currentGpa * row.credits, 0) / totalCredits
    );
  }, [courseGpaRows, totalCredits]);

  const projectedGpa = useMemo(() => {
    if (totalCredits === 0) return 0;

    return (
      courseGpaRows.reduce((sum, row) => sum + row.projectedGpa * row.credits, 0) / totalCredits
    );
  }, [courseGpaRows, totalCredits]);

  const whatIfProjectedGpa = useMemo(() => {
    if (totalCredits === 0) return 0;

    const parsedWhatIf = whatIfGrade.trim() === "" ? null : Number(whatIfGrade);

    return (
      courses.reduce((sum, course) => {
        const courseMetrics = calculateCourseMetrics(course);
        const projectedPercent =
          course.id === selectedCourse.id && parsedWhatIf !== null && Number.isFinite(parsedWhatIf)
            ? parsedWhatIf
            : courseMetrics.projectedGrade;

        return sum + percentageToGpa(projectedPercent, gpaScale) * course.credits;
      }, 0) / totalCredits
    );
  }, [courses, gpaScale, selectedCourse.id, totalCredits, whatIfGrade]);

  const bestGpaUpside = useMemo(() => {
    if (courseGpaRows.length === 0 || totalCredits === 0) return null;
    return [...courseGpaRows]
      .map((row) => {
        const courseInsight = courseInsights.find((item) => item.course.id === row.course.id);
        const targetGpa = percentageToGpa(Math.min(100, row.course.targetGrade), gpaScale);
        const overallDelta = ((targetGpa - row.projectedGpa) * row.credits) / totalCredits;

        return {
          ...row,
          overallDelta,
          reachable: courseInsight?.reachability !== "unlikely",
        };
      })
      .filter((row) => row.overallDelta > 0)
      .sort(
        (a, b) =>
          Number(b.reachable) - Number(a.reachable) || b.overallDelta - a.overallDelta,
      )[0];
  }, [courseGpaRows, courseInsights, gpaScale, totalCredits]);

  const weakestDragCourse = useMemo(() => {
    if (courseGpaRows.length === 0) return null;
    return [...courseGpaRows].sort(
      (a, b) => a.currentPercent - b.currentPercent || b.credits - a.credits,
    )[0];
  }, [courseGpaRows]);

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
        setSelectedCourseId(parsed[0].id);
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

  const updateTargetGrade = (value: string) => {
    if (!selectedCourse) return;
    const parsed = Number(value);
    const nextTarget = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 100)) : 0;

    setCourses((prev) =>
      prev.map((course) =>
        course.id === selectedCourse.id ? { ...course, targetGrade: nextTarget } : course,
      ),
    );
  };

  const openAddCourse = () => {
    setCourseDraft(createEmptyCourseDraft());
    setIsEditCourseMode(false);
    setCourseFormError(null);
  };

  const openEditCourse = () => {
    if (!selectedCourse) return;
    setCourseDraft(createCourseDraftFromCourse(selectedCourse));
    setIsEditCourseMode(true);
    setCourseFormError(null);
  };

  const closeCourseDraft = () => {
    setCourseDraft(null);
    setIsEditCourseMode(false);
    setCourseFormError(null);
  };

  const addCategoryDraft = () => {
    setCourseDraft((prev) =>
      prev ? { ...prev, categories: [...prev.categories, { name: "", weight: "0" }] } : prev,
    );
  };

  const removeCategoryDraft = (index: number) => {
    setCourseDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.filter((_, i) => i !== index),
      };
    });
  };

  const updateCategoryDraft = (index: number, key: "name" | "weight", value: string) => {
    setCourseDraft((prev) => {
      if (!prev) return prev;
      const nextCategories = [...prev.categories];
      nextCategories[index] = {
        ...nextCategories[index],
        [key]: value,
      };
      return {
        ...prev,
        categories: nextCategories,
      };
    });
  };

  const saveCourseDraft = () => {
    if (!courseDraft) return;

    const normalizedCategories = normalizeCategories(courseDraft.categories);
    const totalWeight = categoryWeightTotal(courseDraft.categories);

    if (!courseDraft.name.trim()) {
      setCourseFormError("Course name is required.");
      return;
    }

    if (normalizedCategories.length === 0) {
      setCourseFormError("Add at least one grading category.");
      return;
    }

    if (Math.round(totalWeight * 100) / 100 !== 100) {
      setCourseFormError(`Category weights must total 100%. Current total: ${totalWeight}%.`);
      return;
    }

    const normalizedCourse: Course = {
      id:
        courseDraft.id ??
        `${courseDraft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: courseDraft.name.trim(),
      credits: Number(courseDraft.credits) || 0,
      targetGrade: Number(courseDraft.targetGrade) || 0,
      finalExamWeight: Number(courseDraft.finalExamWeight) || 0,
      categories: normalizedCategories,
      assignments: [],
    };

    setCourses((prev) => {
      if (isEditCourseMode && courseDraft.id) {
        return prev.map((course) => {
          if (course.id !== courseDraft.id) return course;

          const categoryNames = new Set(normalizedCategories.map((category) => category.name));
          const fallbackCategory = normalizedCategories[0]?.name ?? "Assignments";

          return {
            ...normalizedCourse,
            assignments: course.assignments.map((assignment) => ({
              ...assignment,
              category: categoryNames.has(assignment.category)
                ? assignment.category
                : fallbackCategory,
            })),
          };
        });
      }

      return [...prev, normalizedCourse];
    });

    setSelectedCourseId(normalizedCourse.id);
    closeCourseDraft();
  };

  const deleteSelectedCourse = () => {
    if (!selectedCourse) return;

    setCourses((prev) => {
      const next = prev.filter((course) => course.id !== selectedCourse.id);
      const fallbackId = next[0]?.id ?? "";
      setSelectedCourseId(fallbackId);
      return next;
    });

    closeCourseDraft();
  };

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

  const renderNeededValue = (value: number) => {
    if (value <= 0) return "0.0%";
    if (value > 100) return `${formatPercent(value)} (over 100%)`;
    return formatPercent(value);
  };

  if (!selectedCourse || !metrics) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <section>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Academics</h2>
          <p className="mt-1 text-sm text-white/50">No courses yet. Add your first course.</p>
        </section>
        <button
          onClick={openAddCourse}
          className={primaryButtonClassName}
        >
          Add course
        </button>

        {courseDraft ? (
          <Card title="Add course" subtitle="Create your course setup">
            <p className="text-sm text-white/50">Complete course details and save.</p>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-5 sm:space-y-6 lg:space-y-7">
      <section className="space-y-1.5">
        <div>
          <h2 className="text-[1.75rem] font-semibold tracking-tight text-white sm:text-2xl">
            Academics
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Interactive grade planning for your current semester.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Academics views"
          className="system-subtle-panel mt-4 inline-flex rounded-[18px] p-1"
        >
          <TabButton
            label="Tasks"
            tab="tasks"
            activeTab={activeTab}
            onClick={setActiveTab}
          />
          <TabButton
            label="Progress"
            tab="progress"
            activeTab={activeTab}
            onClick={setActiveTab}
          />
        </div>
      </section>

      {activeTab === "tasks" ? (
        <>
          <Card
            title="Assignment Checklist"
            subtitle={
              canvasSnapshot.status === "ready"
                ? "Calendar-day grouped across manual and Canvas current-course assignments"
                : "Calendar-day grouped current-course assignments"
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="system-pill px-3 py-1 text-xs font-semibold text-white/75">
                {incompleteChecklistCount} open
              </span>
              {canvasSnapshot.status === "ready" ? (
                <span className="inline-flex rounded-full border border-sky-500/18 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100">
                  Canvas synced
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              {checklistGroups.map((group) => (
                <section key={group.key} className="space-y-2">
                  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-3">
                    <p className="system-label text-white/32">Assignment Lane</p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-white">{group.title}</h4>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${group.accentClassName}`}
                        >
                          {group.items.length}
                        </span>
                      </div>
                      <p className="text-xs text-white/46">{group.description}</p>
                    </div>
                  </div>

                  {group.items.length > 0 ? (
                    <div className="space-y-2">
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
                              className={`system-subtle-panel rounded-2xl border px-3 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.42)] ${checklistRowClasses[group.key]}`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={() => markChecklistAssignmentComplete(assignment)}
                                    disabled={isCompleting}
                                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-black/40 text-xs font-bold text-white transition-all duration-200 hover:border-white/[0.22] hover:bg-white/[0.08] disabled:cursor-default disabled:opacity-60 active:scale-[0.96]"
                                    aria-label={`Mark ${assignment.title} complete`}
                                  >
                                    ✓
                                  </button>

                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">
                                      {assignment.title}
                                    </p>
                                    <p className="mt-1 text-xs text-white/56">{assignment.courseName}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
                                      <span>Due {formatChecklistDueDate(assignment.dueDate)}</span>
                                      <span className="text-white/28">•</span>
                                      <span
                                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${getChecklistStatusClassName(assignment.status)}`}
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
                                      className="system-button-secondary px-3 py-2 text-xs font-medium"
                                    >
                                      Open
                                    </a>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => markChecklistAssignmentComplete(assignment)}
                                    disabled={isCompleting}
                                    className={secondaryButtonClassName}
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
                    <div className="rounded-2xl border border-white/[0.06] bg-black/30 px-3 py-3 text-sm text-white/50">
                      No {group.title.toLowerCase()} assignments.
                    </div>
                  )}
                </section>
              ))}
            </div>
          </Card>

        </>
      ) : (
        <>
          <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className={mutedLabelClassName}>
                Select course
                <select
                  value={selectedCourse.id}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                  className={`${fieldClassName} sm:min-w-56`}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={mutedLabelClassName}>
                Target grade
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={selectedCourse.targetGrade}
                  onChange={(event) => updateTargetGrade(event.target.value)}
                  className={`${fieldClassName} sm:w-36`}
                />
              </label>
            </div>
          </section>

          <section className="flex flex-wrap gap-2">
            <button onClick={openAddCourse} className={subtleButtonClassName}>
              Add course
            </button>
            <button onClick={openEditCourse} className={subtleButtonClassName}>
              Edit course
            </button>
            <button onClick={deleteSelectedCourse} className="rounded-lg border border-rose-500/18 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-all duration-200 hover:bg-rose-500/14 active:scale-[0.98]">
              Delete course
            </button>
          </section>

          {courseDraft ? (
            <Card
              title={isEditCourseMode ? "Edit course" : "Add course"}
              subtitle="Manage course details and grading structure"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={mutedLabelClassName}>
                  Course name
                  <input
                    value={courseDraft.name}
                    onChange={(event) =>
                      setCourseDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                    }
                    className={fieldClassName}
                  />
                </label>

                <label className={mutedLabelClassName}>
                  Credits
                  <input
                    type="number"
                    min={0}
                    value={courseDraft.credits}
                    onChange={(event) =>
                      setCourseDraft((prev) =>
                        prev ? { ...prev, credits: event.target.value } : prev,
                      )
                    }
                    className={fieldClassName}
                  />
                </label>

                <label className={mutedLabelClassName}>
                  Target grade
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={courseDraft.targetGrade}
                    onChange={(event) =>
                      setCourseDraft((prev) =>
                        prev ? { ...prev, targetGrade: event.target.value } : prev,
                      )
                    }
                    className={fieldClassName}
                  />
                </label>

                <label className={mutedLabelClassName}>
                  Final exam weight %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={courseDraft.finalExamWeight}
                    onChange={(event) =>
                      setCourseDraft((prev) =>
                        prev ? { ...prev, finalExamWeight: event.target.value } : prev,
                      )
                    }
                    className={fieldClassName}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="system-label text-white/45">Grading Categories</p>
                  <button onClick={addCategoryDraft} className={subtleButtonClassName}>
                    Add category
                  </button>
                </div>

                {courseDraft.categories.map((category, index) => (
                  <div key={`${index}-${category.name}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                    <input
                      placeholder="Category name"
                      value={category.name}
                      onChange={(event) => updateCategoryDraft(index, "name", event.target.value)}
                      className={compactFieldClassName}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Weight"
                      value={category.weight}
                      onChange={(event) => updateCategoryDraft(index, "weight", event.target.value)}
                      className={compactFieldClassName}
                    />
                    <button
                      onClick={() => removeCategoryDraft(index)}
                      className="rounded-lg border border-rose-500/18 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition-all duration-200 hover:bg-rose-500/14 active:scale-[0.98]"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <p className="text-xs text-white/50">
                  Total category weight: <strong>{categoryWeightTotal(courseDraft.categories)}%</strong>
                </p>
              </div>

              {courseFormError ? (
                <p className="rounded-lg border border-rose-500/18 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{courseFormError}</p>
              ) : null}

              <div className="flex gap-2">
                <button onClick={saveCourseDraft} className={primaryButtonClassName}>
                  {isEditCourseMode ? "Save course" : "Create course"}
                </button>
                <button onClick={closeCourseDraft} className={secondaryButtonClassName}>
                  Cancel
                </button>
              </div>
            </Card>
          ) : null}

          <section className="grid gap-4 border-t border-white/[0.04] pt-6 md:grid-cols-2 xl:grid-cols-3">
            <Card title="Courses overview" subtitle="Live course model">
            <MetricRow label="Active courses" value={`${courses.length}`} />
            <MetricRow
              label="Credits"
              value={`${courses.reduce((sum, course) => sum + course.credits, 0)}`}
            />
            <MetricRow
              label="Avg current grade"
              value={formatPercent(
                courseInsights.reduce((sum, course) => sum + course.metrics.currentGrade, 0) /
                  courses.length,
              )}
            />
            <MetricRow
              label="Focus first"
              value={courseInsights[0] ? courseInsights[0].course.name : "—"}
            />
          </Card>
          <Card title="GPA Overview" subtitle="Credit-weighted estimate">
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <label className={mutedLabelClassName}>
                GPA scale
                <select
                  value={gpaScale}
                  onChange={(event) => setGpaScale(event.target.value as GpaScale)}
                  className={fieldClassName}
                >
                  <option value="seven_point">7-point style</option>
                  <option value="ten_point">10-point style</option>
                </select>
              </label>

              <label className={mutedLabelClassName}>
                What-if projected grade for {selectedCourse.name}
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={whatIfGrade}
                  onChange={(event) => setWhatIfGrade(event.target.value)}
                  placeholder={formatPercent(metrics.projectedGrade)}
                  className={fieldClassName}
                />
              </label>
            </div>

            <MetricRow label="Current GPA" value={formatGpa(currentGpa)} />
            <MetricRow label="Projected GPA" value={formatGpa(projectedGpa)} />
            <MetricRow label="What-if GPA" value={formatGpa(whatIfProjectedGpa)} />
            <MetricRow
              label="Best GPA upside"
              value={
                bestGpaUpside
                  ? `${bestGpaUpside.course.name} (+${formatGpa(bestGpaUpside.overallDelta)})`
                  : "—"
              }
            />
            <MetricRow
              label="Dragging GPA"
              value={
                weakestDragCourse
                  ? `${weakestDragCourse.course.name} (${formatPercent(weakestDragCourse.currentPercent)})`
                  : "—"
              }
            />
            {bestGpaUpside || weakestDragCourse ? (
              <p className={noteSurfaceClassName}>
                {bestGpaUpside
                  ? `${bestGpaUpside.course.name} offers the clearest GPA lift if you move it toward target. `
                  : ""}
                {weakestDragCourse
                  ? `${weakestDragCourse.course.name} is the weakest current performer in the mix.`
                  : ""}
              </p>
            ) : null}
          </Card>
          <Card title="Recovery insight" subtitle={selectedCourse.name}>
            <MetricRow
              label="Current"
              value={`${formatPercent(metrics.currentGrade)} (${toLetterGrade(metrics.currentGrade)})`}
            />
            <MetricRow label="Target" value={`${formatPercent(selectedCourse.targetGrade)}`} />
            <MetricRow
              label="Grade gap"
              value={selectedCourseInsight ? formatGapSummary(selectedCourseInsight.gradeGap) : "—"}
            />
            <MetricRow
              label="Open work"
              value={
                selectedCourseInsight
                  ? formatPercent(selectedCourseInsight.approximateRemainingWeight)
                  : "—"
              }
            />
            <MetricRow
              label="Needed average"
              value={renderNeededValue(metrics.neededOnRemaining)}
            />
            {selectedCourseInsight ? (
              <>
                <p className={noteSurfaceClassName}>
                  {describeRecoveryOutlook(selectedCourseInsight.reachability)}.{" "}
                  {selectedCourseInsight.reason}. {formatDueWindow(selectedCourseInsight.nearestDueDays)}.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${recoveryClasses[selectedCourseInsight.reachability]}`}
                  >
                    {describeRecoveryOutlook(selectedCourseInsight.reachability)}
                  </span>
                  <span className="text-xs text-white/45">
                    {selectedCourseInsight.upcomingAssignments} open assignments
                  </span>
                </div>
              </>
            ) : null}
          </Card>

          <Card title="Priority recommendations" className="xl:col-span-2" subtitle="What to focus on first">
            {courseInsights.slice(0, 5).map((item, index) => (
              <button
                key={item.course.id}
                onClick={() => setSelectedCourseId(item.course.id)}
                className="system-subtle-panel system-card-interactive w-full rounded-xl border border-white/[0.05] bg-black/40 px-3 py-3 text-left shadow-[0_18px_44px_rgba(0,0,0,0.42)] transition-all duration-300 ease-out hover:-translate-y-[1px] hover:border-white/[0.12] hover:shadow-[0_12px_40px_rgba(0,0,0,0.75)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="system-label text-white/35">
                        #{index + 1}
                      </span>
                      <p className="text-sm font-semibold text-white">{item.course.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClasses[item.priorityLabel]}`}
                      >
                        {item.priorityLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/50">
                      {formatPercent(item.metrics.currentGrade)} current •{" "}
                      {formatPercent(item.course.targetGrade)} target •{" "}
                      {item.neededState === "impossible"
                        ? "Target now unlikely"
                        : `Need ${renderNeededValue(item.metrics.neededOnRemaining)} on remaining`}
                    </p>
                    <p className="mt-2 text-sm text-white/78">{item.reason}</p>
                    <p className="text-xs text-white/48">{item.recommendation}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold text-white">{item.priorityScore}</p>
                    <p className="system-label text-white/40">Priority</p>
                  </div>
                </div>
              </button>
            ))}
          </Card>

          <Card
            title="Grade target calculator"
            className="xl:col-span-1"
            subtitle="Needed on all remaining coursework"
          >
            <MetricRow label="Completed weight" value={formatPercent(metrics.completedWeight)} />
            <MetricRow label="Remaining weight" value={formatPercent(metrics.remainingWeight)} />
            <MetricRow
              label="Needed on remaining"
              value={renderNeededValue(metrics.neededOnRemaining)}
            />
            <p className={noteSurfaceClassName}>
              {selectedCourseInsight
                ? `${describeRecoveryOutlook(selectedCourseInsight.reachability)}. ${explainNeededScore(
                    metrics.neededOnRemaining,
                  )}`
                : explainNeededScore(metrics.neededOnRemaining)}
            </p>
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${neededStateClasses[remainingState]}`}
            >
              {remainingState.toUpperCase()}
            </span>
          </Card>

          <Card title="Final exam calculator" subtitle="Needed on final exam only">
            <MetricRow label="Final exam weight" value={formatPercent(metrics.finalExamWeight)} />
            <MetricRow label="Needed on final" value={renderNeededValue(metrics.neededOnFinal)} />
            <p className={noteSurfaceClassName}>
              {explainNeededScore(metrics.neededOnFinal)}
            </p>
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${neededStateClasses[finalState]}`}
            >
              {finalState.toUpperCase()}
            </span>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
