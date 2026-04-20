"use client";

import { useEffect, useState } from "react";
import { recordTaskCompletion } from "@/lib/streak";
import { mockCourses } from "./mockData";
import { Course } from "./types";

export const ACADEMICS_STORAGE_KEY = "campus-life-os.academics.v1";
export const COURSES_UPDATED_EVENT = "campus-life-os.courses-updated";

export function getStoredCourses() {
  if (typeof window === "undefined") {
    return mockCourses;
  }

  try {
    const raw = window.localStorage.getItem(ACADEMICS_STORAGE_KEY);
    if (!raw) {
      return mockCourses;
    }

    const parsed = JSON.parse(raw) as Course[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : mockCourses;
  } catch {
    return mockCourses;
  }
}

export function markAssignmentCompleteInStorage(courseId: string, assignmentId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const courses = getStoredCourses();
  let hasUpdated = false;

  const nextCourses = courses.map((course) => {
    if (course.id !== courseId) {
      return course;
    }

    return {
      ...course,
      assignments: course.assignments.map((assignment) => {
        if (assignment.id !== assignmentId || assignment.status === "completed") {
          return assignment;
        }

        hasUpdated = true;
        return {
          ...assignment,
          status: "completed" as const,
        };
      }),
    };
  });

  if (!hasUpdated) {
    return false;
  }

  recordTaskCompletion();
  window.localStorage.setItem(ACADEMICS_STORAGE_KEY, JSON.stringify(nextCourses));
  window.dispatchEvent(new CustomEvent<Course[]>(COURSES_UPDATED_EVENT, { detail: nextCourses }));
  return true;
}

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>(mockCourses);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const syncCourses = () => {
      setCourses(getStoredCourses());
      setHasHydrated(true);
    };

    syncCourses();
    window.addEventListener("storage", syncCourses);
    window.addEventListener(COURSES_UPDATED_EVENT, syncCourses as EventListener);

    return () => {
      window.removeEventListener("storage", syncCourses);
      window.removeEventListener(COURSES_UPDATED_EVENT, syncCourses as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    const serializedCourses = JSON.stringify(courses);
    if (window.localStorage.getItem(ACADEMICS_STORAGE_KEY) === serializedCourses) {
      return;
    }

    window.localStorage.setItem(ACADEMICS_STORAGE_KEY, serializedCourses);
    window.dispatchEvent(new CustomEvent<Course[]>(COURSES_UPDATED_EVENT, { detail: courses }));
  }, [courses, hasHydrated]);

  return { courses, setCourses, hasHydrated };
}
