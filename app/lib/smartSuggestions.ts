import type { AlertItem } from "@/app/lib/rules/alerts";
import type { ShiftlySettings } from "@/app/lib/settings";
import type { Employee, RetailStore, Shift } from "@/app/lib/types";
import { getContractStatus, getPlannedHoursForEmployee } from "@/app/lib/rules/contracts";
import { canAssignShift } from "@/app/lib/rules/shifts";

export type SuggestionCandidate = {
  employeeId: string;
  name: string;
  score: number;
  reasons: string[];
};

export type ShiftSuggestionsResult = {
  day: number;
  candidates: SuggestionCandidate[];
};

export function createShiftSuggestions(args: {
  employees: Employee[];
  shifts: Shift[]; // current week shifts
  alerts: AlertItem[]; // active (unresolved) alerts
  selectedStoreId?: string; // "alle" or store.id
  stores: RetailStore[];
  settings: ShiftlySettings;
  /** Week offset aligned with Planlegg `weekOffset` (same as shift.week). */
  week: number;
  day: number;
  startTime?: string; // shift to fill; defaults to 10:00
  endTime?: string; // defaults to 17:00
  limit?: number; // default 5
}): ShiftSuggestionsResult {
  const {
    employees,
    shifts,
    alerts,
    selectedStoreId,
    stores,
    settings,
    week,
    day,
    startTime = "10:00",
    endTime = "17:00",
    limit = 5,
  } = args;

  const selectedStore = selectedStoreId && selectedStoreId !== "alle" ? stores.find((s) => s.id === selectedStoreId) ?? null : null;

  const overSet = new Set(alerts.filter((a) => a.type === "over_contract" && a.employeeId).map((a) => a.employeeId!));
  const nearSet = new Set(alerts.filter((a) => a.type === "near_contract" && a.employeeId).map((a) => a.employeeId!));

  const candidates: SuggestionCandidate[] = [];

  for (const e of employees) {
    const reasons: string[] = [];

    if (!selectedStore) continue;

    const probe: Pick<Shift, "id" | "week" | "day" | "startTime" | "endTime" | "storeId" | "store"> = {
      id: "__suggestion__",
      week,
      day,
      startTime,
      endTime,
      storeId: selectedStore.id,
      store: selectedStore.employeeSiteKey ?? "",
    };

    const assignCheck = canAssignShift({ employee: e, shift: probe, shifts, settings, stores });
    if (!assignCheck.ok) continue;

    const plannedHours = getPlannedHoursForEmployee(e.id, shifts);
    const remaining = e.contractHours - plannedHours;

    const contractStatus = getContractStatus(e, shifts, settings);
    if (contractStatus === "over" || overSet.has(e.id) || remaining < 0) continue;

    let score = remaining;

    if (contractStatus === "near" || nearSet.has(e.id)) {
      score -= 8;
      reasons.push("Nær grense");
    } else {
      reasons.push("Innenfor kontrakt");
    }

    if (e.badges.includes("Tilgjengelig")) {
      score += 3;
      reasons.push("Tilgjengelig");
    }

    reasons.push("Lav belastning");

    candidates.push({ employeeId: e.id, name: e.name, score, reasons });
  }

  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return { day, candidates: candidates.slice(0, Math.max(3, limit)) };
}
