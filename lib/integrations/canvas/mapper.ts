import { parseCanvasDueDate } from "@/lib/academics/dates";
import type {
  CanvasAcademicAssignmentDraft,
  CanvasApiAssignment,
  CanvasApiCourse,
  CanvasAssignment,
  CanvasCourse,
  CanvasIdentifier,
  CanvasPlannerItemDraft,
  CanvasSubmissionStatus,
} from "@/lib/integrations/canvas/types";

function toCanvasId(value: CanvasIdentifier | null | undefined) {
  return value == null ? "" : String(value);
}

function toStringOrEmpty(value: string | null | undefined) {
  return value ?? "";
}

function toCourseDisplayName(value: string | null | undefined) {
  const normalized = (value ?? "Untitled Course").trim();
  return normalized || "Untitled Course";
}

function toOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

type CanvasSubmissionSignals = {
  hasSubmission: boolean;
  submissionState: string | null;
  submittedAt: string | null;
  score: number | null;
  grade: string | null;
  hasSubmittedSubmissions: boolean | null;
  isExcused: boolean;
  isMissing: boolean;
  isLate: boolean;
};

function hasConfirmedCanvasSubmission(signals: Pick<
  CanvasSubmissionSignals,
  "hasSubmission" | "submittedAt" | "submissionState" | "hasSubmittedSubmissions"
>) {
  return (
    signals.hasSubmission &&
    (signals.hasSubmittedSubmissions === true || signals.submittedAt !== null) &&
    (signals.submissionState === "submitted" || signals.submissionState === "graded")
  );
}

function getSubmissionStatus(signals: CanvasSubmissionSignals): CanvasSubmissionStatus {
  if (signals.isExcused) {
    return "excused";
  }

  if (signals.isMissing) {
    return "missing";
  }

  if (hasConfirmedCanvasSubmission(signals)) {
    return signals.submissionState === "graded" ? "graded" : "submitted";
  }

  if (signals.isLate) {
    return "late";
  }

  if (signals.submissionState === "unsubmitted") {
    return "not-submitted";
  }

  return signals.hasSubmission ? "unknown" : "not-submitted";
}

export function getCanvasCompletionClassification(
  assignment: Pick<
    CanvasAssignment,
    | "submissionState"
    | "submittedAt"
  >,
) {
  if (assignment.submissionState === "unsubmitted") {
    return {
      isCompleted: false,
      isConfirmedSubmissionCompletion: false,
      isAmbiguous: false,
      reason: "forced_not_started_unsubmitted",
    };
  }

  if (assignment.submittedAt === null) {
    return {
      isCompleted: false,
      isConfirmedSubmissionCompletion: false,
      isAmbiguous: false,
      reason: "forced_not_started_no_submitted_at",
    };
  }

  if (assignment.submissionState === "submitted" || assignment.submissionState === "graded") {
    return {
      isCompleted: true,
      isConfirmedSubmissionCompletion: true,
      isAmbiguous: false,
      reason: "completed_submitted_at_present",
    };
  }

  return {
    isCompleted: false,
    isConfirmedSubmissionCompletion: false,
    isAmbiguous: false,
    reason: "forced_not_started_submission_state_not_complete",
  };
}

function getAcademicAssignmentStatus(assignment: CanvasAssignment) {
  const completion = getCanvasCompletionClassification(assignment);

  if (completion.isCompleted) {
    return "completed" as const;
  }

  return "not-started" as const;
}

function getPlannerPriorityHint(dueDate: string | null): CanvasPlannerItemDraft["priorityHint"] {
  if (!dueDate) {
    return "P3";
  }

  const parsedDueDate = parseCanvasDueDate(dueDate);
  if (!parsedDueDate) {
    return "P3";
  }

  const diffMs = parsedDueDate.getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours <= 24) {
    return "P1";
  }

  if (diffHours <= 72) {
    return "P2";
  }

  return "P3";
}

