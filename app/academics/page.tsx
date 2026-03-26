"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, MetricRow } from "@/components/ui/card";
import { ACTIVE_SEED_PROFILE, getSeedCourses } from "@/lib/academics/mockData";
import { Assignment, AssignmentStatus, Course, GradeCategory } from "@/lib/academics/types";
import {
  calculateCourseMetrics,
  calculatePriorityScore,
  explainNeededScore,
  formatAssignmentScore,
  formatDate,
  formatPercent,
  getNeededScoreState,
  priorityLabel,
  statusLabel,
  toLetterGrade,
} from "@/lib/academics/utils";

type AssignmentDraft = {
  id?: string;
  name: string;
  category: string;
  scoreEarned: string;
  scorePossible: string;
  dueDate: string;
  status: AssignmentStatus;
};

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

const statusClasses: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800",
  "in-progress": "bg-amber-100 text-amber-800",
  "not-started": "bg-slate-200 text-slate-700",
};

const neededStateClasses: Record<string, string> = {
  secured: "bg-emerald-100 text-emerald-800 border-emerald-200",
  possible: "bg-blue-100 text-blue-800 border-blue-200",
  impossible: "bg-rose-100 text-rose-800 border-rose-200",
};

const ACADEMICS_STORAGE_KEY = "campus-life-os.academics.v1";
const seedCourses = getSeedCourses(ACTIVE_SEED_PROFILE);
const demoSeedCourses = getSeedCourses("demo");

const priorityClasses: Record<string, string> = {
  High: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-emerald-100 text-emerald-700",
};

function createEmptyAssignmentDraft(defaultCategory: string): AssignmentDraft {
  return {
    name: "",
    category: defaultCategory,
    scoreEarned: "",
    scorePossible: "",
    dueDate: "",
    status: "not-started",
  };
}

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


function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function coursePercentToSimpleGpa(gradePercent: number): number {
  const grade = clampPercentage(gradePercent);
  if (grade >= 90) return 4.0;
  if (grade >= 80) return 3.0;
  if (grade >= 70) return 2.0;
  if (grade >= 60) return 1.0;
  return 0.0;
}

function computeSimpleWeightedGpaFromPercentages(
  courses: Course[],
  gradeByCourseId: Record<string, number>,
): number {
  let totalCredits = 0;
  let weightedPoints = 0;

  for (const course of courses) {
    const credits = Number(course.credits) || 0;
    const percent = gradeByCourseId[course.id] ?? 0;
    const gpaPoints = coursePercentToSimpleGpa(percent);
    weightedPoints += gpaPoints * credits;
    totalCredits += credits;
  }

  if (totalCredits <= 0) return 0;
  return Math.round((weightedPoints / totalCredits) * 100) / 100;
}

