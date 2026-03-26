"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, MetricRow } from "@/components/ui/card";
import { ACTIVE_SEED_PROFILE, getSeedCourses } from "@/lib/academics/mockData";
import { Assignment, Course } from "@/lib/academics/types";
import {
  calculateCourseMetrics,
  calculatePriorityScore,
  formatDate,
  formatPercent,
  priorityLabel,
} from "@/lib/academics/utils";

const ACADEMICS_STORAGE_KEY = "campus-life-os.academics.v1";
const fallbackCourses = getSeedCourses(ACTIVE_SEED_PROFILE);

function percentToGpa(grade: number): number {
  if (grade >= 90) return 4.0;
  if (grade >= 80) return 3.0;
  if (grade >= 70) return 2.0;
  if (grade >= 60) return 1.0;
  return 0;
}

function computeWeightedGpa(courses: Course[], gradeByCourseId: Record<string, number>): number {
  const totals = courses.reduce(
    (acc, course) => {
      const grade = gradeByCourseId[course.id] ?? 0;
      return {
        points: acc.points + percentToGpa(grade) * course.credits,
        credits: acc.credits + course.credits,
      };
    },
    { points: 0, credits: 0 },
  );

  if (totals.credits === 0) return 0;
  return Math.round((totals.points / totals.credits) * 100) / 100;
}

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>(fallbackCourses);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ACADEMICS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Course[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCourses(parsed);
      }
    } catch {
      // Keep fallback seed data if local data is unavailable.
    }
  }, []);

  const dashboard = useMemo(() => {
    const currentGrades: Record<string, number> = {};
    const projectedGrades: Record<string, number> = {};

    for (const course of courses) {
      const metrics = calculateCourseMetrics(course);
      currentGrades[course.id] = metrics.currentGrade;
      projectedGrades[course.id] = metrics.projectedGrade;
    }

    const currentGpa = computeWeightedGpa(courses, currentGrades);
    const projectedGpa = computeWeightedGpa(courses, projectedGrades);

    const topPriority = [...courses]
      .map((course) => ({
        course,
        score: calculatePriorityScore(course),
      }))
      .sort((a, b) => b.score - a.score)[0];

    const allAssignments: Assignment[] = courses.flatMap((course) => course.assignments);
    const now = new Date();
    const upcomingAssignments = allAssignments
      .filter((assignment) => new Date(assignment.dueDate).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const nextAssignment = upcomingAssignments[0] ?? null;
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const dueIn7Days = allAssignments.filter((assignment) => {
      const due = new Date(assignment.dueDate).getTime();
      return due >= now.getTime() && due <= nextWeek.getTime();
    }).length;

    const atRisk = courses
      .map((course) => {
        const metrics = calculateCourseMetrics(course);
        const gapToTarget = course.targetGrade - metrics.projectedGrade;
        return { course, metrics, gapToTarget };
      })
      .filter((entry) => entry.gapToTarget > 0)
      .sort((a, b) => b.gapToTarget - a.gapToTarget);

    return {
      currentGpa,
      projectedGpa,
      topPriority,
      nextAssignment,
      dueIn7Days,
      atRisk,
    };
  }, [courses]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Home</h2>
        <p className="mt-1 text-sm text-slate-500">Your academic snapshot powered by saved Academics data.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="GPA snapshot" subtitle="Weighted by course credits">
          <MetricRow label="Current GPA" value={dashboard.currentGpa.toFixed(2)} />
          <MetricRow label="Projected GPA" value={dashboard.projectedGpa.toFixed(2)} />
        </Card>

        <Card title="Top priority class" subtitle="Highest urgency + risk">
          <MetricRow label="Course" value={dashboard.topPriority?.course.name ?? "—"} />
          <MetricRow
            label="Priority"
            value={dashboard.topPriority ? priorityLabel(dashboard.topPriority.score) : "—"}
          />
          <MetricRow label="Score" value={dashboard.topPriority ? String(dashboard.topPriority.score) : "—"} />
        </Card>

        <Card title="Assignments" subtitle="What's next">
          <MetricRow label="Next upcoming assignment" value={dashboard.nextAssignment?.name ?? "None"} />
          <MetricRow
            label="Due date"
            value={dashboard.nextAssignment ? formatDate(dashboard.nextAssignment.dueDate) : "—"}
          />
          <MetricRow label="Due in next 7 days" value={String(dashboard.dueIn7Days)} />
        </Card>
      </section>

      <section>
        <Card title="Needs attention" subtitle="Courses currently below target">
          {dashboard.atRisk.length === 0 ? (
            <p className="text-sm text-slate-600">No at-risk courses right now. Nice work.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.atRisk.slice(0, 3).map((entry) => (
                <div key={entry.course.id} className="rounded-xl bg-rose-50 px-3 py-2">
                  <p className="text-sm font-semibold text-rose-800">{entry.course.name}</p>
                  <p className="text-xs text-rose-700">
                    Projected {formatPercent(entry.metrics.projectedGrade)} vs target {formatPercent(entry.course.targetGrade)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
