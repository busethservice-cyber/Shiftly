"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Employee, Shift } from "@/app/lib/types";
import { initialEmployees, initialShifts } from "@/app/lib/mockData";
import { createEmployee, deleteEmployee, deleteShiftsById, getEmployees, getShifts, updateEmployee, upsertShifts } from "@/app/lib/api";
import { useStores } from "@/app/components/StoresProvider";
import { normalizeShiftStoreFields } from "@/app/lib/rules/shifts";

type WorkforceContextValue = {
  employees: Employee[];
  employeesLoading: boolean;
  updateEmployee: (updated: Employee) => void;
  createEmployee: (next: Employee) => void;
  deleteEmployee: (employeeId: string) => void;
  // Keep setEmployees for non-critical local UI cases, but prefer mutations above.
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  shiftsLoading: boolean;
};

const WorkforceContext = createContext<WorkforceContextValue | null>(null);

export function WorkforceProvider({ children }: { children: ReactNode }) {
  const { stores, storesLoading } = useStores();
  const [employees, setEmployees] = useState<Employee[]>(() => initialEmployees);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>(() => initialShifts);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  // (reserved) shiftsRef if we later add debounced sync/retries

  useEffect(() => {
    let alive = true;

    async function load() {
      setEmployeesLoading(true);
      try {
        const data = await getEmployees();
        if (!alive) return;
        setEmployees(data);
      } catch (err) {
        // Keep app safe: fall back to mock data on any error.
        console.error("Failed to load employees, falling back to mock data.", err);
        if (!alive) return;
        setEmployees(initialEmployees);
      } finally {
        if (!alive) return;
        setEmployeesLoading(false);
      }
    }

    load();
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
        setShifts(initialShifts);
      } finally {
        if (!alive) return;
        setShiftsLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const setShiftsWithSync: React.Dispatch<React.SetStateAction<Shift[]>> = (updater) => {
    setShifts((prev) => {
      const next = typeof updater === "function" ? (updater as (p: Shift[]) => Shift[])(prev) : updater;

      // Optimistic UI: state is updated immediately, persistence runs in background.
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
            // Compare persisted fields only
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

  const updateEmployeeWithSync = (updated: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    queueMicrotask(() => {
      void updateEmployee(updated).catch((err) => {
        console.error("Failed to persist employee update.", err);
      });
    });
  };

  const createEmployeeWithSync = (next: Employee) => {
    setEmployees((prev) => (prev.some((e) => e.id === next.id) ? prev : [...prev, next]));
    queueMicrotask(() => {
      void createEmployee(next).catch((err) => {
        console.error("Failed to persist employee create.", err);
      });
    });
  };

  const deleteEmployeeWithSync = (employeeId: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== employeeId));
    setShiftsWithSync((prev) => prev.filter((s) => s.employeeId !== employeeId));
    queueMicrotask(() => {
      void deleteEmployee(employeeId).catch((err) => {
        console.error("Failed to persist employee delete.", err);
      });
    });
  };

  const value = useMemo(
    () => ({
      employees,
      setEmployees,
      employeesLoading,
      updateEmployee: updateEmployeeWithSync,
      createEmployee: createEmployeeWithSync,
      deleteEmployee: deleteEmployeeWithSync,
      shifts,
      setShifts: setShiftsWithSync,
      shiftsLoading,
    }),
    [employees, employeesLoading, shifts, shiftsLoading],
  );

  return <WorkforceContext.Provider value={value}>{children}</WorkforceContext.Provider>;
}

export function useWorkforce() {
  const ctx = useContext(WorkforceContext);
  if (!ctx) throw new Error("useWorkforce must be used within WorkforceProvider");
  return ctx;
}
