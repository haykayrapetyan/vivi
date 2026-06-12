"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Cross-panel UI bus for the vacancy workspace: the chat (left) can ask the
// panel (right, or the sheet on mobile) to open a specific candidate.

type Selection = { candidateId: string; nonce: number } | null;

type VacancyUi = {
  selection: Selection;
  /** Opens the candidate in the panel (Candidates tab / mobile sheet). */
  selectCandidate: (candidateId: string) => void;
};

const Ctx = createContext<VacancyUi | null>(null);

export function VacancyUiProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<Selection>(null);
  const selectCandidate = useCallback((candidateId: string) => {
    // nonce makes repeat clicks on the same candidate re-trigger effects
    setSelection({ candidateId, nonce: Date.now() });
  }, []);
  const value = useMemo(
    () => ({ selection, selectCandidate }),
    [selection, selectCandidate],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Null outside the vacancy workspace — consumers must tolerate that. */
export function useVacancyUi() {
  return useContext(Ctx);
}
