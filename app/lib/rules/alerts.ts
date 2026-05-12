"use client";

import type { Employee, RetailStore, Shift } from "@/app/lib/types";
import type { ShiftlySettings } from "@/app/lib/settings";
import { dayShort } from "@/app/lib/mockData";
import { formatHours, isShiftOff, round1, shiftDurationHours } from "@/app/lib/hours";
import { getContractStatus, getPlannedHoursForEmployee } from "@/app/lib/rules/contracts";
import { getRequiredStaffForDay } from "@/app/lib/rules/staffing";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertType = "over_contract" | "near_contract" | "understaffed" | "unavailable_conflict";

export type AlertItem = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  employeeId?: string;
  storeId?: string;
  day?: number;
  shiftId?: string;
  resolved: boolean;
};

function makeId(parts: Array<string | number>) {
  return parts.join("|");
}

export function generateAlerts(args: {
  employees: Employee[];
  shifts: Shift[];
  stores: RetailStore[];
  selectedStoreId: string; // "alle" | store.id
  settings: ShiftlySettings;
}): AlertItem[] {
  const { employees, shifts, stores, selectedStoreId, settings } = args;
  const alerts: AlertItem[] = [];

  const allowOver = settings.notifyOverContract;
  const allowNear = settings.notifyNearContract;
  const allowUnderstaffed = settings.notifyUnderstaffing;
  const allowUnavailable = settings.notifyUnavailableConflict;

  const selectedStore =
    selectedStoreId && selectedStoreId !== "alle" ? stores.find((s) => s.id === selectedStoreId) ?? null : null;
  const storesToCheck = selectedStore ? [selectedStore] : stores.filter((s) => Boolean(s.employeeSiteKey));

  // 1) Contract-based alerts (over/near) using planned hours within selected store scope.
  for (const e of employees) {
    const scopedShifts = selectedStore ? shifts.filter((s) => !isShiftOff(s) && s.storeId === selectedStore.id) : shifts;

    const status = getContractStatus(e, scopedShifts, settings);
    if (status === "over" && allowOver) {
      const planned = getPlannedHoursForEmployee(e.id, scopedShifts);
      const over = round1(Math.max(0, planned - e.contractHours));
      if (over <= 0) continue;
      alerts.push({
        id: makeId(["contract", "over", e.id, selectedStoreId ?? "alle"]),
        type: "over_contract",
        severity: "critical",
        title: `${e.name} er over kontrakt`,
        description: `Over kontrakt med ${formatHours(over)} timer`,
        employeeId: e.id,
        resolved: false,
      });
    }

    if (status === "near" && allowNear) {
      const planned = getPlannedHoursForEmployee(e.id, scopedShifts);
      alerts.push({
        id: makeId(["contract", "near", e.id, selectedStoreId ?? "alle"]),
        type: "near_contract",
        severity: "warning",
        title: `${e.name} nærmer seg kontraktgrensen`,
        description: `Planlagt ${formatHours(planned)} av ${formatHours(e.contractHours)} timer`,
        employeeId: e.id,
        resolved: false,
      });
    }
  }

  // 2) Unavailable assignment conflicts
  if (allowUnavailable) {
    const employeeById = new Map(employees.map((e) => [e.id, e] as const));
    for (const s of shifts) {
      if (!s.startTime || !s.endTime) continue;
      if (shiftDurationHours(s) <= 0) continue;

      if (selectedStore && s.storeId !== selectedStore.id) continue;
      const e = employeeById.get(s.employeeId);
      if (!e) continue;
      if (e.unavailableDays.includes(s.day)) {
        alerts.push({
          id: makeId(["unavailable", s.id]),
          type: "unavailable_conflict",
          severity: "critical",
          title: `${e.name} er utilgjengelig`,
          description: "Har vakt på utilgjengelig dag",
          employeeId: e.id,
          day: s.day,
          shiftId: s.id,
          resolved: false,
        });
      }
    }
  }

  // 3) Understaffed days per store/day
  if (allowUnderstaffed) {
    for (const store of storesToCheck) {
      for (let day = 0; day < 7; day++) {
        const d = store.days.find((x) => x.dayIndex === day);
        if (!d || !d.open) continue;

        const required = getRequiredStaffForDay(store, day, settings);
        if (required <= 0) continue;

        const planned = shifts.filter((s) => s.day === day && s.storeId === store.id && shiftDurationHours(s) > 0).length;
        if (planned < required) {
          alerts.push({
            id: makeId(["understaffed", store.id, day, selectedStoreId ?? "alle"]),
            type: "understaffed",
            severity: "warning",
            title: `${dayShort[day] ?? "Dag"} mangler bemanning`,
            description: `Planlagt ${planned} av ${required} nødvendige vakter`,
            storeId: store.id,
            day,
            resolved: false,
          });
        }
      }
    }
  }

  return alerts;
}

