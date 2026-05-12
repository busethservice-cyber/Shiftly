"use client";

import type { Employee, Shift } from "@/app/lib/types";
import type { ShiftlySettings } from "@/app/lib/settings";
import { shiftDurationHours } from "@/app/lib/hours";

export type ContractStatus = "within" | "near" | "over";

export function calculateContractHours(positionPercent: number, fullTimeHours: number) {
  const pct = Number(positionPercent);
  const full = Number(fullTimeHours);
  if (!Number.isFinite(pct) || !Number.isFinite(full)) return 0;
  return Math.max(0, (pct / 100) * full);
}

export function getPlannedHoursForEmployee(employeeId: string, shifts: Shift[]) {
  return shifts
    .filter((s) => s.employeeId === employeeId)
    .reduce((acc, s) => acc + shiftDurationHours({ startTime: s.startTime, endTime: s.endTime, store: s.store }), 0);
}

export function getContractStatus(employee: Pick<Employee, "id" | "contractHours">, shifts: Shift[], settings: ShiftlySettings): ContractStatus {
  const contract = Math.max(0, Number(employee.contractHours ?? 0));
  if (contract <= 0) return "within";

  const planned = getPlannedHoursForEmployee(employee.id, shifts);
  if (planned > contract) return "over";

  const nearThreshold = Math.max(0, Math.min(1, Number(settings.nearContractThreshold ?? 0.9)));
  if (planned >= contract * nearThreshold) return "near";
  return "within";
}

