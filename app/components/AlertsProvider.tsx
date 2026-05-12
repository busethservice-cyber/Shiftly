"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AlertItem } from "@/app/lib/rules/alerts";
import { generateAlerts } from "@/app/lib/rules/alerts";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { useStores } from "@/app/components/StoresProvider";
import { useSettings } from "@/app/components/SettingsProvider";
import { currentWeekOffset } from "@/app/lib/weekDate";

type AlertsContextValue = {
  alerts: AlertItem[];
  activeAlerts: AlertItem[];
  alertCount: number;
  alertsHydrated: boolean;
  resolvedAlertIds: Set<string>;
  markAlertResolved: (alertId: string) => void;
  markAllResolved: () => void;
  isResolved: (alertId: string) => boolean;
};

const AlertsContext = createContext<AlertsContextValue | null>(null);

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

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { employees, shifts } = useWorkforce();
  const { stores } = useStores();
  const { settings } = useSettings();

  const [alertsHydrated, setAlertsHydrated] = useState(false);
  const [resolvedAlertIds, setResolvedAlertIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    // Load once on client to avoid SSR/CSR mismatch.
    setResolvedAlertIds(loadResolvedIds());
    setAlertsHydrated(true);
  }, []);

  useEffect(() => {
    if (!alertsHydrated) return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(Array.from(resolvedAlertIds)));
    } catch {
      // ignore
    }
  }, [alertsHydrated, resolvedAlertIds]);

  const isResolved = useCallback((id: string) => resolvedAlertIds.has(id), [resolvedAlertIds]);

  const markAlertResolved = useCallback((id: string) => {
    setResolvedAlertIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const activeAlertsRef = useRef<AlertItem[]>([]);

  const markAllResolved = useCallback(() => {
    setResolvedAlertIds((prev) => {
      const next = new Set(prev);
      for (const a of activeAlertsRef.current) next.add(a.id);
      return next;
    });
  }, []);

  // Compute alerts for the current week and all stores, once, consistently.
  const weekOffset = useMemo(() => currentWeekOffset(), []);
  const weekShifts = useMemo(() => shifts.filter((s) => s.week === weekOffset), [shifts, weekOffset]);

  const alerts = useMemo(
    () => generateAlerts({ employees, shifts: weekShifts, stores, selectedStoreId: "alle", settings }),
    [employees, weekShifts, stores, settings],
  );

  const activeAlerts = useMemo(() => alerts.filter((a) => !isResolved(a.id)), [alerts, isResolved]);

  useEffect(() => {
    activeAlertsRef.current = activeAlerts;
  }, [activeAlerts]);

  const value = useMemo<AlertsContextValue>(
    () => ({
      alerts,
      activeAlerts,
      alertCount: activeAlerts.length,
      alertsHydrated,
      resolvedAlertIds,
      markAlertResolved,
      markAllResolved,
      isResolved,
    }),
    [activeAlerts, alerts, alertsHydrated, isResolved, markAlertResolved, markAllResolved, resolvedAlertIds],
  );

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertsProvider");
  return ctx;
}

