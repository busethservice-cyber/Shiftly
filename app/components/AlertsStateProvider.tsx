"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AlertsStateContextValue = {
  resolvedIds: Set<string>;
  isResolved: (id: string) => boolean;
  markResolved: (id: string) => void;
  markUnresolved: (id: string) => void;
  toggleResolved: (id: string) => void;
  clearResolved: () => void;
};

const AlertsStateContext = createContext<AlertsStateContextValue | null>(null);

const LS_KEY = "shiftly:resolvedAlertIds";

function loadResolvedIds(): Set<string> {
  try {
    if (typeof window === "undefined") return new Set();
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function AlertsStateProvider({ children }: { children: ReactNode }) {
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => loadResolvedIds());

  const isResolved = useCallback((id: string) => resolvedIds.has(id), [resolvedIds]);

  const markResolved = useCallback((id: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markUnresolved = useCallback((id: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleResolved = useCallback((id: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearResolved = useCallback(() => setResolvedIds(new Set()), []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(Array.from(resolvedIds)));
    } catch {
      // ignore
    }
  }, [resolvedIds]);

  const value = useMemo(
    () => ({ resolvedIds, isResolved, markResolved, markUnresolved, toggleResolved, clearResolved }),
    [resolvedIds, isResolved, markResolved, markUnresolved, toggleResolved, clearResolved],
  );

  return <AlertsStateContext.Provider value={value}>{children}</AlertsStateContext.Provider>;
}

export function useAlertsState() {
  const ctx = useContext(AlertsStateContext);
  if (!ctx) throw new Error("useAlertsState must be used within AlertsStateProvider");
  return ctx;
}

