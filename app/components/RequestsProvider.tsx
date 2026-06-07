"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { EmployeeRequest } from "@/app/lib/types";
import { createRequest, getRequests, updateRequestStatus } from "@/app/lib/api";
import { buildApprovedSideEffects } from "@/app/lib/requestHelpers";
import { useWorkforce } from "@/app/components/WorkforceProvider";

type RequestsContextValue = {
  requests: EmployeeRequest[];
  requestsLoading: boolean;
  pendingCount: number;
  isMutating: boolean;
  reloadRequests: () => Promise<void>;
  submitRequest: (args: Omit<EmployeeRequest, "id" | "status">) => Promise<EmployeeRequest>;
  approveRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
};

const RequestsContext = createContext<RequestsContextValue | null>(null);

export function RequestsProvider({ children }: { children: ReactNode }) {
  const { employees, shifts, updateEmployee, setShifts } = useWorkforce();
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const reloadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const data = await getRequests();
      setRequests(data);
    } catch (err) {
      console.error("[Shiftly][requests] load failed", err);
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadRequests();
  }, [reloadRequests]);

  const submitRequest = useCallback(async (args: Omit<EmployeeRequest, "id" | "status">) => {
    const saved = await createRequest(args);
    setRequests((prev) => [saved, ...prev]);
    return saved;
  }, []);

  const approveRequest = useCallback(
    async (id: string) => {
      const req = requests.find((r) => r.id === id) ?? null;
      if (!req || req.status !== "pending") return;

      setIsMutating(true);
      const prevRequests = requests;
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));

      try {
        await updateRequestStatus(id, "approved");

        if (req.type === "bytt_vakt") return;

        const employee = employees.find((e) => e.id === req.employeeId) ?? null;
        if (!employee) return;

        const { updatedEmployee, remainingShifts } = buildApprovedSideEffects(req, employee, shifts);
        if (updatedEmployee) {
          await updateEmployee(updatedEmployee);
        }
        if (remainingShifts.length !== shifts.length) {
          setShifts(remainingShifts);
        }
      } catch (err) {
        console.error("[Shiftly][requests] approve failed", err);
        setRequests(prevRequests);
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [employees, requests, shifts, setShifts, updateEmployee],
  );

  const rejectRequest = useCallback(
    async (id: string) => {
      const req = requests.find((r) => r.id === id) ?? null;
      if (!req || req.status !== "pending") return;

      setIsMutating(true);
      const prevRequests = requests;
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));

      try {
        await updateRequestStatus(id, "rejected");
      } catch (err) {
        console.error("[Shiftly][requests] reject failed", err);
        setRequests(prevRequests);
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [requests],
  );

  const pendingCount = useMemo(() => requests.filter((r) => r.status === "pending").length, [requests]);

  const value = useMemo(
    () => ({
      requests,
      requestsLoading,
      pendingCount,
      isMutating,
      reloadRequests,
      submitRequest,
      approveRequest,
      rejectRequest,
    }),
    [requests, requestsLoading, pendingCount, isMutating, reloadRequests, submitRequest, approveRequest, rejectRequest],
  );

  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}

export function useRequests() {
  const ctx = useContext(RequestsContext);
  if (!ctx) throw new Error("useRequests must be used within RequestsProvider");
  return ctx;
}
