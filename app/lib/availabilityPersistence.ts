import type { DbAvailabilityPeriod, DbRecurringAvailabilityPeriod } from "@/app/lib/dbTypes";
import type { RecurringUnavailablePeriod, UnavailablePeriod, UnavailablePeriodReason } from "@/app/lib/types";
import { makeId } from "@/app/lib/mockData";

export function isPartialUnavailablePeriod(p: Pick<UnavailablePeriod, "startTime" | "endTime">): boolean {
  return Boolean(p.startTime?.trim() && p.endTime?.trim());
}

export function reasonToDb(r: UnavailablePeriodReason): DbAvailabilityPeriod["reason"] {
  if (r === "Syk") return "syk";
  if (r === "Fri") return "fri";
  if (r === "Ferie") return "ferie";
  if (r === "Skole") return "skole";
  return "annet";
}

export function reasonToUi(r: DbAvailabilityPeriod["reason"]): UnavailablePeriodReason {
  if (r === "syk") return "Syk";
  if (r === "fri") return "Fri";
  if (r === "ferie") return "Ferie";
  if (r === "skole") return "Skole";
  return "Annet";
}

export function parseDbTimeToHm(t: string | null | undefined): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  if (!hh || !mm) return t;
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

export function hmToDbTime(hm: string): string {
  if (!hm) return "00:00:00";
  const [hh, mm] = hm.split(":");
  return `${String(hh ?? "00").padStart(2, "0")}:${String(mm ?? "00").padStart(2, "0")}:00`;
}

function normalizeIsoDate(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function expandIsoRangeInclusive(startIso: string, endIso: string): string[] {
  const a = normalizeIsoDate(startIso);
  const b = normalizeIsoDate(endIso);
  if (!a || !b) return [];
  const start = new Date(`${a}T00:00:00`);
  const end = new Date(`${b}T00:00:00`);
  const out: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (d.getTime() <= end.getTime()) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** UI period → one or more DB rows (preserves partial-day times). */
export function unavailablePeriodToDbRows(employeeId: string, p: UnavailablePeriod): DbAvailabilityPeriod[] {
  const partial = isPartialUnavailablePeriod(p);
  const groupId = p.id || makeId();
  const days = expandIsoRangeInclusive(p.startDate, p.endDate);
  if (days.length === 0) return [];

  return days.map((iso) => ({
    id: makeId(),
    employee_id: employeeId,
    date: iso,
    reason: reasonToDb(p.reason),
    start_time: partial ? hmToDbTime(p.startTime!.trim()) : null,
    end_time: partial ? hmToDbTime(p.endTime!.trim()) : null,
    note: p.note?.trim() || null,
    period_group_id: groupId,
  }));
}

/** DB rows → UI periods (merge by period_group_id). */
export function dbRowsToUnavailablePeriods(rows: DbAvailabilityPeriod[]): UnavailablePeriod[] {
  const byGroup = new Map<string, DbAvailabilityPeriod[]>();
  for (const r of rows) {
    const gid = r.period_group_id ?? r.id;
    const list = byGroup.get(gid) ?? [];
    list.push(r);
    byGroup.set(gid, list);
  }

  const out: UnavailablePeriod[] = [];
  for (const [, group] of byGroup) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const partial = Boolean(first.start_time && first.end_time);
    out.push({
      id: first.period_group_id ?? first.id,
      startDate: first.date,
      endDate: last.date,
      startTime: partial ? parseDbTimeToHm(first.start_time) : undefined,
      endTime: partial ? parseDbTimeToHm(first.end_time) : undefined,
      reason: reasonToUi(first.reason),
      note: first.note ?? undefined,
    });
  }

  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function recurringToDbRow(employeeId: string, p: RecurringUnavailablePeriod): DbRecurringAvailabilityPeriod {
  const hasTimes = Boolean(p.startTime?.trim() && p.endTime?.trim());
  return {
    id: p.id || makeId(),
    employee_id: employeeId,
    weekday: p.weekday,
    start_time: hasTimes ? hmToDbTime(p.startTime!.trim()) : null,
    end_time: hasTimes ? hmToDbTime(p.endTime!.trim()) : null,
    reason: p.reason?.trim() || null,
    valid_from: p.validFrom?.trim() || null,
    valid_to: p.validTo?.trim() || null,
    note: p.note?.trim() || null,
  };
}

export function dbRowToRecurring(r: DbRecurringAvailabilityPeriod): RecurringUnavailablePeriod {
  const hasTimes = Boolean(r.start_time && r.end_time);
  return {
    id: r.id,
    weekday: r.weekday,
    startTime: hasTimes ? parseDbTimeToHm(r.start_time) : undefined,
    endTime: hasTimes ? parseDbTimeToHm(r.end_time) : undefined,
    reason: r.reason ?? undefined,
    validFrom: r.valid_from ?? undefined,
    validTo: r.valid_to ?? undefined,
    note: r.note ?? undefined,
  };
}
