import type { Employee, RecurringUnavailablePeriod, UnavailablePeriod } from "@/app/lib/types";
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


export type WeeklyAbsenceOverview = {
  absenceEmployeeCount: number;
  sickEmployeeCount: number;
  rows: UpcomingAbsenceRow[];
};

/** Absence KPI + list for a selected week; read-only. */
export function getWeeklyAbsenceOverview(employees: Employee[], weekOffset: number, limit = 12): WeeklyAbsenceOverview {
  const { start, end } = weekIsoRange(weekOffset);
  const todayIso = isoFromDate(todayLocal());
  const absenceIds = new Set<string>();
  const sickIds = new Set<string>();
  const rows: UpcomingAbsenceRow[] = [];

  for (const e of employees) {
    let employeeHasAbsence = false;

    for (const day of e.unavailableDays ?? []) {
      employeeHasAbsence = true;
      rows.push(buildWeekdayBlockRow(e, day, weekOffset, todayIso));
    }

    for (const p of e.unavailablePeriods ?? []) {
      if (!periodOverlapsWeek(p, start, end)) continue;
      employeeHasAbsence = true;
      if (normalizeReason(p.reason) === "Syk") sickIds.add(e.id);
      rows.push(buildPeriodRowForWeek(e, p, start, end, todayIso));
    }

    for (const rp of e.recurringUnavailablePeriods ?? []) {
      if (!recurringOverlapsWeek(rp, weekOffset)) continue;
      employeeHasAbsence = true;
      if (normalizeReason(rp.reason) === "Syk") sickIds.add(e.id);
      rows.push(buildRecurringRowForWeek(e, rp, weekOffset, todayIso));
    }

    if (employeeHasAbsence) absenceIds.add(e.id);
  }

  return {
    absenceEmployeeCount: absenceIds.size,
    sickEmployeeCount: sickIds.size,
    rows: sortAbsenceRows(rows).slice(0, limit),
  };
}

/** Employees with any absence/unavailability overlapping the selected week (unique by id). */
export function countEmployeesWithAbsenceThisWeek(employees: Employee[], weekOffset: number): number {
  return getWeeklyAbsenceOverview(employees, weekOffset).absenceEmployeeCount;
}

/** Employees with Syk overlapping the selected week. */
export function countEmployeesSickThisWeek(employees: Employee[], weekOffset: number): number {
  return getWeeklyAbsenceOverview(employees, weekOffset).sickEmployeeCount;
}

function buildWeekdayBlockRow(e: Employee, weekday: number, weekOffset: number, todayIso: string): UpcomingAbsenceRow {
  const weekdayLabel = dayShort[weekday] ?? "Ukedag";
  const weekStart = addDays(baseWeekStart, weekOffset * 7);
  const dayDate = addDays(weekStart, weekday);
  const dayIso = isoFromDate(dayDate);
  const active = dayIso === todayIso;

  return {
    id: `weekday-${e.id}-${weekday}`,
    employeeId: e.id,
    employeeName: e.name,
    type: "Fri",
    whenLabel: `Hver ${weekdayLabel.toLowerCase()}`,
    timeLabel: null,
    note: null,
    sortRank: active ? 0 : 1,
    sortKey: dayIso,
    isActive: active,
  };
}

function buildPeriodRowForWeek(
  e: Employee,
  p: UnavailablePeriod,
  weekStart: string,
  weekEnd: string,
  todayIso: string,
): UpcomingAbsenceRow {
  const partial = hasPartialWindow(p.startTime, p.endTime);
  const active = periodActiveToday(p, todayIso);
  const type = normalizeReason(p.reason);
  const clipStart = p.startDate < weekStart ? weekStart : p.startDate;
  const clipEnd = p.endDate > weekEnd ? weekEnd : p.endDate;
  return {
    id: `period-${e.id}-${p.id}`,
    employeeId: e.id,
    employeeName: e.name,
    type,
    whenLabel: formatDateRange(clipStart, clipEnd),
    timeLabel: partial ? `${p.startTime}–${p.endTime}` : null,
    note: p.note?.trim() || null,
    sortRank: active ? 0 : 1,
    sortKey: clipStart,
    isActive: active,
  };
}

function buildRecurringRowForWeek(
  e: Employee,
  p: RecurringUnavailablePeriod,
  weekOffset: number,
  todayIso: string,
): UpcomingAbsenceRow {
  const partial = hasPartialWindow(p.startTime, p.endTime);
  const weekdayLabel = dayShort[p.weekday] ?? "Ukedag";
  const from = String(p.validFrom ?? "").trim();
  const to = String(p.validTo ?? "").trim();
  let whenLabel = `Hver ${weekdayLabel.toLowerCase()}`;
  if (from && to) whenLabel = `${whenLabel} · ${formatDateRange(from, to)}`;
  else if (from) whenLabel = `${whenLabel} · fra ${formatNorDateShort(from)}`;
  else if (to) whenLabel = `${whenLabel} · til ${formatNorDateShort(to)}`;

  const weekStart = addDays(baseWeekStart, weekOffset * 7);
  const dayDate = addDays(weekStart, p.weekday);
  const dayIso = isoFromDate(dayDate);

  const todayWeekday = (() => {
    const d = todayLocal();
    const js = d.getDay();
    return js === 0 ? 6 : js - 1;
  })();
  const active = recurringActiveToday(p, todayIso, todayWeekday) && dayIso >= todayIso;

  return {
    id: `recurring-${e.id}-${p.id}`,
    employeeId: e.id,
    employeeName: e.name,
    type: normalizeReason(p.reason),
    whenLabel,
    timeLabel: partial ? `${p.startTime}–${p.endTime}` : null,
    note: p.note?.trim() || null,
    sortRank: active ? 0 : 1,
    sortKey: dayIso,
    isActive: active,
  };
}

function sortAbsenceRows(rows: UpcomingAbsenceRow[]): UpcomingAbsenceRow[] {
  return rows.sort((a, b) => {
    if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
    return a.sortKey.localeCompare(b.sortKey);
  });
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

/** Upcoming absences; pass weekOffset for week-scoped dashboard list. */
export function buildUpcomingAbsences(employees: Employee[], limit = 12, weekOffset?: number): UpcomingAbsenceRow[] {
  if (typeof weekOffset === "number") {
    return getWeeklyAbsenceOverview(employees, weekOffset, limit).rows;
  }

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
