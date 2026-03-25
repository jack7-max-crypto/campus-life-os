import { Assignment, AssignmentStatus, Course } from "./types";

type CategoryProgress = {
  weight: number;
  average: number | null;
};

export type CourseMetrics = {
  currentGrade: number;
  currentPoints: number;
  completedWeight: number;
  remainingWeight: number;
  projectedGrade: number;
  neededOnRemaining: number;
  neededOnFinal: number;
  finalExamWeight: number;
};

export type NeededScoreState = "secured" | "possible" | "impossible";

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function formatPercent(value: number) {
  return `${round(value, 1).toFixed(1)}%`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function toLetterGrade(score: number) {
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

function groupAssignmentsByCategory(assignments: Assignment[]) {
  const grouped: Record<string, Assignment[]> = {};
  for (const assignment of assignments) {
    if (!grouped[assignment.category]) {
      grouped[assignment.category] = [];
    }
    grouped[assignment.category].push(assignment);
  }
  return grouped;
}

function categoryAverage(assignments: Assignment[]) {
  const completed = assignments.filter(
    (a) => a.status === "completed" && a.scoreEarned !== null && a.scorePossible,
  );
  if (completed.length === 0) {
    return null;
  }

  const totalEarned = completed.reduce((sum, item) => sum + (item.scoreEarned ?? 0), 0);
  const totalPossible = completed.reduce((sum, item) => sum + (item.scorePossible ?? 0), 0);
  if (totalPossible === 0) {
    return null;
  }
  return totalEarned / totalPossible;
}

export function calculateCourseMetrics(course: Course): CourseMetrics {
  const byCategory = groupAssignmentsByCategory(course.assignments);

  const categoryProgress: Record<string, CategoryProgress> = {};
  for (const category of course.categories) {
    const average = categoryAverage(byCategory[category.name] ?? []);
    categoryProgress[category.name] = {
      weight: category.weight,
      average,
    };
  }

  let completedWeight = 0;
  let currentPoints = 0;

  for (const category of Object.values(categoryProgress)) {
    if (category.average !== null) {
      completedWeight += category.weight;
      currentPoints += category.average * category.weight;
    }
  }

  const remainingWeight = Math.max(0, 100 - completedWeight);
  const currentGrade = completedWeight > 0 ? (currentPoints / completedWeight) * 100 : 0;
  const overallAverage = completedWeight > 0 ? currentPoints / completedWeight : 0;

  let projectedPoints = currentPoints;
  for (const category of Object.values(categoryProgress)) {
    if (category.average === null) {
      projectedPoints += overallAverage * category.weight;
    }
  }

  const neededOnRemainingRaw =
    remainingWeight > 0 ? ((course.targetGrade - currentPoints) / remainingWeight) * 100 : 0;

  const nonFinalRemainingWeight = Math.max(0, remainingWeight - course.finalExamWeight);
  const projectedNonFinalRemainingPoints = nonFinalRemainingWeight * overallAverage;
  const neededOnFinalRaw =
    course.finalExamWeight > 0
      ? ((course.targetGrade - currentPoints - projectedNonFinalRemainingPoints) /
          course.finalExamWeight) *
        100
      : 0;

  return {
    currentGrade: round(currentGrade),
    currentPoints: round(currentPoints),
    completedWeight: round(completedWeight),
    remainingWeight: round(remainingWeight),
    projectedGrade: round(projectedPoints),
    neededOnRemaining: round(neededOnRemainingRaw),
    neededOnFinal: round(neededOnFinalRaw),
    finalExamWeight: course.finalExamWeight,
  };
}

export function getNeededScoreState(value: number): NeededScoreState {
  if (value <= 0) return "secured";
  if (value > 100) return "impossible";
  return "possible";
}

export function explainNeededScore(value: number) {
  const state = getNeededScoreState(value);
  if (state === "secured") return "Target already secured based on current performance.";
  if (state === "impossible") return "Target is currently impossible without extra credit.";
  return `Need ${formatPercent(value)} on this component to reach target.`;
}

function daysUntil(dateISO: string) {
  const now = new Date();
  const dueDate = new Date(`${dateISO}T12:00:00`);
  const diffMs = dueDate.getTime() - now.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

export function calculatePriorityScore(course: Course) {
  const metrics = calculateCourseMetrics(course);
  const incomplete = course.assignments.filter((assignment) => assignment.status !== "completed");

  const nearestDueDays = incomplete.length
    ? Math.min(...incomplete.map((assignment) => daysUntil(assignment.dueDate)))
    : 30;

  const dueUrgency = nearestDueDays <= 0 ? 100 : Math.max(0, 100 - nearestDueDays * 8);

  const gradeRisk = Math.max(0, 100 - metrics.currentGrade);
  const remainingWorkRisk = metrics.remainingWeight;

  const score = gradeRisk * 0.45 + remainingWorkRisk * 0.35 + dueUrgency * 0.2;
  return round(score);
}

export function priorityLabel(score: number): "High" | "Medium" | "Low" {
  if (score >= 55) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

export function formatAssignmentScore(assignment: Assignment) {
  if (assignment.scoreEarned === null || assignment.scorePossible === null) {
    return "—";
  }
  const percent =
    assignment.scorePossible > 0
      ? (assignment.scoreEarned / assignment.scorePossible) * 100
      : 0;
  return `${assignment.scoreEarned}/${assignment.scorePossible} (${formatPercent(percent)})`;
}

export function statusLabel(status: AssignmentStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "in-progress":
      return "In progress";
    case "not-started":
      return "Not started";
    default:
      return status;
  }
}
