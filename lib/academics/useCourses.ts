"use client";

import { useEffect, useState } from "react";
import { mockCourses } from "./mockData";
import { Course } from "./types";

const ACADEMICS_STORAGE_KEY = "campus-life-os.academics.v1";

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>(mockCourses);
  const [hasHydrated, setHasHydrated] = useState(false);

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
      // keep mock fallback
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(ACADEMICS_STORAGE_KEY, JSON.stringify(courses));
  }, [courses, hasHydrated]);

  return { courses, setCourses, hasHydrated };
}
