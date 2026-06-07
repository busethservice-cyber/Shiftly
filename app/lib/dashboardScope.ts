import type { Employee, RetailStore, Shift } from "@/app/lib/types";
import { getScheduleWeekData, type ScheduleWeekData } from "@/app/lib/scheduleWeekData";

/**
 * @deprecated Prefer getScheduleWeekData({ selectedStoreId }) for consistent store/week scoping.
 */
export function siteKeyFromStore(store: RetailStore | null): "Solsiden" | "City Lade" | null {
  if (!store) return null;
  return store.employeeSiteKey;
}

/** @deprecated Use getScheduleWeekData().employees */
export function employeesInScope(employees: Employee[], siteKey: "Solsiden" | "City Lade" | null): Employee[] {
  if (!siteKey) return employees;
  return employees.filter((e) => e.primaryStore != null && e.primaryStore === siteKey);
}

/** @deprecated Use getScheduleWeekData().shifts */
export function shiftsInScope(weekShifts: Shift[], siteKey: "Solsiden" | "City Lade" | null): Shift[] {
  if (!siteKey) return weekShifts;
  return weekShifts.filter((s) => s.store === siteKey);
}

/** Bridge legacy site-key callers to store-id scoping when a store row is known. */
export function scheduleDataFromSiteKey(args: {
  employees: Employee[];
  shifts: Shift[];
  stores: RetailStore[];
  weekOffset: number;
  storeId: string;
}): ScheduleWeekData {
  return getScheduleWeekData({ ...args, selectedStoreId: args.storeId });
}
