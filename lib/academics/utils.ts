import { parseAssignmentDate } from "./dates";
import { getEffectiveAssignments } from "./getEffectiveAssignments";
import { Assignment, AssignmentStatus, Course } from "./types";

type CategoryProgress = {
  weight: number;
  average: number | null;
  completedWeight: number;
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
export type RecoveryOutlook =
  | "secured"
  | "comfortable"
  | "possible"
  | "tight"
  | "difficult"
  | "unlikely";

export type CourseIntelligence = {
  metrics: CourseMetrics;
  gradeGap: number;
  upcomingAssignments: number;
  nearestDueDays: number | null;
  approximateRemainingWeight: number;
  priorityScore: number;
  priorityLabel: "High" | "Medium" | "Low";
  reachability: RecoveryOutlook;
  neededState: NeededScoreState;
  reason: string;
  recommendation: string;
  payoffScore: number;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCourseName(value: string) {
  return value.trim().toLowerCase();
}

export function formatPercent(value: number) {
  return `${round(value, 1).toFixed(1)}%`;
}

export function formatDate(value: string) {
  const parsedDate = parseAssignmentDate(value);
  if (!parsedDate) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
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
    (a) => a.status === "completed" && a.scoreEarned !== null && isPositiveNumber(a.scorePossible),
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

function isPositiveNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function calculateCategoryCompletedWeight(category: { weight: number }, assignments: Assignment[]) {
  const scoredCompleted = assignments.filter(
    (assignment) =>
      assignment.status === "completed" &&
      assignment.scoreEarned !== null &&
      isPositiveNumber(assignment.scorePossible),
  );

  if (assignments.length === 0 || scoredCompleted.length === 0) {
    return 0;
  }

  const totalPossible = assignments.reduce(
    (sum, assignment) => {
      const possible = assignment.scorePossible;
      return sum + (isPositiveNumber(possible) ? possible : 0);
    },
    0,
  );
  const completedPossible = scoredCompleted.reduce(
    (sum, assignment) => sum + (assignment.scorePossible ?? 0),
    0,
  );

  const completionRatio =
    totalPossible > 0 ? completedPossible / totalPossible : scoredCompleted.length / assignments.length;

  return category.weight * clamp(completionRatio, 0, 1);
}

export function calculateCourseMetrics(course: Course): CourseMetrics {
  const byCategory = groupAssignmentsByCategory(course.assignments);

  const categoryProgress: Record<string, CategoryProgress> = {};
  for (const category of course.categories) {
    const assignments = byCategory[category.name] ?? [];
    const average = categoryAverage(assignments);
    categoryProgress[category.name] = {
      weight: category.weight,
      average,
      completedWeight: average === null ? 0 : calculateCategoryCompletedWeight(category, assignments),
    };
  }

  let completedWeight = 0;
  let currentPoints = 0;

  for (const category of Object.values(categoryProgress)) {
    if (category.average !== null && category.completedWeight > 0) {
      completedWeight += category.completedWeight;
      currentPoints += category.average * category.completedWeight;
    }
  }

  const remainingWeight = Math.max(0, 100 - completedWeight);
  const currentGrade = completedWeight > 0 ? (currentPoints / completedWeight) * 100 : 0;
  const overallAverage = completedWeight > 0 ? currentPoints / completedWeight : 0;
  const projectedPoints = currentPoints + overallAverage * remainingWeight;

  const neededOnRemainingRaw =
    remainingWeight > 0
      ? ((course.targetGrade - currentPoints) / remainingWeight) * 100
      : course.targetGrade <= currentPoints
        ? 0
        : 101;

  const finalRemainingWeight = clamp(course.finalExamWeight, 0, remainingWeight);
  const nonFinalRemainingWeight = Math.max(0, remainingWeight - finalRemainingWeight);
  const projectedNonFinalRemainingPoints = nonFinalRemainingWeight * overallAverage;
  const neededOnFinalRaw =
    finalRemainingWeight > 0
      ? ((course.targetGrade - currentPoints - projectedNonFinalRemainingPoints) /
          finalRemainingWeight) *
        100
      : course.targetGrade <= currentPoints + projectedNonFinalRemainingPoints
        ? 0
        : 101;

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
  const dueDate = parseAssignmentDate(dateISO);
  if (!dueDate) {
    return Number.POSITIVE_INFINITY;
  }

  const diffMs = dueDate.getTime() - now.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

function calculateApproximateRemainingWeight(course: Course) {
  const byCategory = groupAssignmentsByCategory(course.assignments);

  return round(
    course.categories.reduce((sum, category) => {
      const assignments = byCategory[category.name] ?? [];
      const completedWeight = calculateCategoryCompletedWeight(category, assignments);
      return sum + Math.max(0, category.weight - completedWeight);
    }, 0),
  );
}

function calculateDueUrgency(nearestDueDays: number | null, upcomingAssignments: number) {
  if (nearestDueDays === null || upcomingAssignments === 0) {
    return 0;
  }

  const baseUrgency =
    nearestDueDays <= 0
      ? 100
      : nearestDueDays <= 3
        ? 92
        : nearestDueDays <= 7
          ? 78
          : nearestDueDays <= 14
            ? 58
            : nearestDueDays <= 21
              ? 34
              : 18;

  const workloadBump = Math.min(18, Math.max(0, upcomingAssignments - 1) * 6);
  return clamp(baseUrgency + workloadBump, 0, 100);
}

export function getRecoveryOutlook(metrics: CourseMetrics, targetGrade: number): RecoveryOutlook {
  const neededState = getNeededScoreState(metrics.neededOnRemaining);

  if (metrics.remainingWeight <= 0) {
    return metrics.currentPoints >= targetGrade ? "secured" : "unlikely";
  }

  if (neededState === "secured") {
    return "secured";
  }

  if (neededState === "impossible") {
    return "unlikely";
  }

  if (metrics.neededOnRemaining <= 75) {
    return "comfortable";
  }

  if (metrics.neededOnRemaining <= 85) {
    return "possible";
  }

  if (metrics.neededOnRemaining <= 92) {
    return "tight";
  }

  return "difficult";
}

export function describeRecoveryOutlook(outlook: RecoveryOutlook) {
  switch (outlook) {
    case "secured":
      return "Target already secured";
    case "comfortable":
      return "Target still reachable";
    case "possible":
      return "Possible with steady work";
    case "tight":
      return "Possible but tight";
    case "difficult":
      return "Difficult but still reachable";
    case "unlikely":
      return "Target is now unlikely";
    default:
      return "Recovery outlook unclear";
  }
}

function calculateRiskScore(metrics: CourseMetrics, gradeGap: number, neededState: NeededScoreState) {
  const baseRisk =
    metrics.currentGrade < 70
      ? 96
      : metrics.currentGrade < 77
        ? 84
        : metrics.currentGrade < 83
          ? 70
          : metrics.currentGrade < 90
            ? 46
            : 22;

  const targetPressure = gradeGap > 0 ? Math.min(18, gradeGap * 1.8) : 0;
  const reachabilityPressure =
    neededState === "impossible"
      ? 18
      : metrics.neededOnRemaining >= 95
        ? 12
        : metrics.neededOnRemaining >= 90
          ? 8
          : metrics.neededOnRemaining >= 85
            ? 5
            : 0;

  return clamp(round(baseRisk + targetPressure + reachabilityPressure), 0, 100);
}

function buildPriorityReason(
  gradeGap: number,
  approximateRemainingWeight: number,
  dueUrgency: number,
  outlook: RecoveryOutlook,
) {
  if (outlook === "unlikely") {
    return "below target and recovery path is narrowing";
  }

  if (gradeGap >= 10 && approximateRemainingWeight >= 20) {
    return "well below target with enough weight left to matter";
  }

  if (dueUrgency >= 75) {
    return "upcoming work is due soon and can still move the grade";
  }

  if (gradeGap > 0 && approximateRemainingWeight >= 10) {
    return "below target and still recoverable";
  }

  if (gradeGap > 0) {
    return "small gap, moderate urgency";
  }

  if (approximateRemainingWeight >= 20) {
    return "on track, but remaining work can still swing the result";
  }

  return "on track, lower priority";
}

function buildRecommendation(
  gradeGap: number,
  approximateRemainingWeight: number,
  dueUrgency: number,
  outlook: RecoveryOutlook,
) {
  if (outlook === "unlikely") {
    return "Protect the final grade by prioritizing the next high-weight assignment.";
  }

  if (dueUrgency >= 75) {
    return "Start the nearest due assignment first to preserve recoverable points.";
  }

  if (gradeGap >= 8) {
    return "Put focused study time here first; this is your clearest recovery need.";
  }

  if (approximateRemainingWeight >= 25) {
    return "A strong finish here gives you one of the better payoff opportunities.";
  }

  if (gradeGap <= 0) {
    return "Maintain pace and avoid slipping on the remaining work.";
  }

  return "Give this class a focused check-in after the highest-risk courses.";
}

export function getCourseIntelligence(course: Course): CourseIntelligence {
  const metrics = calculateCourseMetrics(course);
  const assignments = getEffectiveAssignments([course]).filter(
    (assignment) => normalizeCourseName(assignment.courseName) === normalizeCourseName(course.name),
  );
  const incomplete = assignments.filter((assignment) => assignment.status !== "completed");
  const gradeGap = round(course.targetGrade - metrics.currentGrade);
  const approximateRemainingWeight = Math.max(
    metrics.remainingWeight,
    calculateApproximateRemainingWeight(course),
  );

  const dueWindows = incomplete.flatMap((assignment) =>
    assignment.dueDate ? [daysUntil(assignment.dueDate)] : [],
  );
  const nearestDueDays = dueWindows.length ? Math.min(...dueWindows) : null;

  const dueUrgency = calculateDueUrgency(nearestDueDays, incomplete.length);
  const neededState = getNeededScoreState(metrics.neededOnRemaining);
  const reachability = getRecoveryOutlook(metrics, course.targetGrade);
  const gapScore = clamp(gradeGap <= 0 ? 0 : gradeGap * 5, 0, 100);
  const opportunityScore = clamp(approximateRemainingWeight, 0, 100);
  const riskScore = calculateRiskScore(metrics, gradeGap, neededState);
  const payoffScore = clamp(
    round(opportunityScore * 0.65 + course.credits * 8 + (neededState === "possible" ? 10 : 0)),
    0,
    100,
  );

  let score =
    gapScore * 0.36 + opportunityScore * 0.24 + dueUrgency * 0.2 + riskScore * 0.14 + payoffScore * 0.06;

  if (reachability === "secured") {
    score -= 18;
  } else if (reachability === "comfortable") {
    score -= 8;
  } else if (reachability === "tight") {
    score += 5;
  } else if (reachability === "difficult") {
    score += 9;
  } else if (reachability === "unlikely") {
    score += 4;
  }

  const priorityScore = clamp(round(score), 0, 100);

  return {
    metrics,
    gradeGap,
    upcomingAssignments: incomplete.length,
    nearestDueDays: nearestDueDays === null ? null : round(nearestDueDays, 1),
    approximateRemainingWeight: round(approximateRemainingWeight),
    priorityScore,
    priorityLabel: priorityLabel(priorityScore),
    reachability,
    neededState,
    reason: buildPriorityReason(gradeGap, approximateRemainingWeight, dueUrgency, reachability),
    recommendation: buildRecommendation(
      gradeGap,
      approximateRemainingWeight,
      dueUrgency,
      reachability,
    ),
    payoffScore,
  };
}

export function calculatePriorityScore(course: Course) {
  return getCourseIntelligence(course).priorityScore;
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
