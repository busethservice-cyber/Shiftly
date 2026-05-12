import type { Employee, RetailStore, Shift } from "@/app/lib/types";

export function siteKeyFromStore(store: RetailStore | null): "Solsiden" | "City Lade" | null {
  if (!store) return null;
  return store.employeeSiteKey;
}

export function employeesInScope(employees: Employee[], siteKey: "Solsiden" | "City Lade" | null): Employee[] {
  if (!siteKey) return employees;
  return employees.filter((e) => e.primaryStore != null && e.primaryStore === siteKey);
}

export function shiftsInScope(weekShifts: Shift[], siteKey: "Solsiden" | "City Lade" | null): Shift[] {
  if (!siteKey) return weekShifts;
  return weekShifts.filter((s) => s.store === siteKey);
}
