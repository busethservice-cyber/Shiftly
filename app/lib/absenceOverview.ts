import type { Employee, RecurringUnavailablePeriod, UnavailablePeriod, UnavailablePeriodReason } from "@/app/lib/types";
import { addDays, baseWeekStart, dayShort } from "@/app/lib/mockData";
import { isoFromDate, todayLocal } from "@/app/lib/weekDate";

export type AbsenceTypeLabel = "Ferie" | "Syk" | "Skole" | "Annet" | "Fri";

export type UpcomingAbsenceRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: AbsenceTypeLabel;
  /** e.g. "10.–14. jun" or "Hver mandag" */
  whenLabel: string;
  /** Partial-day times, e.g. "09:00–12:00" */
  timeLabel: string | null;
  note: string | null;
  /** 0 = active today or ongoing, 1 = future */
  sortRank: number;
  sortKey: string;
  isActive: boolean;
};

function normalizeReason(raw: string | undefined): AbsenceTypeLabel {
  const r = String(raw ?? "").trim();
  if (r === "Ferie") return "Ferie";
  if (r === "Syk") return "Syk";
  if (r === "Skole") return "Skole";
  if (r === "Fri") return "Fri";
  return "Annet";
}

function isoRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function weekIsoRange(weekOffset: number): { start: string; end: string } {
  const startDate = addDays(baseWeekStart, weekOffset * 7);
  const endDate = addDays(startDate, 6);
  return { start: isoFromDate(startDate), end: isoFromDate(endDate) };
}

function periodOverlapsWeek(p: UnavailablePeriod, weekStart: string, weekEnd: string): boolean {
  return isoRangesOverlap(p.startDate, p.endDate, weekStart, weekEnd);
}

function recurringCoversWeekDay(p: RecurringUnavailablePeriod, iso: string, weekday: number): boolean {
  if (p.weekday !== weekday) return false;
  const from = String(p.validFrom ?? "").trim();
  const to = String(p.validTo ?? "").trim();
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

function recurringOverlapsWeek(p: RecurringUnavailablePeriod, weekOffset: number): boolean {
  const start = addDays(baseWeekStart, weekOffset * 7);
  for (let d = 0; d < 7; d++) {
    const dateObj = addDays(start, d);
    if (recurringCoversWeekDay(p, isoFromDate(dateObj), d)) return true;
  }
  return false;
}

function hasPartialWindow(startTime?: string, endTime?: string): boolean {
  return Boolean(startTime?.trim() && endTime?.trim());
}

function formatNorDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  return `${d}. ${months[m - 1] ?? ""}`;
}

function formatDateRange(start: string, end: string): string {
  if (start === end) return formatNorDateShort(start);
  return `${formatNorDateShort(start)}–${formatNorDateShort(end)}`;
}

function periodActiveToday(p: UnavailablePeriod, todayIso: string): boolean {
  return p.startDate <= todayIso && todayIso <= p.endDate;
}

function recurringActiveToday(p: RecurringUnavailablePeriod, todayIso: string, weekday: number): boolean {
  return recurringCoversWeekDay(p, todayIso, weekday);
}

/** Employees with Ferie overlapping the selected week (scoped list, unique by id). */
export function countEmployeesOnVacationThisWeek(employees: Employee[], weekOffset: number): number {
  const { start, end } = weekIsoRange(weekOffset);
  const ids = new Set<string>();
  for (const e of employees) {
    for (const p of e.unavailablePeriods ?? []) {
      if (normalizeReason(p.reason) !== "Ferie") continue;
      if (periodOverlapsWeek(p, start, end)) ids.add(e.id);
    }
  }
  return ids.size;
}

