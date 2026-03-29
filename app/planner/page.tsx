"use client";

import { useMemo } from "react";
import { Card, MetricRow } from "@/components/ui/card";
import { Assignment } from "@/lib/academics/types";
import { formatDate } from "@/lib/academics/utils";
import { useCourses } from "@/lib/academics/useCourses";

type PlannerBucket = "Overdue" | "Today" | "This Week" | "Later";
type PlannerAssignment = Assignment & {
  bucket: PlannerBucket;
  courseName: string;
};

const bucketOrder: PlannerBucket[] = ["Overdue", "Today", "This Week", "Later"];

function toCalendarDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getPlannerBucket(dueDate: string, today: Date) {
  const due = toCalendarDay(dueDate);
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  if (due.getTime() < today.getTime()) {
    return "Overdue";
  }

  if (due.getTime() === today.getTime()) {
    return "Today";
  }

  if (due.getTime() <= sevenDaysOut.getTime()) {
    return "This Week";
  }

  return "Later";
}

export default function PlannerPage() {
  const { courses, setCourses, hasHydrated } = useCourses();

  const planner = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const incompleteAssignments: PlannerAssignment[] = courses
      .flatMap((course) =>
        course.assignments.map((assignment) => ({
          ...assignment,
          bucket: getPlannerBucket(assignment.dueDate, today),
          courseName: course.name,
        })),
      )
      .filter((assignment) => assignment.status !== "completed")
      .sort((a, b) => toCalendarDay(a.dueDate).getTime() - toCalendarDay(b.dueDate).getTime());

    const grouped = bucketOrder.reduce<Record<PlannerBucket, PlannerAssignment[]>>(
      (accumulator, bucket) => {
        accumulator[bucket] = incompleteAssignments.filter((assignment) => assignment.bucket === bucket);
        return accumulator;
      },
      {
        Overdue: [],
        Today: [],
        "This Week": [],
        Later: [],
      },
    );

    return {
      grouped,
      incompleteAssignments,
    };
  }, [courses]);

  const markComplete = (courseId: string, assignmentId: string) => {
    setCourses((previousCourses) =>
      previousCourses.map((course) => {
        if (course.id !== courseId) {
          return course;
        }

        return {
          ...course,
          assignments: course.assignments.map((assignment) =>
            assignment.id === assignmentId
              ? {
                  ...assignment,
                  status: "completed",
                }
              : assignment,
          ),
        };
      }),
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Planner</h2>
        <p className="mt-1 text-sm text-slate-500">
          Incomplete assignments grouped by urgency from your saved courses.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card title="Incomplete" subtitle="Open assignments">
          <MetricRow
            label="Total"
            value={hasHydrated ? String(planner.incompleteAssignments.length) : "—"}
          />
        </Card>
        <Card title="Overdue" subtitle="Past due">
          <MetricRow
            label="Count"
            value={hasHydrated ? String(planner.grouped.Overdue.length) : "—"}
          />
        </Card>
        <Card title="Today" subtitle="Due today">
          <MetricRow
            label="Count"
            value={hasHydrated ? String(planner.grouped.Today.length) : "—"}
          />
        </Card>
        <Card title="This Week" subtitle="Due in the next 7 days">
          <MetricRow
            label="Count"
            value={hasHydrated ? String(planner.grouped["This Week"].length) : "—"}
          />
        </Card>
        <Card title="Later" subtitle="Beyond the next 7 days">
          <MetricRow
            label="Count"
            value={hasHydrated ? String(planner.grouped.Later.length) : "—"}
          />
        </Card>
      </section>

      {!hasHydrated ? (
        <Card title="Planner loading" subtitle="Reading saved course data">
          <p className="text-sm text-slate-600">Loading assignments...</p>
        </Card>
      ) : planner.incompleteAssignments.length === 0 ? (
        <Card title="All caught up" subtitle="No incomplete assignments">
          <p className="text-sm text-slate-600">
            Every saved assignment is marked completed.
          </p>
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {bucketOrder.map((bucket) => {
            const assignments = planner.grouped[bucket];
            return (
              <Card
                key={bucket}
                title={bucket}
                subtitle={`${assignments.length} incomplete assignment${
                  assignments.length === 1 ? "" : "s"
                }`}
              >
                {assignments.length === 0 ? (
                  <p className="text-sm text-slate-600">Nothing in this bucket.</p>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {assignment.name}
                          </p>
                          <p className="text-xs text-slate-600">
                            {assignment.courseName} • due {formatDate(assignment.dueDate)}
                          </p>
                        </div>
                        <button
                          onClick={() => markComplete(assignment.courseId, assignment.id)}
                          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                        >
                          Mark complete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
