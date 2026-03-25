"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, MetricRow } from "@/components/ui/card";
import { ACTIVE_SEED_PROFILE, getSeedCourses } from "@/lib/academics/mockData";
import { Assignment, AssignmentStatus, Course } from "@/lib/academics/types";
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

function createEmptyDraft(defaultCategory: string): AssignmentDraft {
  return {
    name: "",
    category: defaultCategory,
    scoreEarned: "",
    scorePossible: "",
    dueDate: "",
    status: "not-started",
  };
}

export default function AcademicsPage() {
  const [courses, setCourses] = useState<Course[]>(seedCourses);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(seedCourses[0]?.id ?? "");
  const [assignmentCourseFilter, setAssignmentCourseFilter] = useState<string>("all");
  const [draft, setDraft] = useState<AssignmentDraft | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

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

  if (!selectedCourse || !metrics) {
    return null;
  }

  const openAddAssignment = () => {
    const defaultCategory = selectedCourse.categories[0]?.name ?? "";
    setDraft(createEmptyDraft(defaultCategory));
    setIsEditMode(false);
  };

  const openEditAssignment = (assignment: Assignment) => {
    setDraft({
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
    setIsEditMode(true);
  };

  const closeDraft = () => {
    setDraft(null);
    setIsEditMode(false);
  };

  const saveDraft = () => {
    if (!draft || !draft.name.trim()) return;

    const scoreEarned = draft.scoreEarned.trim() === "" ? null : Number(draft.scoreEarned);
    const scorePossible = draft.scorePossible.trim() === "" ? null : Number(draft.scorePossible);

    const normalized: Assignment = {
      id: draft.id ?? `${selectedCourse.id}-${Date.now()}`,
      courseId: selectedCourse.id,
      name: draft.name.trim(),
      category: draft.category,
      dueDate: draft.dueDate || new Date().toISOString().slice(0, 10),
      status: draft.status,
      scoreEarned: Number.isFinite(scoreEarned) ? scoreEarned : null,
      scorePossible: Number.isFinite(scorePossible) ? scorePossible : null,
    };

    setCourses((prev) =>
      prev.map((course) => {
        if (course.id !== selectedCourse.id) return course;

        if (isEditMode && draft.id) {
          return {
            ...course,
            assignments: course.assignments.map((assignment) =>
              assignment.id === draft.id ? normalized : assignment,
            ),
          };
        }

        return {
          ...course,
          assignments: [...course.assignments, normalized],
        };
      }),
    );

    closeDraft();
  };

  const updateTargetGrade = (value: string) => {
    const parsed = Number(value);
    const nextTarget = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 100)) : 0;

    setCourses((prev) =>
      prev.map((course) =>
        course.id === selectedCourse.id ? { ...course, targetGrade: nextTarget } : course,
      ),
    );
  };

  const resetDemoData = () => {
    setCourses(demoSeedCourses);
    setSelectedCourseId(demoSeedCourses[0]?.id ?? "");
    setAssignmentCourseFilter("all");
    closeDraft();
    window.localStorage.removeItem(ACADEMICS_STORAGE_KEY);
  };

  const renderNeededValue = (value: number) => {
    if (value <= 0) return "0.0%";
    if (value > 100) return `${formatPercent(value)} (over 100%)`;
    return formatPercent(value);
  };

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

      {draft ? (
        <Card
          title={isEditMode ? "Edit assignment" : "Add assignment"}
          subtitle={`Course: ${selectedCourse.name}`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Assignment name
              <input
                value={draft.name}
                onChange={(event) => setDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
              Category
              <select
                value={draft.category}
                onChange={(event) =>
                  setDraft((prev) => (prev ? { ...prev, category: event.target.value } : prev))
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
                value={draft.scoreEarned}
                onChange={(event) =>
                  setDraft((prev) => (prev ? { ...prev, scoreEarned: event.target.value } : prev))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
              Score possible (optional)
              <input
                type="number"
                value={draft.scorePossible}
                onChange={(event) =>
                  setDraft((prev) => (prev ? { ...prev, scorePossible: event.target.value } : prev))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
              Due date
              <input
                type="date"
                value={draft.dueDate}
                onChange={(event) => setDraft((prev) => (prev ? { ...prev, dueDate: event.target.value } : prev))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
              Status
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((prev) =>
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
              onClick={saveDraft}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {isEditMode ? "Save changes" : "Add assignment"}
            </button>
            <button
              onClick={closeDraft}
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
