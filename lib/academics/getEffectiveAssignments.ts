import { mockCourses } from "@/lib/academics/mockData";
import type { AssignmentStatus, Course } from "@/lib/academics/types";
import {
  emptyCanvasImportCounts,
  emptyCanvasImportSnapshot,
  type CanvasAcademicAssignmentDraft,
  type CanvasImportSnapshot,
} from "@/lib/integrations/canvas/types";
import { getCurrentAcademicCanvasCourses } from "@/lib/integrations/canvas/filter";

const ACADEMICS_STORAGE_KEY = "campus-life-os.academics.v1";
const CANVAS_IMPORTS_STORAGE_KEY = "campus-life-os.canvas-imports.v1";

export type EffectiveAssignmentStatus = "not_started" | "in_progress" | "completed";

export type EffectiveAssignment = {
  id: string;
  source: "manual" | "canvas";
  sourceId: string;
  courseId: string;
  title: string;
  category?: string;
  dueDate: string | null;
  courseName: string;
  weight?: number;
  score?: number;
  status: EffectiveAssignmentStatus;
  htmlUrl?: string | null;
};

function getCanvasAcademicAssignmentEffectiveDate(assignment: {
  dueDate?: string | null;
  lockAt?: string | null;
  unlockAt?: string | null;
}) {
  return assignment.dueDate ?? assignment.lockAt ?? assignment.unlockAt ?? null;
}

function normalizeAcademicAssignments(
  academicAssignments: CanvasAcademicAssignmentDraft[],
  importedCanvasAssignments: CanvasImportSnapshot["importedCanvasAssignments"],
) {
  const importedAssignmentsById = new Map(
    importedCanvasAssignments.map((assignment) => [`${assignment.courseId}:${assignment.id}`, assignment] as const),
  );

  return academicAssignments.map((assignment) => {
    const importedAssignment = importedAssignmentsById.get(`${assignment.courseId}:${assignment.sourceId}`);
    const lockAt = assignment.lockAt ?? importedAssignment?.lockAt ?? null;
    const unlockAt = assignment.unlockAt ?? importedAssignment?.unlockAt ?? null;

    return {
      ...assignment,
      dueDate:
        assignment.dueDate ??
        importedAssignment?.dueAt ??
        lockAt ??
        unlockAt ??
        getCanvasAcademicAssignmentEffectiveDate(assignment),
      lockAt,
      unlockAt,
    };
  });
}

function normalizeAcademicStatus(status: AssignmentStatus): EffectiveAssignmentStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "in-progress":
      return "in_progress";
    case "not-started":
    default:
      return "not_started";
  }
}

function getStoredAcademicCourses(): Course[] {
  if (typeof window === "undefined") {
    return mockCourses;
  }

  try {
    const raw = window.localStorage.getItem(ACADEMICS_STORAGE_KEY);
    if (!raw) {
      return mockCourses;
    }

    const parsed = JSON.parse(raw) as Course[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : mockCourses;
  } catch {
    return mockCourses;
  }
}

function normalizeCanvasSnapshot(
  value: Partial<CanvasImportSnapshot> | null | undefined,
): CanvasImportSnapshot {
  const importedCanvasAssignments = value?.importedCanvasAssignments ?? [];
  const academicAssignments = normalizeAcademicAssignments(
    value?.academicAssignments ?? [],
    importedCanvasAssignments,
  );

  return {
    status: value?.status ?? emptyCanvasImportSnapshot.status,
    lastSyncedAt: value?.lastSyncedAt ?? emptyCanvasImportSnapshot.lastSyncedAt,
    importedCanvasCourses: value?.importedCanvasCourses ?? [],
    importedCanvasAssignments,
    plannerItems: value?.plannerItems ?? [],
    academicAssignments,
    counts: {
      ...emptyCanvasImportCounts,
      ...value?.counts,
    },
    warnings: value?.warnings ?? [],
    errorMessage: value?.errorMessage ?? null,
  };
}

function getStoredCanvasSnapshot(): CanvasImportSnapshot {
  if (typeof window === "undefined") {
    return emptyCanvasImportSnapshot;
  }

  try {
    const raw = window.localStorage.getItem(CANVAS_IMPORTS_STORAGE_KEY);
    if (!raw) {
      return emptyCanvasImportSnapshot;
    }

    return normalizeCanvasSnapshot(JSON.parse(raw) as CanvasImportSnapshot);
  } catch {
    return emptyCanvasImportSnapshot;
  }
}

export function getManualEffectiveAssignments(courses: Course[]): EffectiveAssignment[] {
  return courses.flatMap((course) => {
    const categoryWeights = new Map(course.categories.map((category) => [category.name, category.weight]));

    return course.assignments.map((assignment) => {
      const weight = categoryWeights.get(assignment.category);

      return {
        id: assignment.id,
        source: "manual",
        sourceId: assignment.id,
        courseId: assignment.courseId,
        title: assignment.name,
        category: assignment.category,
        dueDate: assignment.dueDate,
        courseName: course.name,
        ...(weight == null ? {} : { weight }),
        ...(assignment.scoreEarned == null ? {} : { score: assignment.scoreEarned }),
        status: normalizeAcademicStatus(assignment.status),
      };
    });
  });
}

export function getCanvasEffectiveAssignments(
  assignments: CanvasAcademicAssignmentDraft[],
): EffectiveAssignment[] {
  return assignments.map((assignment) => ({
    id: assignment.id,
    source: "canvas",
    sourceId: assignment.sourceId,
    courseId: assignment.courseId,
    title: assignment.name,
    dueDate: getCanvasAcademicAssignmentEffectiveDate(assignment),
    courseName: assignment.courseName,
    ...(assignment.scoreEarned == null ? {} : { score: assignment.scoreEarned }),
    status: normalizeAcademicStatus(assignment.status),
    htmlUrl: assignment.htmlUrl,
  }));
}

export function getEffectiveAssignments(
  courses: Course[] = getStoredAcademicCourses(),
  canvasSnapshot: CanvasImportSnapshot = getStoredCanvasSnapshot(),
): EffectiveAssignment[] {
  const academicAssignments = getManualEffectiveAssignments(courses);
  const canvasAssignments = getCanvasEffectiveAssignments(canvasSnapshot.academicAssignments);

  return [...academicAssignments, ...canvasAssignments];
}

export function getCurrentCanvasAcademicAssignments(
  canvasSnapshot: CanvasImportSnapshot = getStoredCanvasSnapshot(),
  now: number = Date.now(),
): CanvasAcademicAssignmentDraft[] {
  const currentCanvasSelection = getCurrentAcademicCanvasCourses(
    canvasSnapshot.importedCanvasCourses,
    canvasSnapshot.importedCanvasAssignments,
    (assignment) => assignment.dueAt,
    now,
  );

  return canvasSnapshot.academicAssignments.filter((assignment) =>
    currentCanvasSelection.currentCourseIds.has(assignment.courseId),
  );
}

export function getCurrentEffectiveAssignments(
  courses: Course[] = getStoredAcademicCourses(),
  canvasSnapshot: CanvasImportSnapshot = getStoredCanvasSnapshot(),
  now: number = Date.now(),
): EffectiveAssignment[] {
  const academicAssignments = getManualEffectiveAssignments(courses);
  const canvasAssignments = getCanvasEffectiveAssignments(
    getCurrentCanvasAcademicAssignments(canvasSnapshot, now),
  );

  return [...academicAssignments, ...canvasAssignments];
}
