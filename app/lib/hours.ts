import type { Shift, ShiftStatus } from "@/app/lib/types";

/** Full-time weekly hours (Norwegian standard). */
export const FULL_TIME_WEEKLY_HOURS = 37.5;

/** Legacy `store === "Fri"` plus empty-times off pattern; Fri is canonical until full id-based off-days exist. */
export function isShiftOff(shift: Pick<Shift, "store" | "startTime" | "endTime">): boolean {
  return shift.store === "Fri" || (!shift.startTime && !shift.endTime);
}

export function parseTimeToMinutes(value: string) {
  // Accept "HH:mm". Empty => 0.
  if (!value) return 0;
  const [h, m] = value.split(":").map((p) => Number(p));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function shiftDurationHours(shift: Pick<Shift, "startTime" | "endTime" | "store">) {
  if (isShiftOff(shift)) return 0;
  if (!shift.startTime || !shift.endTime) return 0;

  const start = parseTimeToMinutes(shift.startTime);
  const end = parseTimeToMinutes(shift.endTime);
  const minutes = Math.max(0, end - start);
  return minutes / 60;
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function contractHoursFromPercent(percent: number) {
  const p = Number.isFinite(percent) ? Math.max(0, percent) : 0;
  return round1((p / 100) * FULL_TIME_WEEKLY_HOURS);
}

export function formatHours(value: number) {
  // UI uses comma decimals in Norwegian mock data.
  return round1(value).toFixed(1).replace(".", ",");
}

export function employeeStatus(totalHours: number, contractHours: number): ShiftStatus {
  if (contractHours <= 0) return "normal";
  if (totalHours > contractHours) return "over_limit";
  if (totalHours >= contractHours * 0.9) return "near_limit";
  return "normal";
}

export function sumEmployeeWeekHours(shifts: Shift[]) {
  return shifts.reduce((acc, s) => acc + shiftDurationHours(s), 0);
}