/** Employees with Syk overlapping the selected week. */
export function countEmployeesSickThisWeek(employees: Employee[], weekOffset: number): number {
  const { start, end } = weekIsoRange(weekOffset);
  const ids = new Set<string>();
  for (const e of employees) {
    for (const p of e.unavailablePeriods ?? []) {
      if (normalizeReason(p.reason) !== "Syk") continue;
      if (periodOverlapsWeek(p, start, end)) ids.add(e.id);
    }
    for (const rp of e.recurringUnavailablePeriods ?? []) {
      if (normalizeReason(rp.reason) !== "Syk") continue;
      if (recurringOverlapsWeek(rp, weekOffset)) ids.add(e.id);
    }
  }
  return ids.size;
}

function buildPeriodRow(e: Employee, p: UnavailablePeriod, todayIso: string): UpcomingAbsenceRow {
  const partial = hasPartialWindow(p.startTime, p.endTime);
  const active = periodActiveToday(p, todayIso);
  const type = normalizeReason(p.reason);
  return {
    id: `period-${e.id}-${p.id}`,
    employeeId: e.id,
    employeeName: e.name,
    type,
    whenLabel: formatDateRange(p.startDate, p.endDate),
    timeLabel: partial ? `${p.startTime}–${p.endTime}` : null,
    note: p.note?.trim() || null,
    sortRank: active ? 0 : 1,
    sortKey: p.startDate,
    isActive: active,
  };
}

function buildRecurringRow(e: Employee, p: RecurringUnavailablePeriod, todayIso: string): UpcomingAbsenceRow {
  const partial = hasPartialWindow(p.startTime, p.endTime);
  const weekdayLabel = dayShort[p.weekday] ?? "Ukedag";
  const from = String(p.validFrom ?? "").trim();
  const to = String(p.validTo ?? "").trim();
  let whenLabel = `Hver ${weekdayLabel.toLowerCase()}`;
  if (from && to) whenLabel = `${whenLabel} · ${formatDateRange(from, to)}`;
  else if (from) whenLabel = `${whenLabel} · fra ${formatNorDateShort(from)}`;
  else if (to) whenLabel = `${whenLabel} · til ${formatNorDateShort(to)}`;

  const todayWeekday = (() => {
    const d = todayLocal();
    const js = d.getDay();
    return js === 0 ? 6 : js - 1;
  })();
  const active = recurringActiveToday(p, todayIso, todayWeekday);

  return {
    id: `recurring-${e.id}-${p.id}`,
    employeeId: e.id,
    employeeName: e.name,
    type: normalizeReason(p.reason),
    whenLabel,
    timeLabel: partial ? `${p.startTime}–${p.endTime}` : null,
    note: p.note?.trim() || null,
    sortRank: active ? 0 : 1,
    sortKey: from || "9999-12-31",
    isActive: active,
  };
}

/** Upcoming and active absences for dashboard; read-only. */
export function buildUpcomingAbsences(employees: Employee[], limit = 12): UpcomingAbsenceRow[] {
  const todayIso = isoFromDate(todayLocal());
  const rows: UpcomingAbsenceRow[] = [];

  for (const e of employees) {
    for (const p of e.unavailablePeriods ?? []) {
      if (p.endDate < todayIso) continue;
      rows.push(buildPeriodRow(e, p, todayIso));
    }
    for (const rp of e.recurringUnavailablePeriods ?? []) {
      const to = String(rp.validTo ?? "").trim();
      if (to && to < todayIso) continue;
      rows.push(buildRecurringRow(e, rp, todayIso));
    }
  }

  return rows
    .sort((a, b) => {
      if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
      return a.sortKey.localeCompare(b.sortKey);
    })
    .slice(0, limit);
}

export function absenceTypeBadgeClass(type: AbsenceTypeLabel): string {
  if (type === "Ferie") return "bg-violet-50 text-violet-800 ring-violet-100";
  if (type === "Syk") return "bg-slate-700/90 text-white ring-slate-600";
  if (type === "Skole") return "bg-sky-50 text-sky-900 ring-sky-100";
  if (type === "Fri") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}
