import type { Employee, RetailStore } from "@/app/lib/types";
import { resolveStoreFromLegacyLabel } from "@/app/lib/employeeStoreMigration";

export function employeeStoreLabel(args: { employee: Employee; stores: RetailStore[] }): string {
  const { employee, stores } = args;
  const byId = new Map(stores.map((s) => [s.id, s] as const));

  const storeIds = Array.isArray(employee.storeIds) ? employee.storeIds.filter(Boolean) : [];
  const primaryStoreId = typeof employee.primaryStoreId === "string" ? employee.primaryStoreId : null;

  const validStoreIds = storeIds.filter((id) => byId.has(id));
  const primaryId =
    (primaryStoreId && byId.has(primaryStoreId) ? primaryStoreId : null) ?? (validStoreIds[0] ?? null);

  if (primaryId) {
    const primary = byId.get(primaryId) ?? null;
    const primaryName = primary?.name ?? null;
    if (!primaryName) return "Ikke tilknyttet";

    const nExtra = Math.max(0, validStoreIds.filter((id) => id !== primaryId).length);
    return nExtra > 0 ? `${primaryName} + ${nExtra} til` : primaryName;
  }

  if (employee.primaryStore) {
    const match = resolveStoreFromLegacyLabel(employee.primaryStore, stores);
    if (match?.name) return match.name;
  }

  return "Ikke tilknyttet";
}

