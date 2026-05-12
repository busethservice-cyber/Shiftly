"use client";

import type { RetailStore, Shift } from "@/app/lib/types";
import type { ShiftlySettings } from "@/app/lib/settings";

export type StaffingStatus = "ok" | "understaffed";

export function getRequiredStaffForDay(store: RetailStore | null | undefined, dayIndex: number, settings: ShiftlySettings) {
  const minFallback = Math.max(0, Number(settings.minStaffPerOpenDay ?? 0));

  if (!store) return minFallback;
  const day = store.days?.find((d) => d.dayIndex === dayIndex);
  if (!day || !day.open) return 0;

  const base = Math.max(minFallback, Math.max(0, Number(day.minStaff ?? 0)));
  const saturdayExtra = settings.extraSaturdayStaffing && dayIndex === 5 ? 1 : 0;
  return base + saturdayExtra;
}

export function getStaffingStatusForDay(shifts: Shift[], store: RetailStore | null | undefined, dayIndex: number, settings: ShiftlySettings) {
  const planned = shifts.filter((s) => s.day === dayIndex).length;
  const required = getRequiredStaffForDay(store, dayIndex, settings);
  const status: StaffingStatus = planned < required ? "understaffed" : "ok";
  return { planned, required, status };
}

