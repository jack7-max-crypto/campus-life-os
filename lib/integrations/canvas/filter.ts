import { parseCanvasDueDate } from "@/lib/academics/dates";
import type { CanvasCourse } from "@/lib/integrations/canvas/types";

export const RECENT_ASSIGNMENT_WINDOW_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TERM_LABEL_PATTERNS = [
  /\b(spring|summer|fall|autumn|winter)\b[\s/-]*(\d{4})\b/i,
  /\b(\d{4})\b[\s/-]*(spring|summer|fall|autumn|winter)\b/i,
] as const;

type CanvasCourseScopedItem = {
  courseId: string;
};

export type CurrentCanvasCourseSelection<T extends CanvasCourseScopedItem> = {
  currentCourses: CanvasCourse[];
  currentCourseIds: Set<string>;
  filteredAssignments: T[];
};

export function toCanvasTimestamp(value: string | null) {
  return parseCanvasDueDate(value)?.getTime() ?? null;
}

export function hasCanvasCourseTermWindow(course: CanvasCourse) {
  return Boolean(course.startAt || course.endAt);
}

function getAcademicTermIndex(season: string) {
  switch (season.toLowerCase()) {
    case "winter":
      return 0;
    case "spring":
      return 1;
    case "summer":
      return 2;
    case "fall":
    case "autumn":
      return 3;
    default:
      return null;
  }
}

function getCurrentAcademicTermRank(now: number) {
  const currentDate = new Date(now);
  const month = currentDate.getMonth() + 1;

  if (month <= 5) {
    return currentDate.getFullYear() * 10 + 1;
  }

  if (month <= 8) {
    return currentDate.getFullYear() * 10 + 2;
  }

  return currentDate.getFullYear() * 10 + 3;
}

function parseAcademicTermRank(value: string | null) {
  if (!value) {
    return null;
  }

  for (const pattern of TERM_LABEL_PATTERNS) {
    const match = pattern.exec(value);
    if (!match) {
      continue;
    }

    const season = Number.isNaN(Number(match[1])) ? match[1] : match[2];
    const year = Number.isNaN(Number(match[1])) ? Number(match[2]) : Number(match[1]);
    const termIndex = getAcademicTermIndex(season);

    if (termIndex == null || Number.isNaN(year)) {
      return null;
    }

    return year * 10 + termIndex;
  }

  return null;
}

export function isCanvasCourseClearlyFromPastTerm(course: CanvasCourse, now: number) {
  const endAt = toCanvasTimestamp(course.endAt);
  if (endAt != null && endAt < now - DAY_IN_MS) {
    return true;
  }

  const currentTermRank = getCurrentAcademicTermRank(now);
  const termLabels = [course.termName, course.name, course.courseCode];

  return termLabels.some((label) => {
    const termRank = parseAcademicTermRank(label);
    return termRank != null && termRank < currentTermRank;
  });
}

export function isCanvasCourseWithinCurrentTerm(course: CanvasCourse, now: number) {
  const startAt = toCanvasTimestamp(course.startAt);
  const endAt = toCanvasTimestamp(course.endAt);

  if (startAt == null && endAt == null) {
    return false;
  }

  if (startAt != null && now < startAt) {
    return false;
  }

  if (endAt != null && now > endAt) {
    return false;
  }

  return true;
}

export function isCanvasCourseActive(course: CanvasCourse, now: number = Date.now()) {
  const workflowState = course.workflowState?.toLowerCase();

  if (isCanvasCourseClearlyFromPastTerm(course, now)) {
    return false;
  }

  if (workflowState === "available") {
    return true;
  }

  if (workflowState === "completed" || workflowState === "deleted") {
    return false;
  }

  return course.published === true && course.restrictedByDate !== true;
}

export function isCanvasAssignmentRecentOrUpcoming(dueAt: string | null, now: number) {
  const dueTimestamp = toCanvasTimestamp(dueAt);
  if (dueTimestamp == null) {
    return false;
  }

  const cutoff = now - RECENT_ASSIGNMENT_WINDOW_DAYS * DAY_IN_MS;
  return dueTimestamp >= cutoff;
}

function hasRecentOrUpcomingAssignments<T>(
  assignments: T[],
  getDueAt: (assignment: T) => string | null,
  now: number,
) {
  return assignments.some((assignment) => isCanvasAssignmentRecentOrUpcoming(getDueAt(assignment), now));
}

export function filterCanvasAssignmentsForCourse<T>(
  course: CanvasCourse,
  assignments: T[],
  getDueAt: (assignment: T) => string | null,
  now: number,
): T[] {
  if (hasCanvasCourseTermWindow(course)) {
    return isCanvasCourseWithinCurrentTerm(course, now) ? assignments : [];
  }

  const workflowState = course.workflowState?.toLowerCase();
  if (workflowState === "completed" || workflowState === "deleted") {
    return [];
  }

  if (isCanvasCourseClearlyFromPastTerm(course, now)) {
    return [];
  }

  if (workflowState === "available") {
    return assignments;
  }

  return assignments.filter((assignment) => isCanvasAssignmentRecentOrUpcoming(getDueAt(assignment), now));
}

export function shouldTreatCanvasCourseAsCurrent<T>(
  course: CanvasCourse,
  assignments: T[],
  getDueAt: (assignment: T) => string | null,
  now: number,
): boolean {
  if (hasCanvasCourseTermWindow(course)) {
    return isCanvasCourseWithinCurrentTerm(course, now);
  }

  const workflowState = course.workflowState?.toLowerCase();
  if (workflowState === "completed" || workflowState === "deleted") {
    return false;
  }

  if (isCanvasCourseClearlyFromPastTerm(course, now)) {
    return false;
  }

  if (workflowState === "available") {
    return true;
  }

  return hasRecentOrUpcomingAssignments(assignments, getDueAt, now);
}

export function shouldIncludeCanvasCourse(
  course: CanvasCourse,
  filteredAssignmentCount: number,
  now: number,
) {
  if (hasCanvasCourseTermWindow(course)) {
    return isCanvasCourseWithinCurrentTerm(course, now);
  }

  const workflowState = course.workflowState?.toLowerCase();
  if (workflowState === "completed" || workflowState === "deleted") {
    return false;
  }

  if (isCanvasCourseClearlyFromPastTerm(course, now)) {
    return false;
  }

  if (workflowState === "available") {
    return true;
  }

  return filteredAssignmentCount > 0;
}

export function getCurrentAcademicCanvasCourses<T extends CanvasCourseScopedItem>(
  courses: CanvasCourse[],
  assignments: T[],
  getDueAt: (assignment: T) => string | null,
  now: number = Date.now(),
): CurrentCanvasCourseSelection<T> {
  const assignmentsByCourse = new Map<string, T[]>();

  for (const assignment of assignments) {
    const courseAssignments = assignmentsByCourse.get(assignment.courseId);

    if (courseAssignments) {
      courseAssignments.push(assignment);
      continue;
    }

    assignmentsByCourse.set(assignment.courseId, [assignment]);
  }

  const currentCourses = courses.filter((course) =>
    shouldTreatCanvasCourseAsCurrent(course, assignmentsByCourse.get(course.id) ?? [], getDueAt, now),
  );
  const currentCourseIds = new Set(currentCourses.map((course) => course.id));

  return {
    currentCourses,
    currentCourseIds,
    filteredAssignments: assignments.filter((assignment) => currentCourseIds.has(assignment.courseId)),
  };
}
