import type { AssignmentStatus } from "@/lib/academics/types";

export type CanvasConnectionMode = "unconfigured" | "oauth" | "dev-token";
export type CanvasSyncState = "idle" | "syncing" | "ready" | "error";
export type CanvasIdentifier = string | number;

export type CanvasApiEnrollment = {
  type?: string | null;
  role?: string | null;
};

export type CanvasApiTerm = {
  id?: CanvasIdentifier;
  name?: string | null;
  start_at?: string | null;
  end_at?: string | null;
};

export type CanvasApiCourse = {
  id: CanvasIdentifier;
  name?: string | null;
  course_code?: string | null;
  html_url?: string | null;
  workflow_state?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  published?: boolean | null;
  access_restricted_by_date?: boolean | null;
  image_download_url?: string | null;
  enrollments?: CanvasApiEnrollment[] | null;
  term?: CanvasApiTerm | null;
};

export type CanvasApiSubmission = {
  workflow_state?: string | null;
  submitted_at?: string | null;
  grade?: string | null;
  score?: number | null;
  missing?: boolean | null;
  late?: boolean | null;
  excused?: boolean | null;
};

export type CanvasApiAssignment = {
  id: CanvasIdentifier;
  course_id?: CanvasIdentifier | null;
  name?: string | null;
  description?: string | null;
  html_url?: string | null;
  due_at?: string | null;
  unlock_at?: string | null;
  lock_at?: string | null;
  points_possible?: number | null;
  workflow_state?: string | null;
  published?: boolean | null;
  locked_for_user?: boolean | null;
  has_submitted_submissions?: boolean | null;
  grading_type?: string | null;
  submission_types?: string[] | null;
  submission?: CanvasApiSubmission | null;
};

export type CanvasCourse = {
  id: string;
  name: string;
  courseCode: string | null;
  htmlUrl: string | null;
  workflowState: string | null;
  enrollmentType: string | null;
  startAt: string | null;
  endAt: string | null;
  termName: string | null;
  published: boolean | null;
  restrictedByDate: boolean | null;
  imageUrl: string | null;
};

export type CanvasSubmissionStatus =
  | "submitted"
  | "missing"
  | "late"
  | "graded"
  | "excused"
  | "not-submitted"
  | "unknown";

export type CanvasAssignment = {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  description: string | null;
  htmlUrl: string | null;
  dueAt: string | null;
  unlockAt: string | null;
  lockAt: string | null;
  pointsPossible: number | null;
  workflowState: string | null;
  submissionStatus: CanvasSubmissionStatus;
  submissionState: string | null;
  submittedAt: string | null;
  score: number | null;
  grade: string | null;
  published: boolean | null;
  locked: boolean | null;
  hasSubmission?: boolean | null;
  hasSubmittedSubmissions: boolean | null;
  gradingType: string | null;
  submissionTypes: string[];
};

export type CanvasPlannerItemDraft = {
  id: string;
  source: "canvas";
  sourceId: string;
  courseId: string;
  courseName: string;
  title: string;
  dueDate: string | null;
  htmlUrl: string | null;
  category: "Academics";
  status: "open" | "completed";
  priorityHint: "P1" | "P2" | "P3";
};

export type CanvasAcademicAssignmentDraft = {
  id: string;
  source: "canvas";
  sourceId: string;
  courseId: string;
  courseName: string;
  name: string;
  dueDate: string | null;
  lockAt?: string | null;
  unlockAt?: string | null;
  status: AssignmentStatus;
  scoreEarned: number | null;
  scorePossible: number | null;
  htmlUrl: string | null;
};

export type CanvasImportCounts = {
  courses: number;
  assignments: number;
  plannerItems: number;
  academicAssignments: number;
};

export type CanvasSyncResult = {
  connectionMode: Exclude<CanvasConnectionMode, "unconfigured">;
  syncedAt: string;
  importedCanvasCourses: CanvasCourse[];
  importedCanvasAssignments: CanvasAssignment[];
  plannerItems: CanvasPlannerItemDraft[];
  academicAssignments: CanvasAcademicAssignmentDraft[];
  counts: CanvasImportCounts;
  warnings: string[];
};

export type CanvasImportSnapshot = {
  status: CanvasSyncState;
  lastSyncedAt: string | null;
  importedCanvasCourses: CanvasCourse[];
  importedCanvasAssignments: CanvasAssignment[];
  plannerItems: CanvasPlannerItemDraft[];
  academicAssignments: CanvasAcademicAssignmentDraft[];
  counts: CanvasImportCounts;
  warnings: string[];
  errorMessage: string | null;
};

export type CanvasStatusResponse = {
  mode: CanvasConnectionMode;
  isConfigured: boolean;
  oauthConfigured: boolean;
  isConnected: boolean;
  canSync: boolean;
  connectUrl: string | null;
  disconnectUrl: string | null;
  baseUrlHost: string | null;
  setupMessage: string;
};

export const emptyCanvasImportCounts: CanvasImportCounts = {
  courses: 0,
  assignments: 0,
  plannerItems: 0,
  academicAssignments: 0,
};

export const emptyCanvasImportSnapshot: CanvasImportSnapshot = {
  status: "idle",
  lastSyncedAt: null,
  importedCanvasCourses: [],
  importedCanvasAssignments: [],
  plannerItems: [],
  academicAssignments: [],
  counts: emptyCanvasImportCounts,
  warnings: [],
  errorMessage: null,
};
