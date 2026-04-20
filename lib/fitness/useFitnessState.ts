"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createDefaultFitnessState,
  ensureFitnessDayLog,
  getLocalDateKey,
  persistFitnessState,
  readFitnessState,
  subscribeToFitnessState,
  type FitnessState,
} from "@/lib/fitness/storage";

export function useFitnessState() {
  const [fitnessState, setFitnessState] = useState<FitnessState>(createDefaultFitnessState);
  const [hasHydrated, setHasHydrated] = useState(false);

  const hydrateFitnessState = useCallback(() => {
    const nextState = readFitnessState();
    persistFitnessState(nextState);
    setFitnessState(nextState);
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(hydrateFitnessState, 0);
    const unsubscribe = subscribeToFitnessState(() => {
      setFitnessState(readFitnessState());
      setHasHydrated(true);
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [hydrateFitnessState]);

  const updateFitnessState = useCallback(
    (updater: (currentState: FitnessState, resolvedTodayKey: string) => FitnessState) => {
      const resolvedTodayKey = getLocalDateKey();

      setFitnessState((currentState) => {
        const baseState = hasHydrated ? currentState : readFitnessState();
        const normalizedState = ensureFitnessDayLog(baseState, resolvedTodayKey);
        const nextState = updater(normalizedState, resolvedTodayKey);
        persistFitnessState(nextState);
        return nextState;
      });

      setHasHydrated(true);
    },
    [hasHydrated],
  );

  return {
    fitnessState,
    hasHydrated,
    updateFitnessState,
  };
}
