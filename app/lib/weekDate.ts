import { addDays, baseWeekStart } from "@/app/lib/mockData";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function todayLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isoFromDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateFromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return null;
  return new Date(y, mo - 1, da);
}

export function weekOffsetFromDate(d: Date) {
  const aa = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const bb = Date.UTC(baseWeekStart.getFullYear(), baseWeekStart.getMonth(), baseWeekStart.getDate());
  const days = Math.floor((aa - bb) / MS_PER_DAY);
  return Math.floor(days / 7);
}

export function currentWeekOffset() {
  return weekOffsetFromDate(todayLocal());
}

export function weekStartDateFromOffset(weekOffset: number) {
  return addDays(baseWeekStart, weekOffset * 7);
}