export default function AcademicsPage() {
  const [courses, setCourses] = useState<Course[]>(seedCourses);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(seedCourses[0]?.id ?? "");
  const [assignmentCourseFilter, setAssignmentCourseFilter] = useState<string>("all");
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft | null>(null);
  const [isEditAssignmentMode, setIsEditAssignmentMode] = useState(false);
  const [courseDraft, setCourseDraft] = useState<CourseDraft | null>(null);
  const [isEditCourseMode, setIsEditCourseMode] = useState(false);
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [whatIfCourseId, setWhatIfCourseId] = useState(seedCourses[0]?.id ?? "");
  const [whatIfGrade, setWhatIfGrade] = useState("85");

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0],
    [courses, selectedCourseId],
  );

  const metrics = useMemo(
    () => (selectedCourse ? calculateCourseMetrics(selectedCourse) : null),
    [selectedCourse],
  );

  const remainingState = metrics ? getNeededScoreState(metrics.neededOnRemaining) : "possible";
  const finalState = metrics ? getNeededScoreState(metrics.neededOnFinal) : "possible";

  const coursePriorities = useMemo(() => {
    return [...courses]
      .map((course) => {
        const score = calculatePriorityScore(course);
        return {
          course,
          score,
          label: priorityLabel(score),
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [courses]);

  const gpaOverview = useMemo(() => {
    const currentGrades: Record<string, number> = {};
    const projectedGrades: Record<string, number> = {};

    for (const course of courses) {
      const courseMetrics = calculateCourseMetrics(course);
      currentGrades[course.id] = clampPercentage(courseMetrics.currentGrade);
      projectedGrades[course.id] = clampPercentage(courseMetrics.projectedGrade);
    }

    const currentGpa = computeSimpleWeightedGpaFromPercentages(courses, currentGrades);
    const projectedGpa = computeSimpleWeightedGpaFromPercentages(courses, projectedGrades);

    const parsedWhatIf = clampPercentage(Number(whatIfGrade));
    const hasValidWhatIfCourse = courses.some((course) => course.id === whatIfCourseId);
    const whatIfGrades = {
      ...projectedGrades,
      [whatIfCourseId]: hasValidWhatIfCourse ? parsedWhatIf : projectedGrades[whatIfCourseId] ?? 0,
    };
    const whatIfProjectedGpa = computeSimpleWeightedGpaFromPercentages(courses, whatIfGrades);

    return {
      currentGpa,
      projectedGpa,
      whatIfProjectedGpa,
    };
  }, [courses, whatIfCourseId, whatIfGrade]);

  const allAssignments = useMemo(() => courses.flatMap((course) => course.assignments), [courses]);

  const filteredAssignments = useMemo(() => {
    if (assignmentCourseFilter === "all") {
      return allAssignments;
    }
    return allAssignments.filter((assignment) => assignment.courseId === assignmentCourseFilter);
  }, [allAssignments, assignmentCourseFilter]);

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

  const openAddAssignment = () => {
    if (!selectedCourse) return;
    const defaultCategory = selectedCourse.categories[0]?.name ?? "";
    setAssignmentDraft(createEmptyAssignmentDraft(defaultCategory));
    setIsEditAssignmentMode(false);
  };

  const openEditAssignment = (assignment: Assignment) => {
    setAssignmentDraft({
      id: assignment.id,
      name: assignment.name,
      category: assignment.category,
      scoreEarned:
        assignment.scoreEarned === null || assignment.scoreEarned === undefined
          ? ""
          : String(assignment.scoreEarned),
      scorePossible:
        assignment.scorePossible === null || assignment.scorePossible === undefined
          ? ""
          : String(assignment.scorePossible),
      dueDate: assignment.dueDate,
      status: assignment.status,
    });
    setIsEditAssignmentMode(true);
  };

  const closeAssignmentDraft = () => {
    setAssignmentDraft(null);
    setIsEditAssignmentMode(false);
  };

  const saveAssignmentDraft = () => {
    if (!assignmentDraft || !selectedCourse || !assignmentDraft.name.trim()) return;

    const scoreEarned =
      assignmentDraft.scoreEarned.trim() === "" ? null : Number(assignmentDraft.scoreEarned);
    const scorePossible =
      assignmentDraft.scorePossible.trim() === "" ? null : Number(assignmentDraft.scorePossible);

    const normalized: Assignment = {
      id: assignmentDraft.id ?? `${selectedCourse.id}-${Date.now()}`,
      courseId: selectedCourse.id,
      name: assignmentDraft.name.trim(),
      category: assignmentDraft.category,
      dueDate: assignmentDraft.dueDate || new Date().toISOString().slice(0, 10),
      status: assignmentDraft.status,
      scoreEarned: Number.isFinite(scoreEarned) ? scoreEarned : null,
      scorePossible: Number.isFinite(scorePossible) ? scorePossible : null,
    };

    setCourses((prev) =>
      prev.map((course) => {
        if (course.id !== selectedCourse.id) return course;

        if (isEditAssignmentMode && assignmentDraft.id) {
          return {
            ...course,
            assignments: course.assignments.map((assignment) =>
              assignment.id === assignmentDraft.id ? normalized : assignment,
            ),
          };
        }

        return {
          ...course,
          assignments: [...course.assignments, normalized],
        };
      }),
    );

    closeAssignmentDraft();
  };

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

    setAssignmentCourseFilter("all");
    closeAssignmentDraft();
    closeCourseDraft();
  };

  const resetDemoData = () => {
    setCourses(demoSeedCourses);
    setSelectedCourseId(demoSeedCourses[0]?.id ?? "");
    setAssignmentCourseFilter("all");
    setWhatIfCourseId(demoSeedCourses[0]?.id ?? "");
    setWhatIfGrade("85");
    closeAssignmentDraft();
    closeCourseDraft();
    window.localStorage.removeItem(ACADEMICS_STORAGE_KEY);
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
          <h2 className="text-2xl font-semibold tracking-tight">Academics</h2>
          <p className="mt-1 text-sm text-slate-500">No courses yet. Add your first course.</p>
        </section>
        <button
          onClick={openAddCourse}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Add course
        </button>

        {courseDraft ? (
          <Card title="Add course" subtitle="Create your course setup">
            <p className="text-sm text-slate-600">Complete course details and save.</p>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Academics</h2>
          <p className="mt-1 text-sm text-slate-500">
            Interactive grade planning for your current semester.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs text-slate-500">
            Select course
            <select
              value={selectedCourse.id}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 sm:min-w-56"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Target grade
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={selectedCourse.targetGrade}
              onChange={(event) => updateTargetGrade(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 sm:w-36"
            />
          </label>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          onClick={openAddCourse}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Add course
        </button>
        <button
          onClick={openEditCourse}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Edit course
        </button>
        <button
          onClick={deleteSelectedCourse}
          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
        >
          Delete course
        </button>
      </section>

      <section>
        <Card title="GPA Overview" subtitle="4.0 scale using course credits">
          <MetricRow label="Current GPA" value={gpaOverview.currentGpa.toFixed(2)} />
          <MetricRow label="Projected GPA" value={gpaOverview.projectedGpa.toFixed(2)} />
          <MetricRow label="What-if GPA" value={gpaOverview.whatIfProjectedGpa.toFixed(2)} />

          <div className="space-y-2 rounded-xl bg-slate-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What If</p>
            <label className="block text-xs text-slate-500">
              Course
              <select
                value={whatIfCourseId}
                onChange={(event) => setWhatIfCourseId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-500">
              Temporary grade %
              <input
                type="number"
                min={0}
                max={100}
                value={whatIfGrade}
                onChange={(event) => setWhatIfGrade(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
          </div>
        </Card>
      </section>

      {courseDraft ? (
        <Card
          title={isEditCourseMode ? "Edit course" : "Add course"}
          subtitle="Manage course details and grading structure"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Course name
              <input
                value={courseDraft.name}
                onChange={(event) =>
                  setCourseDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Grading categories
              </p>
              <button
                onClick={addCategoryDraft}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Add category
              </button>
            </div>

            {courseDraft.categories.map((category, index) => (
              <div key={`${index}-${category.name}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <input
                  placeholder="Category name"
                  value={category.name}
                  onChange={(event) => updateCategoryDraft(index, "name", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Weight"
                  value={category.weight}
                  onChange={(event) => updateCategoryDraft(index, "weight", event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
                />
                <button
                  onClick={() => removeCategoryDraft(index)}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Remove
                </button>
              </div>
            ))}

            <p className="text-xs text-slate-500">
              Total category weight: <strong>{categoryWeightTotal(courseDraft.categories)}%</strong>
            </p>
          </div>

          {courseFormError ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{courseFormError}</p>
          ) : null}

          <div className="flex gap-2">
            <button
              onClick={saveCourseDraft}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {isEditCourseMode ? "Save course" : "Create course"}
            </button>
            <button
              onClick={closeCourseDraft}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Courses overview" subtitle="Live course model">
          <MetricRow label="Active courses" value={`${courses.length}`} />
          <MetricRow
            label="Credits"
            value={`${courses.reduce((sum, course) => sum + course.credits, 0)}`}
          />
          <MetricRow
            label="Avg current grade"
            value={formatPercent(
              courses.reduce((sum, course) => sum + calculateCourseMetrics(course).currentGrade, 0) /
                courses.length,
            )}
          />
        </Card>

        <Card title="Current grades" subtitle={selectedCourse.name}>
          <MetricRow
            label="Current"
            value={`${formatPercent(metrics.currentGrade)} (${toLetterGrade(metrics.currentGrade)})`}
          />
          <MetricRow label="Target" value={`${formatPercent(selectedCourse.targetGrade)}`} />
          <MetricRow label="Projected" value={`${formatPercent(metrics.projectedGrade)}`} />
        </Card>

        <Card title="Class priority ranking" subtitle="Computed from risk + urgency">
          {coursePriorities.map((item) => (
            <div
              key={item.course.id}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClasses[item.label]}`}
                >
                  {item.label}
                </span>
                <span className="text-sm text-slate-700">{item.course.name}</span>
              </div>
              <span className="text-sm font-semibold text-slate-900">{item.score}</span>
            </div>
          ))}
        </Card>

        <Card
          title="Grade target calculator"
          className="xl:col-span-2"
          subtitle="Needed on all remaining coursework"
        >
          <MetricRow label="Completed weight" value={formatPercent(metrics.completedWeight)} />
          <MetricRow label="Remaining weight" value={formatPercent(metrics.remainingWeight)} />
          <MetricRow
            label="Needed on remaining"
            value={renderNeededValue(metrics.neededOnRemaining)}
          />
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {explainNeededScore(metrics.neededOnRemaining)}
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
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {explainNeededScore(metrics.neededOnFinal)}
          </p>
          <span
            className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${neededStateClasses[finalState]}`}
          >
            {finalState.toUpperCase()}
          </span>
        </Card>
      </section>

      <Card title="Assignments table" subtitle="Real course assignment data">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-xs text-slate-500">
            Filter by course
            <select
              value={assignmentCourseFilter}
              onChange={(event) => setAssignmentCourseFilter(event.target.value)}
              className="ml-0 mt-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 sm:ml-2 sm:mt-0"
            >
              <option value="all">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">{filteredAssignments.length} assignments</p>
            <button
              onClick={openAddAssignment}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Add assignment
            </button>
            <button
              onClick={resetDemoData}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Reset demo data
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Assignment</th>
                <th className="px-2 py-2">Course</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Score</th>
                <th className="px-2 py-2">Due date</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredAssignments.map((assignment) => {
                const courseName =
                  courses.find((course) => course.id === assignment.courseId)?.name ??
                  assignment.courseId;
                return (
                  <tr
                    key={assignment.id}
                    className={assignment.status === "completed" ? "bg-white" : "bg-amber-50/35"}
                  >
                    <td className="px-2 py-2 font-medium">{assignment.name}</td>
                    <td className="px-2 py-2">{courseName}</td>
                    <td className="px-2 py-2">{assignment.category}</td>
                    <td className="px-2 py-2">{formatAssignmentScore(assignment)}</td>
                    <td className="px-2 py-2">{formatDate(assignment.dueDate)}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          statusClasses[assignment.status]
                        }`}
                      >
                        {statusLabel(assignment.status)}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => {
                          setSelectedCourseId(assignment.courseId);
                          openEditAssignment(assignment);
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {assignmentDraft ? (
        <Card
          title={isEditAssignmentMode ? "Edit assignment" : "Add assignment"}
          subtitle={`Course: ${selectedCourse.name}`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Assignment name
              <input
                value={assignmentDraft.name}
                onChange={(event) =>
                  setAssignmentDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
              Category
              <select
                value={assignmentDraft.category}
                onChange={(event) =>
                  setAssignmentDraft((prev) =>
                    prev ? { ...prev, category: event.target.value } : prev,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                {selectedCourse.categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-slate-500">
              Score earned (optional)
              <input
                type="number"
                value={assignmentDraft.scoreEarned}
                onChange={(event) =>
                  setAssignmentDraft((prev) =>
                    prev ? { ...prev, scoreEarned: event.target.value } : prev,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
              Score possible (optional)
              <input
                type="number"
                value={assignmentDraft.scorePossible}
                onChange={(event) =>
                  setAssignmentDraft((prev) =>
                    prev ? { ...prev, scorePossible: event.target.value } : prev,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
              Due date
              <input
                type="date"
                value={assignmentDraft.dueDate}
                onChange={(event) =>
                  setAssignmentDraft((prev) =>
                    prev ? { ...prev, dueDate: event.target.value } : prev,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
              Status
              <select
                value={assignmentDraft.status}
                onChange={(event) =>
                  setAssignmentDraft((prev) =>
                    prev ? { ...prev, status: event.target.value as AssignmentStatus } : prev,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                <option value="not-started">Not started</option>
                <option value="in-progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>

          <p className="text-xs text-slate-500">
            Leave score fields blank for incomplete assignments. Metrics update instantly once saved.
          </p>

          <div className="flex gap-2">
            <button
              onClick={saveAssignmentDraft}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {isEditAssignmentMode ? "Save changes" : "Add assignment"}
            </button>
            <button
              onClick={closeAssignmentDraft}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
