"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, MetricRow } from "@/components/ui/card";
import { ACTIVE_SEED_PROFILE, getSeedCourses } from "@/lib/academics/mockData";
import { Assignment, Course } from "@/lib/academics/types";
import { calculateCourseMetrics, formatDate, formatPercent } from "@/lib/academics/utils";

const ACADEMICS_STORAGE_KEY = "campus-life-os.academics.v1";
const fallbackCourses = getSeedCourses(ACTIVE_SEED_PROFILE);

type AssignmentWithCourse = Assignment & { courseName: string };

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
      // Keep fallback seed data if saved data cannot be parsed.
    }
  }, []);

  const dashboard = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const currentByCourse = courses.map((course) => {
      const metrics = calculateCourseMetrics(course);
      return {
        course,
        metrics,
        gap: course.targetGrade - metrics.currentGrade,
      };
    });

    const atRiskClasses = currentByCourse
      .filter((entry) => entry.metrics.currentGrade < entry.course.targetGrade)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 2);

    const allAssignments: AssignmentWithCourse[] = courses.flatMap((course) =>
      course.assignments.map((assignment) => ({ ...assignment, courseName: course.name })),
    );

    const upcomingDeadlines = allAssignments
      .filter((assignment) => {
        const due = new Date(assignment.dueDate);
        due.setHours(0, 0, 0, 0);
        return assignment.status !== "completed" && due.getTime() >= now.getTime();
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3);

    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const dueInNext7Days = allAssignments.filter((assignment) => {
      const due = new Date(assignment.dueDate);
      due.setHours(0, 0, 0, 0);
      return assignment.status !== "completed" && due.getTime() >= now.getTime() && due.getTime() <= sevenDaysFromNow.getTime();
    }).length;

    const avgCurrentGrade =
      currentByCourse.length === 0
        ? 0
        : currentByCourse.reduce((sum, entry) => sum + entry.metrics.currentGrade, 0) / currentByCourse.length;

    const worstAtRisk = atRiskClasses[0];
    const nearestAssignment = upcomingDeadlines[0];

    let recommendedNextStep = "Keep going—your current plan looks on track.";
    if (worstAtRisk) {
      recommendedNextStep = `Focus on ${worstAtRisk.course.name}: you're ${formatPercent(worstAtRisk.gap)} below target.`;
    } else if (nearestAssignment) {
      recommendedNextStep = `Next up: ${nearestAssignment.name} (${nearestAssignment.courseName}) due ${formatDate(nearestAssignment.dueDate)}.`;
    }

    return {
      activeCourses: courses.length,
      dueInNext7Days,
      avgCurrentGrade,
      upcomingDeadlines,
      atRiskClasses,
      recommendedNextStep,
    };
  }, [courses]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Home</h2>
        <p className="mt-1 text-sm text-slate-500">Academics dashboard powered by your saved course data.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Today overview" subtitle="Live academics snapshot">
          <MetricRow label="Active courses" value={String(dashboard.activeCourses)} />
          <MetricRow label="Due in next 7 days" value={String(dashboard.dueInNext7Days)} />
          <MetricRow label="Average current grade" value={formatPercent(dashboard.avgCurrentGrade)} />
        </Card>

        <Card title="Upcoming deadlines" subtitle="Next 3 incomplete assignments">
          {dashboard.upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-slate-600">No upcoming incomplete assignments.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.upcomingDeadlines.map((assignment) => (
                <div key={assignment.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{assignment.name}</p>
                  <p className="text-xs text-slate-600">{assignment.courseName} • due {formatDate(assignment.dueDate)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="At-risk classes" subtitle="Largest gaps to target">
          {dashboard.atRiskClasses.length === 0 ? (
            <p className="text-sm text-slate-600">No classes are currently below target.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.atRiskClasses.map((entry) => (
                <div key={entry.course.id} className="rounded-xl bg-rose-50 px-3 py-2">
                  <p className="text-sm font-semibold text-rose-800">{entry.course.name}</p>
                  <p className="text-xs text-rose-700">
                    Current {formatPercent(entry.metrics.currentGrade)} vs target {formatPercent(entry.course.targetGrade)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section>
        <Card title="Recommended next step" subtitle="One focused action">
          <p className="text-sm text-slate-700">{dashboard.recommendedNextStep}</p>
        </Card>
      </section>
    </div>
  );
}