export function mapCanvasCourse(course: CanvasApiCourse): CanvasCourse {
  const startAt = toOptionalString(course.start_at) ?? toOptionalString(course.term?.start_at);
  const endAt = toOptionalString(course.end_at) ?? toOptionalString(course.term?.end_at);

  return {
    id: toCanvasId(course.id),
    name: toCourseDisplayName(course.name),
    courseCode: toOptionalString(course.course_code),
    htmlUrl: toOptionalString(course.html_url),
    workflowState: toOptionalString(course.workflow_state),
    enrollmentType: toOptionalString(course.enrollments?.[0]?.type),
    startAt,
    endAt,
    termName: toOptionalString(course.term?.name),
    published: course.published ?? null,
    restrictedByDate: course.access_restricted_by_date ?? null,
    imageUrl: toOptionalString(course.image_download_url),
  };
}

export function mapCanvasAssignment(
  assignment: CanvasApiAssignment,
  course: Pick<CanvasCourse, "id" | "name">,
): CanvasAssignment {
  const courseName = toCourseDisplayName(course.name);
  const assignmentName = toStringOrEmpty(assignment.name);
  const submissionState = toOptionalString(assignment.submission?.workflow_state);
  const submittedAt = toOptionalString(assignment.submission?.submitted_at);
  const score = assignment.submission?.score ?? null;
  const grade = toOptionalString(assignment.submission?.grade);
  const hasSubmission = assignment.submission != null;
  const hasSubmittedSubmissions = assignment.has_submitted_submissions ?? null;
  const submissionStatus = getSubmissionStatus({
    hasSubmission,
    submissionState,
    submittedAt,
    score,
    grade,
    hasSubmittedSubmissions,
    isExcused: assignment.submission?.excused === true,
    isMissing: assignment.submission?.missing === true,
    isLate: assignment.submission?.late === true,
  });

  return {
    id: toCanvasId(assignment.id),
    courseId: toCanvasId(assignment.course_id) || course.id,
    courseName,
    name: assignmentName,
    description: toOptionalString(assignment.description),
    htmlUrl: toOptionalString(assignment.html_url),
    dueAt: toOptionalString(assignment.due_at),
    unlockAt: toOptionalString(assignment.unlock_at),
    lockAt: toOptionalString(assignment.lock_at),
    pointsPossible: assignment.points_possible ?? null,
    workflowState: toOptionalString(assignment.workflow_state),
    submissionStatus,
    submissionState,
    submittedAt,
    score,
    grade,
    published: assignment.published ?? null,
    locked: assignment.locked_for_user ?? null,
    hasSubmission,
    hasSubmittedSubmissions,
    gradingType: toOptionalString(assignment.grading_type),
    submissionTypes: assignment.submission_types ?? [],
  };
}

export function mapCanvasAssignmentToPlannerItem(
  assignment: CanvasAssignment,
): CanvasPlannerItemDraft {
  const isCompleted = getCanvasCompletionClassification(assignment).isCompleted;

  return {
    id: `canvas-planner-${assignment.courseId}-${assignment.id}`,
    source: "canvas",
    sourceId: assignment.id,
    courseId: assignment.courseId,
    courseName: assignment.courseName ?? "",
    title: assignment.name ?? "",
    dueDate: assignment.dueAt,
    htmlUrl: assignment.htmlUrl,
    category: "Academics",
    status: isCompleted ? "completed" : "open",
    priorityHint: getPlannerPriorityHint(assignment.dueAt),
  };
}

export function mapCanvasAssignmentToAcademicAssignment(
  assignment: CanvasAssignment,
): CanvasAcademicAssignmentDraft {
  return {
    id: `canvas-academics-${assignment.courseId}-${assignment.id}`,
    source: "canvas",
    sourceId: assignment.id,
    courseId: assignment.courseId,
    courseName: assignment.courseName ?? "",
    name: assignment.name ?? "",
    dueDate: assignment.dueAt ?? assignment.lockAt ?? assignment.unlockAt ?? null,
    lockAt: assignment.lockAt,
    unlockAt: assignment.unlockAt,
    status: getAcademicAssignmentStatus(assignment),
    scoreEarned: assignment.score,
    scorePossible: assignment.pointsPossible,
    htmlUrl: assignment.htmlUrl,
  };
}
