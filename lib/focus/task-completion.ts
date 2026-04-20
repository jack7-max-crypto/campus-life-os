"use client";

import type { FocusSession } from "@/lib/focus/session";
import { markAssignmentCompleteInStorage } from "@/lib/academics/useCourses";
import { markCanvasAcademicAssignmentCompleteInStorage } from "@/lib/integrations/canvas/store";
import { markPlannerTaskCompleteInStorage } from "@/lib/planner/usePlannerTasks";
import { recordTaskCompletion } from "@/lib/streak";

export function completeFocusSessionTask(session: FocusSession) {
  if (!session.isActive || !session.sourceId || !session.taskType) {
    return false;
  }

  if (session.taskType === "task") {
    return markPlannerTaskCompleteInStorage(session.sourceId);
  }

  if (!session.courseId) {
    return false;
  }

  if (session.sourceId.startsWith("canvas-academics-")) {
    const didUpdate = markCanvasAcademicAssignmentCompleteInStorage(session.sourceId);
    if (didUpdate) {
      recordTaskCompletion();
    }

    return didUpdate;
  }

  return markAssignmentCompleteInStorage(session.courseId, session.sourceId);
}
