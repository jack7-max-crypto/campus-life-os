import { Course } from "./types";

export type SeedProfile = "demo" | "personal";

/**
 * ============================================================================
 * HOW TO CUSTOMIZE YOUR ACADEMICS SEED DATA
 * ============================================================================
 * 1) Edit `personalCourses` below with your real classes.
 * 2) Keep category weights per course summing to 100.
 * 3) Set ACTIVE_SEED_PROFILE to "personal".
 * 4) In the app, click "Reset demo data" only when you want to restore demo data.
 *
 * Assignment status options:
 * - "not-started"
 * - "in-progress"
 * - "completed"
 *
 * scoreEarned / scorePossible:
 * - Use numbers when graded (e.g. 42 / 50)
 * - Use null when not graded yet
 * ============================================================================
 */
export const ACTIVE_SEED_PROFILE: SeedProfile = "personal";

/**
 * Demo data used for product walkthroughs and the "Reset demo data" action.
 */
export const demoCourses: Course[] = [
  {
    id: "organic-chem",
    name: "Organic Chemistry",
    credits: 4,
    targetGrade: 90,
    finalExamWeight: 30,
    categories: [
      { name: "Labs", weight: 25 },
      { name: "Quizzes", weight: 20 },
      { name: "Midterm", weight: 25 },
      { name: "Final Exam", weight: 30 },
    ],
    assignments: [
      {
        id: "org-lab-3",
        courseId: "organic-chem",
        name: "Lab Report 3",
        category: "Labs",
        dueDate: "2026-03-18",
        status: "completed",
        scoreEarned: 88,
        scorePossible: 100,
      },
      {
        id: "org-lab-4",
        courseId: "organic-chem",
        name: "Lab Report 4",
        category: "Labs",
        dueDate: "2026-03-27",
        status: "in-progress",
        scoreEarned: null,
        scorePossible: 100,
      },
      {
        id: "org-final",
        courseId: "organic-chem",
        name: "Comprehensive Final",
        category: "Final Exam",
        dueDate: "2026-05-12",
        status: "not-started",
        scoreEarned: null,
        scorePossible: 100,
      },
    ],
  },
  {
    id: "data-structures",
    name: "Data Structures",
    credits: 4,
    targetGrade: 92,
    finalExamWeight: 25,
    categories: [
      { name: "Projects", weight: 40 },
      { name: "Quizzes", weight: 20 },
      { name: "Midterm", weight: 15 },
      { name: "Final Exam", weight: 25 },
    ],
    assignments: [
      {
        id: "ds-proj-1",
        courseId: "data-structures",
        name: "Linked List Project",
        category: "Projects",
        dueDate: "2026-03-20",
        status: "completed",
        scoreEarned: 93,
        scorePossible: 100,
      },
      {
        id: "ds-proj-2",
        courseId: "data-structures",
        name: "Tree Visualizer",
        category: "Projects",
        dueDate: "2026-04-01",
        status: "in-progress",
        scoreEarned: null,
        scorePossible: 100,
      },
      {
        id: "ds-final",
        courseId: "data-structures",
        name: "Final Exam",
        category: "Final Exam",
        dueDate: "2026-05-09",
        status: "not-started",
        scoreEarned: null,
        scorePossible: 100,
      },
    ],
  },
];

/**
 * Personal real-data template.
 *
 * Replace these with your own classes. Keep each course's categories +
 * assignments aligned by category names.
 */
export const personalCourses: Course[] = [
  {
    id: "cs-350",
    name: "Software Engineering",
    credits: 3,
    targetGrade: 92,
    finalExamWeight: 30,
    categories: [
      { name: "Projects", weight: 45 },
      { name: "Quizzes", weight: 15 },
      { name: "Participation", weight: 10 },
      { name: "Final Exam", weight: 30 },
    ],
    assignments: [
      {
        id: "cs350-p1",
        courseId: "cs-350",
        name: "Project 1: API Service",
        category: "Projects",
        dueDate: "2026-03-29",
        status: "completed",
        scoreEarned: 94,
        scorePossible: 100,
      },
      {
        id: "cs350-q4",
        courseId: "cs-350",
        name: "Quiz 4",
        category: "Quizzes",
        dueDate: "2026-04-02",
        status: "in-progress",
        scoreEarned: null,
        scorePossible: 20,
      },
      {
        id: "cs350-final",
        courseId: "cs-350",
        name: "Final Exam",
        category: "Final Exam",
        dueDate: "2026-05-08",
        status: "not-started",
        scoreEarned: null,
        scorePossible: 100,
      },
    ],
  },
  {
    id: "math-241",
    name: "Linear Algebra",
    credits: 4,
    targetGrade: 88,
    finalExamWeight: 35,
    categories: [
      { name: "Homework", weight: 30 },
      { name: "Midterm", weight: 35 },
      { name: "Final Exam", weight: 35 },
    ],
    assignments: [
      {
        id: "math241-hw7",
        courseId: "math-241",
        name: "Homework 7",
        category: "Homework",
        dueDate: "2026-03-30",
        status: "completed",
        scoreEarned: 27,
        scorePossible: 30,
      },
      {
        id: "math241-midterm",
        courseId: "math-241",
        name: "Midterm",
        category: "Midterm",
        dueDate: "2026-04-12",
        status: "not-started",
        scoreEarned: null,
        scorePossible: 100,
      },
      {
        id: "math241-final",
        courseId: "math-241",
        name: "Final Exam",
        category: "Final Exam",
        dueDate: "2026-05-15",
        status: "not-started",
        scoreEarned: null,
        scorePossible: 100,
      },
    ],
  },
];

export const seedProfiles: Record<
  SeedProfile,
  {
    label: string;
    courses: Course[];
  }
> = {
  demo: {
    label: "Demo",
    courses: demoCourses,
  },
  personal: {
    label: "Personal",
    courses: personalCourses,
  },
};

function cloneCourses(courses: Course[]) {
  return JSON.parse(JSON.stringify(courses)) as Course[];
}

export function getSeedCourses(profile: SeedProfile = ACTIVE_SEED_PROFILE): Course[] {
  return cloneCourses(seedProfiles[profile].courses);
}

// Backward-compatible export used in existing UI imports.
export const mockCourses = getSeedCourses();
