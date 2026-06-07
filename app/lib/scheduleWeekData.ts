"use client";

import type { Employee, RetailStore, Shift } from "@/app/lib/types";
import { addDays, dayShort, formatNorDate } from "@/app/lib/mockData";
import { formatWeekLabel, getWeekStart } from "@/app/lib/dateUtils";
import { isShiftOff, round1, shiftDurationHours } from "@/app/lib/hours";
import { getPlannedHoursForEmployee } from "@/app/lib/rules/contracts";
import {
  getEmployeeDayUnavailableDisplay,
  normalizeShiftStoreFields,
} from "@/app/lib/rules/shifts";
import { weekStartDateFromOffset } from "@/app/lib/weekDate";

export type ScheduleWeekDay = {
  dayIndex: number;
  short: string;
  date: string;
  /** e.g. Man 15 */
  label: string;
  dateObj: Date;
};

export type ScheduleWeekData = {
  weekOffset: number;
  weekLabel: string;
  weekStartDate: Date;
  selectedStoreId: string;
  selectedStore: RetailStore | null;
  storeName: string;
  employees: Employee[];
  /** Shifts visible for the selected store/week (excludes off-shifts). */
  shifts: Shift[];
  /** All shifts in the week across stores (for contract status). */
  weekShiftsAll: Shift[];
  totalPlannedHours: number;
  days: ScheduleWeekDay[];
  plannedHoursByEmployee: Map<string, number>;
};

function employeeInStoreScope(employee: Employee, storeId: string | null): boolean {
  if (!storeId) return true;
  const ids = employee.storeIds ?? [];
  return ids.includes(storeId) || employee.primaryStoreId === storeId;
}

function shiftInStoreScope(shift: Shift, store: RetailStore | null, stores: RetailStore[]): boolean {
  if (isShiftOff(shift)) return false;
  if (!store) return true;
  const normalized = normalizeShiftStoreFields(shift, stores, store.id);
  return normalized.storeId === store.id;
}

export function getScheduleWeekData(args: {
  employees: Employee[];
  shifts: Shift[];
  stores: RetailStore[];
  weekOffset: number;
  selectedStoreId: string;
}): ScheduleWeekData {
  const { employees, shifts, stores, weekOffset, selectedStoreId } = args;

  const selectedStore =
    selectedStoreId === "alle" ? null : stores.find((s) => s.id === selectedStoreId) ?? null;
  const storeName = selectedStore?.name ?? (selectedStoreId === "alle" ? "Alle butikker" : "Butikk");

  const weekStartDate = getWeekStart(weekStartDateFromOffset(weekOffset));
  const weekLabel = formatWeekLabel(weekStartDate);

  const weekShiftsAll = shifts.filter((s) => s.week === weekOffset);
  const scopedShifts = selectedStore
    ? weekShiftsAll.filter((s) => shiftInStoreScope(s, selectedStore, stores))
    : weekShiftsAll;
  const scopedEmployees = employees.filter((e) => employeeInStoreScope(e, selectedStore?.id ?? null));

  const days: ScheduleWeekDay[] = dayShort.map((short, idx) => {
    const d = addDays(weekStartDate, idx);
    return {
      dayIndex: idx,
      short,
      date: formatNorDate(d),
      label: `${short} ${d.getDate()}`,
      dateObj: d,
    };
  });

  const totalPlannedHours = round1(scopedShifts.reduce((acc, s) => acc + shiftDurationHours(s), 0));

  const plannedHoursByEmployee = new Map<string, number>();
  for (const e of scopedEmployees) {
    plannedHoursByEmployee.set(e.id, round1(getPlannedHoursForEmployee(e.id, scopedShifts)));
  }

  return {
    weekOffset,
    weekLabel,
    weekStartDate,
    selectedStoreId,
    selectedStore,
    storeName,
    employees: scopedEmployees,
    shifts: scopedShifts,
    weekShiftsAll,
    totalPlannedHours,
    days,
    plannedHoursByEmployee,
  };
}

function exportClockToken(t: string): string {
  const [hRaw, mRaw] = t.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t.trim();
  if (m === 0) return String(h).padStart(2, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function exportTimeRange(start: string, end: string): string {
  return `${exportClockToken(start)}–${exportClockToken(end)}`;
}

function formatAbsenceLines(employee: Employee, weekOffset: number, dayIndex: number): string[] {
  const u = getEmployeeDayUnavailableDisplay(employee, weekOffset, dayIndex);
  if (!u.showUnavailableChip) return [];

  const lines: string[] = [];
  for (const entry of u.entries) {
    const reason = (entry.reason || "Utilgjengelig").trim();
    if (entry.wholeDay || u.blocksWholeDay) {
      if (reason === "Fri") lines.push("Fri hele dagen");
      else lines.push(reason);
      continue;
    }
    if (entry.startTime && entry.endTime) {
      const range = exportTimeRange(entry.startTime, entry.endTime);
      lines.push(`${reason} ${range}`);
    } else {
      lines.push(reason);
    }
  }

  if (lines.length === 0 && u.blocksWholeDay) {
    const reason = (u.primaryReason || "Utilgjengelig").trim();
    lines.push(reason === "Fri" ? "Fri hele dagen" : reason);
  }

  return [...new Set(lines.filter(Boolean))];
}

/** Cell text for export/print — matches Planlegg absence visibility. */
export function formatScheduleDayCell(
  employee: Employee,
  dayIndex: number,
  dayShifts: Shift[],
  weekOffset: number,
): string {
  const working = dayShifts
    .filter((s) => shiftDurationHours(s) > 0)
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

  const shiftLines = working.map((s) => `${exportClockToken(s.startTime)}–${exportClockToken(s.endTime)}`);
  const absenceLines = formatAbsenceLines(employee, weekOffset, dayIndex);

  if (shiftLines.length === 0) {
    const off = dayShifts.some((s) => isShiftOff(s));
    if (off) return "Fri";
    return absenceLines.join("\n");
  }

  if (absenceLines.length === 0) return shiftLines.join("\n");
  return [...shiftLines, ...absenceLines].join("\n");
}

export function employeeNameColumnWidthPx(employeeNames: string[]): number {
  const longest = employeeNames.reduce((max, name) => Math.max(max, name.length), "Ansatt".length);
  return Math.min(480, Math.max(140, longest * 9 + 32));
}
