import "server-only";

import { getAssignmentTimestamp } from "@/lib/academics/dates";
import { createCanvasClient } from "@/lib/integrations/canvas/client";
import {
  mapCanvasAssignment,
  mapCanvasAssignmentToAcademicAssignment,
  mapCanvasAssignmentToPlannerItem,
  mapCanvasCourse,
} from "@/lib/integrations/canvas/mapper";
import type {
  CanvasAssignment,
  CanvasCourse,
  CanvasSyncResult,
} from "@/lib/integrations/canvas/types";

type SyncCanvasDataInput = {
  baseUrl: string;
  accessToken: string;
  connectionMode: CanvasSyncResult["connectionMode"];
};

function compareAssignments(left: CanvasAssignment, right: CanvasAssignment) {
  const leftTime = getAssignmentTimestamp(left.dueAt) ?? Number.POSITIVE_INFINITY;
  const rightTime = getAssignmentTimestamp(right.dueAt) ?? Number.POSITIVE_INFINITY;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return (left.name ?? "").localeCompare(right.name ?? "");
}

function compareCourses(left: CanvasCourse, right: CanvasCourse) {
  return (left.name ?? "").localeCompare(right.name ?? "");
}

function getCourseWarningName(course: CanvasCourse | undefined) {
  const normalized = course?.name?.trim();
  return normalized || "Unknown course";
}

export async function syncCanvasData({
  baseUrl,
  accessToken,
  connectionMode,
}: SyncCanvasDataInput): Promise<CanvasSyncResult> {
  const client = createCanvasClient({ baseUrl, accessToken });
  const mappedCanvasCourses = (await client.getCourses()).map(mapCanvasCourse).sort(compareCourses);

  const warnings: string[] = [];
  const importedCanvasCourses: CanvasCourse[] = [];
  const importedCanvasAssignments: CanvasAssignment[] = [];
  const assignmentResponses = await Promise.allSettled(
    mappedCanvasCourses.map(async (course) => ({
      course,
      assignments: await client.getCourseAssignments(course.id),
    })),
  );

  assignmentResponses.forEach((result, index) => {
    if (result.status === "rejected") {
      const courseName = getCourseWarningName(mappedCanvasCourses[index]);
      warnings.push(`Assignments could not be loaded for ${courseName}.`);
      return;
    }

    const courseAssignments = result.value.assignments.map((assignment) =>
      mapCanvasAssignment(assignment, result.value.course),
    );

    importedCanvasCourses.push(result.value.course);
    importedCanvasAssignments.push(...courseAssignments);
  });

  importedCanvasAssignments.sort(compareAssignments);

  const plannerItems = importedCanvasAssignments.map(mapCanvasAssignmentToPlannerItem);
  const academicAssignments = importedCanvasAssignments.map(mapCanvasAssignmentToAcademicAssignment);

  return {
    connectionMode,
    syncedAt: new Date().toISOString(),
    importedCanvasCourses,
    importedCanvasAssignments,
    plannerItems,
    academicAssignments,
    counts: {
      courses: importedCanvasCourses.length,
      assignments: importedCanvasAssignments.length,
      plannerItems: plannerItems.length,
      academicAssignments: academicAssignments.length,
    },
    warnings,
  };
}
