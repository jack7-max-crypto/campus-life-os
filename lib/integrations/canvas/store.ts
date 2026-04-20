"use client";

import { useEffect, useState } from "react";
import {
  emptyCanvasImportCounts,
  emptyCanvasImportSnapshot,
  type CanvasAcademicAssignmentDraft,
  type CanvasImportSnapshot,
  type CanvasSyncResult,
} from "@/lib/integrations/canvas/types";

export const CANVAS_IMPORTS_STORAGE_KEY = "campus-life-os.canvas-imports.v1";
export const CANVAS_IMPORTS_UPDATED_EVENT = "campus-life-os.canvas-imports-updated";

function getCanvasAcademicAssignmentEffectiveDate(assignment: {
  dueDate?: string | null;
  lockAt?: string | null;
  unlockAt?: string | null;
}) {
  return assignment.dueDate ?? assignment.lockAt ?? assignment.unlockAt ?? null;
}

function normalizeAcademicAssignments(
  academicAssignments: CanvasAcademicAssignmentDraft[],
  importedCanvasAssignments: CanvasImportSnapshot["importedCanvasAssignments"],
) {
  const importedAssignmentsById = new Map(
    importedCanvasAssignments.map((assignment) => [`${assignment.courseId}:${assignment.id}`, assignment] as const),
  );

  return academicAssignments.map((assignment) => {
    const importedAssignment = importedAssignmentsById.get(`${assignment.courseId}:${assignment.sourceId}`);
    const lockAt = assignment.lockAt ?? importedAssignment?.lockAt ?? null;
    const unlockAt = assignment.unlockAt ?? importedAssignment?.unlockAt ?? null;

    return {
      ...assignment,
      dueDate:
        assignment.dueDate ??
        importedAssignment?.dueAt ??
        lockAt ??
        unlockAt ??
        getCanvasAcademicAssignmentEffectiveDate(assignment),
      lockAt,
      unlockAt,
    };
  });
}

function normalizeSnapshot(value: Partial<CanvasImportSnapshot> | null | undefined): CanvasImportSnapshot {
  const importedCanvasAssignments = value?.importedCanvasAssignments ?? [];
  const academicAssignments = normalizeAcademicAssignments(
    value?.academicAssignments ?? [],
    importedCanvasAssignments,
  );

  return {
    status: value?.status ?? emptyCanvasImportSnapshot.status,
    lastSyncedAt: value?.lastSyncedAt ?? emptyCanvasImportSnapshot.lastSyncedAt,
    importedCanvasCourses: value?.importedCanvasCourses ?? [],
    importedCanvasAssignments,
    plannerItems: value?.plannerItems ?? [],
    academicAssignments,
    counts: {
      ...emptyCanvasImportCounts,
      ...value?.counts,
    },
    warnings: value?.warnings ?? [],
    errorMessage: value?.errorMessage ?? null,
  };
}

function emitCanvasSnapshot(snapshot: CanvasImportSnapshot) {
  window.localStorage.setItem(CANVAS_IMPORTS_STORAGE_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent<CanvasImportSnapshot>(CANVAS_IMPORTS_UPDATED_EVENT, { detail: snapshot }));
}

export function getStoredCanvasImportSnapshot() {
  if (typeof window === "undefined") {
    return emptyCanvasImportSnapshot;
  }

  try {
    const raw = window.localStorage.getItem(CANVAS_IMPORTS_STORAGE_KEY);
    if (!raw) {
      return emptyCanvasImportSnapshot;
    }

    return normalizeSnapshot(JSON.parse(raw) as CanvasImportSnapshot);
  } catch {
    return emptyCanvasImportSnapshot;
  }
}

export function persistCanvasSyncResult(result: CanvasSyncResult) {
  if (typeof window === "undefined") {
    return;
  }

  emitCanvasSnapshot({
    status: "ready",
    lastSyncedAt: result.syncedAt,
    importedCanvasCourses: result.importedCanvasCourses,
    importedCanvasAssignments: result.importedCanvasAssignments,
    plannerItems: result.plannerItems,
    academicAssignments: result.academicAssignments,
    counts: result.counts,
    warnings: result.warnings,
    errorMessage: null,
  });
}

export function markCanvasAcademicAssignmentCompleteInStorage(assignmentId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const snapshot = getStoredCanvasImportSnapshot();
  let hasUpdated = false;

  const nextSnapshot: CanvasImportSnapshot = {
    ...snapshot,
    academicAssignments: snapshot.academicAssignments.map((assignment) => {
      if (assignment.id !== assignmentId || assignment.status === "completed") {
        return assignment;
      }

      hasUpdated = true;
      return {
        ...assignment,
        status: "completed",
      };
    }),
    plannerItems: snapshot.plannerItems.map((item) => {
      if (item.status === "completed" || `canvas-academics-${item.courseId}-${item.sourceId}` !== assignmentId) {
        return item;
      }

      return {
        ...item,
        status: "completed",
      };
    }),
  };

  if (!hasUpdated) {
    return false;
  }

  emitCanvasSnapshot(nextSnapshot);
  return true;
}

export function setCanvasImportError(errorMessage: string) {
  if (typeof window === "undefined") {
    return;
  }

  const snapshot = getStoredCanvasImportSnapshot();
  emitCanvasSnapshot({
    ...snapshot,
    status: "error",
    errorMessage,
  });
}

export function setCanvasImportSyncing() {
  if (typeof window === "undefined") {
    return;
  }

  const snapshot = getStoredCanvasImportSnapshot();
  emitCanvasSnapshot({
    ...snapshot,
    status: "syncing",
    errorMessage: null,
  });
}

export function clearCanvasImportSnapshot() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CANVAS_IMPORTS_STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent<CanvasImportSnapshot>(CANVAS_IMPORTS_UPDATED_EVENT, {
      detail: emptyCanvasImportSnapshot,
    }),
  );
}

export function useCanvasImportSnapshot() {
  const [snapshot, setSnapshot] = useState<CanvasImportSnapshot>(emptyCanvasImportSnapshot);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const syncSnapshot = () => {
      setSnapshot(getStoredCanvasImportSnapshot());
      setHasHydrated(true);
    };

    syncSnapshot();
    window.addEventListener("storage", syncSnapshot);
    window.addEventListener(CANVAS_IMPORTS_UPDATED_EVENT, syncSnapshot as EventListener);

    return () => {
      window.removeEventListener("storage", syncSnapshot);
      window.removeEventListener(CANVAS_IMPORTS_UPDATED_EVENT, syncSnapshot as EventListener);
    };
  }, []);

  return {
    snapshot,
    hasHydrated,
  };
}
