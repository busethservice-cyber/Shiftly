"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { EmployeeRequest } from "@/app/lib/types";

type RequestsContextValue = {
  requests: EmployeeRequest[];
  setRequests: React.Dispatch<React.SetStateAction<EmployeeRequest[]>>;
};

const RequestsContext = createContext<RequestsContextValue | null>(null);

export function RequestsProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const value = useMemo(() => ({ requests, setRequests }), [requests]);
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}

export function useRequests() {
  const ctx = useContext(RequestsContext);
  if (!ctx) throw new Error("useRequests must be used within RequestsProvider");
  return ctx;
}

