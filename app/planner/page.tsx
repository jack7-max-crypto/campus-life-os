"use client";

import { FormEvent, useMemo, useState } from "react";
import { Card, MetricRow } from "@/components/ui/card";
import { Assignment } from "@/lib/academics/types";
import { formatDate } from "@/lib/academics/utils";
import { useCourses } from "@/lib/academics/useCourses";
import {
  PlannerTaskCategory,
  plannerTaskCategories,
  usePlannerTasks,
} from "@/lib/planner/usePlannerTasks";

type PlannerBucket = "Overdue" | "Today" | "This Week" | "Later";
type PlannerAssignmentItem = Assignment & {
  itemType: "assignment";
  bucket: PlannerBucket;
  courseName: string;
  title: string;
  displayCategory: "Academics";
};
type PlannerTaskItem = {
  id: string;
  itemType: "task";
  bucket: PlannerBucket;
  dueDate: string;
  title: string;
  displayCategory: PlannerTaskCategory;
  note?: string;
};
type PlannerItem = PlannerAssignmentItem | PlannerTaskItem;

type TaskDraft = {
  title: string;
  dueDate: string;
  category: PlannerTaskCategory;
  note: string;
};

const bucketOrder: PlannerBucket[] = ["Overdue", "Today", "This Week", "Later"];
const taskCategoryClasses: Record<PlannerTaskCategory | "Academics", string> = {
  Academics: "bg-blue-100 text-blue-700",
  Fitness: "bg-emerald-100 text-emerald-700",
  Money: "bg-amber-100 text-amber-700",
  Personal: "bg-rose-100 text-rose-700",
};

function createTaskDraft(): TaskDraft {
  return {
    title: "",
    dueDate: new Date().toISOString().slice(0, 10),
    category: "Personal",
    note: "",
  };
}

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
  const {
    tasks,
    addTask,
    markTaskComplete,
    hasHydrated: hasPlannerTasksHydrated,
  } = usePlannerTasks();
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(createTaskDraft);
  const isReady = hasHydrated && hasPlannerTasksHydrated;

  const planner = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const incompleteAssignments: PlannerAssignmentItem[] = courses
      .flatMap((course) =>
        course.assignments.map((assignment) => ({
          ...assignment,
          itemType: "assignment" as const,
          bucket: getPlannerBucket(assignment.dueDate, today),
          courseName: course.name,
          title: assignment.name,
          displayCategory: "Academics" as const,
        })),
      )
      .filter((assignment) => assignment.status !== "completed");

    const incompleteTasks: PlannerTaskItem[] = tasks
      .filter((task) => !task.completed)
      .map((task) => ({
        id: task.id,
        itemType: "task" as const,
        bucket: getPlannerBucket(task.dueDate, today),
        dueDate: task.dueDate,
        title: task.title,
        displayCategory: task.category,
        note: task.note,
      }));

    const incompleteItems: PlannerItem[] = [...incompleteAssignments, ...incompleteTasks].sort(
      (a, b) => {
        const dateDifference = toCalendarDay(a.dueDate).getTime() - toCalendarDay(b.dueDate).getTime();
        if (dateDifference !== 0) return dateDifference;
        return a.title.localeCompare(b.title);
      },
    );

    const grouped = bucketOrder.reduce<Record<PlannerBucket, PlannerItem[]>>(
      (accumulator, bucket) => {
        accumulator[bucket] = incompleteItems.filter((item) => item.bucket === bucket);
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
      incompleteItems,
    };
  }, [courses, tasks]);

  const markAssignmentComplete = (courseId: string, assignmentId: string) => {
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

  const handleAddTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addTask(taskDraft);
    setTaskDraft(createTaskDraft());
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Planner</h2>
        <p className="mt-1 text-sm text-slate-500">
          One timeline for course assignments and your own custom tasks.
        </p>
      </section>

      <Card title="Add task" subtitle="Add a personal planner item">
        <form className="space-y-3" onSubmit={handleAddTask}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Title
              <input
                required
                value={taskDraft.title}
                onChange={(event) =>
                  setTaskDraft((previous) => ({ ...previous, title: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
              Due date
              <input
                required
                type="date"
                value={taskDraft.dueDate}
                onChange={(event) =>
                  setTaskDraft((previous) => ({ ...previous, dueDate: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <label className="text-xs text-slate-500">
              Category
              <select
                value={taskDraft.category}
                onChange={(event) =>
                  setTaskDraft((previous) => ({
                    ...previous,
                    category: event.target.value as PlannerTaskCategory,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                {plannerTaskCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-slate-500 sm:col-span-2">
              Note (optional)
              <textarea
                rows={3}
                value={taskDraft.note}
                onChange={(event) =>
                  setTaskDraft((previous) => ({ ...previous, note: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
            </label>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Add task
          </button>
        </form>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card title="Open items" subtitle="Assignments and tasks">
          <MetricRow
            label="Total"
            value={isReady ? String(planner.incompleteItems.length) : "—"}
          />
        </Card>
        <Card title="Overdue" subtitle="Past due">
          <MetricRow label="Count" value={isReady ? String(planner.grouped.Overdue.length) : "—"} />
        </Card>
        <Card title="Today" subtitle="Due today">
          <MetricRow label="Count" value={isReady ? String(planner.grouped.Today.length) : "—"} />
        </Card>
        <Card title="This Week" subtitle="Due in the next 7 days">
          <MetricRow
            label="Count"
            value={isReady ? String(planner.grouped["This Week"].length) : "—"}
          />
        </Card>
        <Card title="Later" subtitle="Beyond the next 7 days">
          <MetricRow label="Count" value={isReady ? String(planner.grouped.Later.length) : "—"} />
        </Card>
      </section>

      {!isReady ? (
        <Card title="Planner loading" subtitle="Reading saved planner data">
          <p className="text-sm text-slate-600">Loading assignments and tasks...</p>
        </Card>
      ) : planner.incompleteItems.length === 0 ? (
        <Card title="All caught up" subtitle="No open planner items">
          <p className="text-sm text-slate-600">
            Every assignment and custom task is marked completed.
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
                subtitle={`${assignments.length} open item${assignments.length === 1 ? "" : "s"}`}
              >
                {assignments.length === 0 ? (
                  <p className="text-sm text-slate-600">Nothing in this bucket.</p>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((item) => (
                      <div
                        key={`${item.itemType}-${item.id}`}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700">
                              {item.itemType === "assignment" ? "Assignment" : "Task"}
                            </span>
                            <span
                              className={`rounded-full px-2 py-1 font-medium ${taskCategoryClasses[item.displayCategory]}`}
                            >
                              {item.displayCategory}
                            </span>
                            <span>
                              {item.itemType === "assignment"
                                ? item.courseName
                                : "Custom task"}{" "}
                              • due {formatDate(item.dueDate)}
                            </span>
                          </div>
                          {item.itemType === "task" && item.note ? (
                            <p className="mt-2 text-xs text-slate-500">{item.note}</p>
                          ) : null}
                        </div>
                        <button
                          onClick={() =>
                            item.itemType === "assignment"
                              ? markAssignmentComplete(item.courseId, item.id)
                              : markTaskComplete(item.id)
                          }
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
