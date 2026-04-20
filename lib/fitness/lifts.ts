"use client";

export type LiftType = "bench" | "squat" | "deadlift" | "ohp";

export type LiftEntry = {
  id: string;
  date: string;
  lift: LiftType;
  weight: number;
  reps: number | null;
};

export type LiftSummary = {
  lift: LiftType;
  latestEntry: LiftEntry | null;
  previousEntry: LiftEntry | null;
  heaviestEntry: LiftEntry | null;
  bestSetEntry: LiftEntry | null;
  bestSetEstimatedOneRepMax: number | null;
  bestWorkingSetEntry: LiftEntry | null;
  bestWorkingSetEstimatedOneRepMax: number | null;
  trend: LiftTrend | null;
  isLatestHeaviest: boolean;
  isLatestBestSet: boolean;
  isLatestBestWorkingSet: boolean;
};

export type LiftTrendDirection = "up" | "same" | "down";

export type LiftTrend = {
  direction: LiftTrendDirection;
  delta: number;
};

const LIFT_STORAGE_KEY = "campus-life-os.fitness.lifts.v1";

export const LIFT_TYPES: LiftType[] = ["bench", "squat", "deadlift", "ohp"];

export const LIFT_LABELS: Record<LiftType, string> = {
  bench: "Bench Press",
  squat: "Squat",
  deadlift: "Deadlift",
  ohp: "Overhead Press",
};

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isLiftType(value: unknown): value is LiftType {
  return typeof value === "string" && LIFT_TYPES.includes(value as LiftType);
}

function normalizeWeight(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function normalizeReps(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function normalizeLiftEntry(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = value as Partial<LiftEntry>;
  const weight = normalizeWeight(parsed.weight);

  if (
    typeof parsed.id !== "string" ||
    !parsed.id ||
    !isDateKey(parsed.date) ||
    !isLiftType(parsed.lift) ||
    weight === null
  ) {
    return null;
  }

  return {
    id: parsed.id,
    date: parsed.date,
    lift: parsed.lift,
    weight,
    reps: normalizeReps(parsed.reps),
  } satisfies LiftEntry;
}

function sortLiftEntries(entries: LiftEntry[]) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const dateOrder = (left.entry.date ?? "").localeCompare(right.entry.date ?? "");

      if (dateOrder !== 0) {
        return dateOrder;
      }

      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function createLiftEntryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `lift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readLiftEntries() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LIFT_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortLiftEntries(
      parsed
        .map((entry) => normalizeLiftEntry(entry))
        .filter((entry): entry is LiftEntry => entry !== null),
    );
  } catch {
    return [];
  }
}

export function persistLiftEntries(entries: LiftEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LIFT_STORAGE_KEY, JSON.stringify(sortLiftEntries(entries)));
}

export function appendLiftEntry(
  entries: LiftEntry[],
  entry: Omit<LiftEntry, "id"> & { id?: string },
) {
  return sortLiftEntries([
    ...entries,
    {
      ...entry,
      id: entry.id ?? createLiftEntryId(),
    },
  ]);
}

function getLiftTrend(latestEntry: LiftEntry, previousEntry: LiftEntry | null): LiftTrend | null {
  if (!previousEntry) {
    return null;
  }

  const delta = latestEntry.weight - previousEntry.weight;

  if (delta > 0) {
    return { direction: "up", delta };
  }

  if (delta < 0) {
    return { direction: "down", delta };
  }

  return { direction: "same", delta: 0 };
}

export function estimateLiftOneRepMax(entry: Pick<LiftEntry, "weight" | "reps">) {
  if (entry.reps === null || entry.reps <= 0) {
    return null;
  }

  return entry.weight * (1 + entry.reps / 30);
}

function estimateWorkingSetOneRepMax(entry: LiftEntry) {
  if (entry.reps === null || entry.reps < 5) {
    return null;
  }

  return estimateLiftOneRepMax(entry);
}

function selectTopLiftEntry(
  entries: LiftEntry[],
  getScore: (entry: LiftEntry) => number | null,
) {
  let topEntry: LiftEntry | null = null;
  let topScore: number | null = null;

  for (const entry of entries) {
    const score = getScore(entry);

    if (score === null) {
      continue;
    }

    if (topEntry === null || topScore === null || score >= topScore) {
      topEntry = entry;
      topScore = score;
    }
  }

  return {
    entry: topEntry,
    score: topScore,
  };
}

export function getLiftSummaries(entries: LiftEntry[]): LiftSummary[] {
  const sortedEntries = sortLiftEntries(entries);

  return LIFT_TYPES.map((lift) => {
    const liftEntries = sortedEntries.filter((entry) => entry.lift === lift);

    if (liftEntries.length === 0) {
      return {
        lift,
        latestEntry: null,
        previousEntry: null,
        heaviestEntry: null,
        bestSetEntry: null,
        bestSetEstimatedOneRepMax: null,
        bestWorkingSetEntry: null,
        bestWorkingSetEstimatedOneRepMax: null,
        trend: null,
        isLatestHeaviest: false,
        isLatestBestSet: false,
        isLatestBestWorkingSet: false,
      };
    }

    const latestEntry = liftEntries[liftEntries.length - 1];
    const previousEntry = liftEntries[liftEntries.length - 2] ?? null;
    const { entry: heaviestEntry } = selectTopLiftEntry(liftEntries, (entry) => entry.weight);
    const { entry: bestSetEntry, score: bestSetEstimatedOneRepMax } = selectTopLiftEntry(
      liftEntries,
      estimateLiftOneRepMax,
    );
    const {
      entry: bestWorkingSetEntry,
      score: bestWorkingSetEstimatedOneRepMax,
    } = selectTopLiftEntry(liftEntries, estimateWorkingSetOneRepMax);

    return {
      lift,
      latestEntry,
      previousEntry,
      heaviestEntry,
      bestSetEntry,
      bestSetEstimatedOneRepMax,
      bestWorkingSetEntry,
      bestWorkingSetEstimatedOneRepMax,
      trend: getLiftTrend(latestEntry, previousEntry),
      isLatestHeaviest: heaviestEntry?.id === latestEntry.id,
      isLatestBestSet: bestSetEntry?.id === latestEntry.id,
      isLatestBestWorkingSet: bestWorkingSetEntry?.id === latestEntry.id,
    };
  });
}

export function getLatestLiftEntry(entries: LiftEntry[]) {
  const sortedEntries = sortLiftEntries(entries);
  return sortedEntries[sortedEntries.length - 1] ?? null;
}
