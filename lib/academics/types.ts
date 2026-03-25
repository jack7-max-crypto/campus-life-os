export type AssignmentStatus = "completed" | "in-progress" | "not-started";

export type GradeCategory = {
  name: string;
  weight: number;
};

export type Assignment = {
  id: string;
  courseId: string;
  name: string;
  category: string;
  dueDate: string;
  status: AssignmentStatus;
  scoreEarned: number | null;
  scorePossible: number | null;
};

export type Course = {
  id: string;
  name: string;
  credits: number;
  targetGrade: number;
  finalExamWeight: number;
  categories: GradeCategory[];
  assignments: Assignment[];
};
