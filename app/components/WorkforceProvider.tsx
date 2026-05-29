"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Employee, Shift } from "@/app/lib/types";
import { initialEmployees, initialShifts } from "@/app/lib/mockData";
import { createEmployee, deleteEmployee, deleteShiftsById, getEmployees, getShifts, updateEmployee, upsertShifts } from "@/app/lib/api";
import { useStores } from "@/app/components/StoresProvider";
import { normalizeShiftStoreFields } from "@/app/lib/rules/shifts";
import { useMockData } from "@/app/lib/runtimeConfig";

type WorkforceContextValue = {
  employees: Employee[];
  employeesLoading: boolean;
  employeesLoadError: string | null;
  updateEmployee: (updated: Employee) => Promise<void>;
  createEmployee: (next: Employee) => Promise<void>;
  deleteEmployee: (employeeId: string) => Promise<void>;
  reloadEmployees: () => Promise<void>;
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  shiftsLoading: boolean;
};

const WorkforceContext = createContext<WorkforceContextValue | null>(null);

export function WorkforceProvider({ children }: { children: ReactNode }) {
  const { stores, storesLoading } = useStores();
  const [employees, setEmployees] = useState<Employee[]>(() => (useMockData ? initialEmployees : []));
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesLoadError, setEmployeesLoadError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>(() => (useMockData ? initialShifts : []));
  const [shiftsLoading, setShiftsLoading] = useState(false);

  const reloadEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    setEmployeesLoadError(null);
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kunne ikke laste ansatte";
      console.error("[Shiftly][employees] reload failed", err);
      setEmployeesLoadError(msg);
      if (useMockData) {
        setEmployees(initialEmployees);
      } else {
        setEmployees([]);
      }
      throw err;
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setEmployeesLoading(true);
      setEmployeesLoadError(null);
      try {
        const data = await getEmployees();
        if (!alive) return;
        setEmployees(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Kunne ikke laste ansatte";
        console.error("[Shiftly][employees] initial load failed", err);
        if (!alive) return;
        setEmployeesLoadError(msg);
        if (useMockData) {
          setEmployees(initialEmployees);
        } else {
          setEmployees([]);
        }
      } finally {
        if (alive) setEmployeesLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setShiftsLoading(true);
      try {
        const data = await getShifts();
        if (!alive) return;
        setShifts(data);
      } catch (err) {
        console.error("Failed to load shifts, falling back to mock data.", err);
        if (!alive) return;
        setShifts(useMockData ? initialShifts : []);
      } finally {
        if (alive) setShiftsLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const setShiftsWithSync: React.Dispatch<React.SetStateAction<Shift[]>> = (updater) => {
    setShifts((prev) => {
      const next = typeof updater === "function" ? (updater as (p: Shift[]) => Shift[])(prev) : updater;

      queueMicrotask(() => {
        try {
          const prevById = new Map(prev.map((s) => [s.id, s] as const));
          const nextById = new Map(next.map((s) => [s.id, s] as const));

          const inserts: Shift[] = [];
          const updates: Shift[] = [];
          const deletes: string[] = [];

          for (const [id, sNext] of nextById) {
            const sPrev = prevById.get(id) ?? null;
            if (!sPrev) {
              inserts.push(sNext);
              continue;
            }
            const changed =
              sPrev.employeeId !== sNext.employeeId ||
              sPrev.storeId !== sNext.storeId ||
              sPrev.store !== sNext.store ||
              sPrev.week !== sNext.week ||
              sPrev.day !== sNext.day ||
              sPrev.startTime !== sNext.startTime ||
              sPrev.endTime !== sNext.endTime ||
              (sPrev.publishState ?? "draft") !== (sNext.publishState ?? "draft");
            if (changed) updates.push(sNext);
          }

          for (const [id] of prevById) {
            if (!nextById.has(id)) deletes.push(id);
          }

          if (inserts.length || updates.length) {
            void upsertShifts([...inserts, ...updates]).catch((err) => {
              console.error("Failed to persist shifts (upsert).", err);
            });
          }
          if (deletes.length) {
            void deleteShiftsById(deletes).catch((err) => {
              console.error("Failed to persist shifts (delete).", err);
            });
          }
        } catch (err) {
          console.error("Failed to compute/persist shift changes.", err);
        }
      });

      return next;
    });
  };

  useEffect(() => {
    if (shiftsLoading || storesLoading) return;
    setShiftsWithSync((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        const m = normalizeShiftStoreFields(s, stores, null);
        if (m.storeId !== s.storeId || m.store !== s.store) changed = true;
        return m;
      });
      return changed ? next : prev;
    });
  }, [shiftsLoading, storesLoading, stores]);

  const updateEmployeeWithSync = async (updated: Employee) => {
    const prevSnapshot = employees;
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    try {
      await updateEmployee(updated);
      await reloadEmployees();
    } catch (err) {
      setEmployees(prevSnapshot);
      throw err;
    }
  };

  const createEmployeeWithSync = async (next: Employee) => {
    setEmployees((prev) => (prev.some((e) => e.id === next.id) ? prev : [...prev, next]));
    try {
      await createEmployee(next);
      await reloadEmployees();
    } catch (err) {
      setEmployees((prev) => prev.filter((e) => e.id !== next.id));
      throw err;
    }
  };

  const deleteEmployeeWithSync = async (employeeId: string) => {
    const prevEmployees = employees;
    setEmployees((prev) => prev.filter((e) => e.id !== employeeId));
    setShiftsWithSync((prev) => prev.filter((s) => s.employeeId !== employeeId));
    try {
      await deleteEmployee(employeeId);
      await reloadEmployees();
    } catch (err) {
      setEmployees(prevEmployees);
      throw err;
    }
  };

  const value = useMemo(
    () => ({
      employees,
      setEmployees,
      employeesLoading,
      employeesLoadError,
      updateEmployee: updateEmployeeWithSync,
      createEmployee: createEmployeeWithSync,
      deleteEmployee: deleteEmployeeWithSync,
      reloadEmployees,
      shifts,
      setShifts: setShiftsWithSync,
      shiftsLoading,
    }),
    [employees, employeesLoadError, employeesLoading, reloadEmployees, shifts, shiftsLoading],
  );

  return <WorkforceContext.Provider value={value}>{children}</WorkforceContext.Provider>;
}

export function useWorkforce() {
  const ctx = useContext(WorkforceContext);
  if (!ctx) throw new Error("useWorkforce must be used within WorkforceProvider");
  return ctx;
}
