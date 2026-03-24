"use client";

import { useMemo, useState } from "react";
import { Card, MetricRow } from "@/components/ui/card";
import { mockCourses } from "@/lib/academics/mockData";
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

const statusClasses: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800",
  "in-progress": "bg-amber-100 text-amber-800",
  "not-started": "bg-slate-200 text-slate-700",
};

const neededStateClasses: Record<string, string> = {
  secured: "bg-emerald-100 text-emerald-800",
  possible: "bg-blue-100 text-blue-800",
  impossible: "bg-rose-100 text-rose-800",
};

const priorityClasses: Record<string, string> = {
  High: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-emerald-100 text-emerald-700",
};

export default function AcademicsPage() {
  const [selectedCourseId, setSelectedCourseId] = useState(mockCourses[0]?.id ?? "");
  const [assignmentCourseFilter, setAssignmentCourseFilter] = useState<string>("all");

  const selectedCourse = useMemo(
    () => mockCourses.find((course) => course.id === selectedCourseId) ?? mockCourses[0],
    [selectedCourseId],
  );

  const metrics = useMemo(
    () => (selectedCourse ? calculateCourseMetrics(selectedCourse) : null),
    [selectedCourse],
  );

  const remainingState = metrics ? getNeededScoreState(metrics.neededOnRemaining) : "possible";
  const finalState = metrics ? getNeededScoreState(metrics.neededOnFinal) : "possible";

  const coursePriorities = useMemo(() => {
    return [...mockCourses]
      .map((course) => {
        const score = calculatePriorityScore(course);
        return {
          course,
          score,
          label: priorityLabel(score),
        };
      })
      .sort((a, b) => b.score - a.score);
  }, []);

  const allAssignments = useMemo(
    () => mockCourses.flatMap((course) => course.assignments),
    [],
  );

  const filteredAssignments = useMemo(() => {
    if (assignmentCourseFilter === "all") {
      return allAssignments;
    }
    return allAssignments.filter((assignment) => assignment.courseId === assignmentCourseFilter);
  }, [allAssignments, assignmentCourseFilter]);

  if (!selectedCourse || !metrics) {
    return null;
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

        <label className="text-xs text-slate-500">
          Select course
          <select
            value={selectedCourse.id}
            onChange={(event) => setSelectedCourseId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 sm:min-w-60"
          >
            {mockCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Courses overview" subtitle="Live course model">
          <MetricRow label="Active courses" value={`${mockCourses.length}`} />
          <MetricRow
            label="Credits"
            value={`${mockCourses.reduce((sum, course) => sum + course.credits, 0)}`}
          />
          <MetricRow
            label="Avg current grade"
            value={formatPercent(
              mockCourses.reduce((sum, course) => sum + calculateCourseMetrics(course).currentGrade, 0) /
                mockCourses.length,
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
            <div key={item.course.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
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
            value={
              metrics.neededOnRemaining > 0
                ? formatPercent(metrics.neededOnRemaining)
                : formatPercent(0)
            }
          />
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {explainNeededScore(metrics.neededOnRemaining)}
          </p>
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${neededStateClasses[remainingState]}`}
          >
            {remainingState.toUpperCase()}
          </span>
        </Card>

        <Card title="Final exam calculator" subtitle="Needed on final exam only">
          <MetricRow label="Final exam weight" value={formatPercent(metrics.finalExamWeight)} />
          <MetricRow
            label="Needed on final"
            value={metrics.neededOnFinal > 0 ? formatPercent(metrics.neededOnFinal) : formatPercent(0)}
          />
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {explainNeededScore(metrics.neededOnFinal)}
          </p>
          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${neededStateClasses[finalState]}`}>
            {finalState.toUpperCase()}
          </span>
        </Card>
      </section>

      <Card title="Assignments table" subtitle="Real course assignment data">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-xs text-slate-500">
            Filter by course
            <select
              value={assignmentCourseFilter}
              onChange={(event) => setAssignmentCourseFilter(event.target.value)}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
            >
              <option value="all">All courses</option>
              {mockCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-500">{filteredAssignments.length} assignments</p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredAssignments.map((assignment) => {
                const courseName =
                  mockCourses.find((course) => course.id === assignment.courseId)?.name ??
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
