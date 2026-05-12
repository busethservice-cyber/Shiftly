import type { Employee, RecurringUnavailablePeriod, RetailStore, Shift, UnavailablePeriod } from "@/app/lib/types";
import type { ShiftlySettings } from "@/app/lib/settings";
import { addDays, baseWeekStart } from "@/app/lib/mockData";
import { isShiftOff, parseTimeToMinutes } from "@/app/lib/hours";
import { getPlannedHoursForEmployee } from "@/app/lib/rules/contracts";

/** ISO date (YYYY-MM-DD) for a shift’s calendar day in the app week model. */
export function isoDateForShiftWeekDay(week: number, day: number): string {
  const d = addDays(baseWeekStart, week * 7 + day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const SHIFT_UNAVAILABLE_REASON = "Ansatt er utilgjengelig i dette tidsrommet";

function periodCoversIso(p: UnavailablePeriod, iso: string): boolean {
  return p.startDate <= iso && iso <= p.endDate;
}

function periodHasTimeWindow(p: UnavailablePeriod): boolean {
  return Boolean(p.startTime?.trim() && p.endTime?.trim());
}

function recurringCoversDay(p: RecurringUnavailablePeriod, iso: string, weekday: number): boolean {
  if (p.weekday !== weekday) return false;
  const from = String(p.validFrom ?? "").trim();
  const to = String(p.validTo ?? "").trim();
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

function recurringHasTimeWindow(p: RecurringUnavailablePeriod): boolean {
  return Boolean(p.startTime?.trim() && p.endTime?.trim());
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aS = parseTimeToMinutes(aStart);
  const aE = parseTimeToMinutes(aEnd);
  const bS = parseTimeToMinutes(bStart);
  const bE = parseTimeToMinutes(bEnd);
  if (aE <= aS || bE <= bS) return false;
  return aS < bE && bS < aE;
}

/** Recurring weekday off, or a date-range period with no time window (whole days). */
export function employeeUnavailableWholeCalendarDay(employee: Employee, week: number, day: number): boolean {
  if (employee.unavailableDays?.includes(day)) return true;
  const iso = isoDateForShiftWeekDay(week, day);
  for (const p of employee.unavailablePeriods ?? []) {
    if (!periodCoversIso(p, iso)) continue;
    if (!periodHasTimeWindow(p)) return true;
  }
  for (const rp of employee.recurringUnavailablePeriods ?? []) {
    if (!recurringCoversDay(rp, iso, day)) continue;
    if (!recurringHasTimeWindow(rp)) return true;
  }
  return false;
}

export type EmployeeDayUnavailableDisplay = {
  /** Blocks drag / empty-cell suggest (whole day off). */
  blocksWholeDay: boolean;
  /** Show grey “Ikke tilgjengelig” chip for this calendar day. */
  showUnavailableChip: boolean;
  /** Optional details to show under the chip (time windows / reason). */
  details: string[];
};

/** Planlegg grid: when to show unavailable chip and when the cell is fully blocked. */
export function getEmployeeDayUnavailableDisplay(employee: Employee, week: number, day: number): EmployeeDayUnavailableDisplay {
  const iso = isoDateForShiftWeekDay(week, day);
  const blocksWholeDay = employeeUnavailableWholeCalendarDay(employee, week, day);
  const details: string[] = [];

  const periodsOnDay = (employee.unavailablePeriods ?? []).filter((p) => periodCoversIso(p, iso));
  for (const p of periodsOnDay) {
    const reason = String(p.reason ?? "").trim();
    if (periodHasTimeWindow(p)) {
      const t = `${p.startTime}–${p.endTime}`;
      details.push(reason ? `${t} · ${reason}` : t);
    } else if (reason) {
      details.push(reason);
    }
  }

  const recurringOnDay = (employee.recurringUnavailablePeriods ?? []).filter((p) => recurringCoversDay(p, iso, day));
  for (const p of recurringOnDay) {
    const reason = String(p.reason ?? "").trim();
    if (recurringHasTimeWindow(p)) {
      const t = `${p.startTime}–${p.endTime}`;
      details.push(reason ? `${t} · ${reason}` : t);
    } else if (reason) {
      details.push(reason);
    }
  }

  const showUnavailableChip = blocksWholeDay || periodsOnDay.length > 0 || recurringOnDay.length > 0;
  const uniq = [...new Set(details.filter(Boolean))];
  return { blocksWholeDay, showUnavailableChip, details: uniq };
}

/** Blocks working shifts: weekday off, whole-day period, or timed period overlapping the shift. */
export function employeeUnavailabilityBlocksShift(
  employee: Employee,
  shift: Pick<Shift, "week" | "day" | "startTime" | "endTime" | "store">,
): boolean {
  if (shift.store === "Fri") return false;
  if (!shift.startTime?.trim() || !shift.endTime?.trim()) return false;
  if (employee.unavailableDays?.includes(shift.day)) return true;
  const iso = isoDateForShiftWeekDay(shift.week, shift.day);
  for (const p of employee.unavailablePeriods ?? []) {
    if (!periodCoversIso(p, iso)) continue;
    if (!periodHasTimeWindow(p)) return true;
    if (overlaps(shift.startTime, shift.endTime, p.startTime!, p.endTime!)) return true;
  }
  for (const rp of employee.recurringUnavailablePeriods ?? []) {
    if (!recurringCoversDay(rp, iso, shift.day)) continue;
    if (!recurringHasTimeWindow(rp)) return true;
    if (overlaps(shift.startTime, shift.endTime, rp.startTime!, rp.endTime!)) return true;
  }
  return false;
}

export function hasOverlappingShift(args: {
  employeeId: string;
  week: number;
  day: number;
  startTime: string;
  endTime: string;
  shifts: Shift[];
  excludeShiftId?: string;
}): boolean {
  const { employeeId, week, day, startTime, endTime, shifts, excludeShiftId } = args;
  if (!startTime || !endTime) return false;
  return shifts.some((s) => {
    if (excludeShiftId && s.id === excludeShiftId) return false;
    if (s.employeeId !== employeeId) return false;
    if (s.week !== week) return false;
    if (s.day !== day) return false;
    if (isShiftOff(s)) return false;
    if (!s.startTime || !s.endTime) return false;
    return overlaps(startTime, endTime, s.startTime, s.endTime);
  });
}

/** Resolve store UUID from shift.store (site key) when storeId is missing. */
export function resolveShiftStoreId(
  shift: Pick<Shift, "store" | "storeId">,
  stores: RetailStore[],
  preferredStoreId?: string | null,
): string | undefined {
  if (shift.store === "Fri") return undefined;
  if (shift.storeId && stores.some((s) => s.id === shift.storeId)) return shift.storeId;
  const matches = stores.filter((s) => s.employeeSiteKey === shift.store);
  if (matches.length === 0) return preferredStoreId ?? undefined;
  if (preferredStoreId && matches.some((m) => m.id === preferredStoreId)) return preferredStoreId;
  return matches[0]?.id;
}

/** Fill storeId / store site key consistently before validation or persistence. */
export function normalizeShiftStoreFields(shift: Shift, stores: RetailStore[], preferredStoreId?: string | null): Shift {
  if (shift.store === "Fri") {
    return { ...shift, storeId: undefined, store: "Fri", startTime: "", endTime: "" };
  }
  const storeId = shift.storeId ?? resolveShiftStoreId(shift, stores, preferredStoreId) ?? undefined;
  const siteKey =
    (storeId ? stores.find((s) => s.id === storeId)?.employeeSiteKey : null) ?? shift.store;
  return { ...shift, storeId, store: siteKey };
}

export function canAssignShift(args: {
  employee: Employee;
  shift: Pick<Shift, "id" | "week" | "day" | "startTime" | "endTime" | "storeId" | "store">;
  shifts: Shift[]; // all shifts for the week (across stores)
  settings: ShiftlySettings;
  stores: RetailStore[];
}): { ok: true } | { ok: false; reason: string } {
  const { employee, shift, shifts, settings, stores } = args;

  if (shift.store === "Fri" || (!shift.startTime && !shift.endTime)) return { ok: true };

  if (!shift.startTime || !shift.endTime) return { ok: false, reason: "Slutt må være etter start" };
  if (parseTimeToMinutes(shift.endTime) <= parseTimeToMinutes(shift.startTime))
    return { ok: false, reason: "Slutt må være etter start" };

  if (employeeUnavailabilityBlocksShift(employee, shift)) {
    return { ok: false, reason: SHIFT_UNAVAILABLE_REASON };
  }

  if (!shift.storeId || !stores.some((st) => st.id === shift.storeId)) {
    return { ok: false, reason: "Velg butikk" };
  }

  // Overlap check is ALWAYS global across stores.
  if (
    hasOverlappingShift({
      employeeId: employee.id,
      week: shift.week,
      day: shift.day,
      startTime: shift.startTime,
      endTime: shift.endTime,
      shifts,
      excludeShiftId: shift.id,
    })
  ) {
    return { ok: false, reason: "Ansatt har allerede vakt på dette tidspunktet" };
  }

  if (!settings.allowMultiStoreWork) {
    const assigned = new Set<string>([
      ...(Array.isArray(employee.storeIds) ? employee.storeIds : []),
      ...(employee.primaryStoreId ? [employee.primaryStoreId] : []),
    ]);
    if (assigned.size > 0) {
      if (!assigned.has(shift.storeId)) {
        return { ok: false, reason: "Ansatt er ikke tilknyttet denne butikken" };
      }
    } else {
      return { ok: false, reason: "Ansatt mangler butikktilknytning" };
    }
  }

  // Contract hours are global across all stores — exclude current shift so edits don't double-count.
  const shiftsExcludingSelf = shifts.filter((s) => s.id !== shift.id);
  const planned = getPlannedHoursForEmployee(employee.id, shiftsExcludingSelf);
  const remaining = Math.max(0, Number(employee.contractHours ?? 0) - planned);
  const durationH = (parseTimeToMinutes(shift.endTime) - parseTimeToMinutes(shift.startTime)) / 60;
  if (employee.contractHours > 0 && remaining + 1e-6 < durationH) {
    return { ok: false, reason: "Ansatt har ikke nok timer igjen på kontrakten" };
  }

  return { ok: true };
}

