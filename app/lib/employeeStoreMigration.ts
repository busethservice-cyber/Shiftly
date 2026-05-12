import type { Employee, RetailStore } from "@/app/lib/types";

function norm(s: string) {
  return s.trim().toLowerCase();
}

/**
 * Match legacy free-text / site-key labels to a catalog store (name or employeeSiteKey).
 */
export function resolveStoreFromLegacyLabel(label: string | null | undefined, stores: RetailStore[]): RetailStore | null {
  if (!label?.trim()) return null;
  const n = norm(label);

  for (const st of stores) {
    if (st.employeeSiteKey && norm(st.employeeSiteKey) === n) return st;
  }
  for (const st of stores) {
    if (norm(st.name) === n) return st;
  }

  const candidates: RetailStore[] = [];
  const seen = new Set<string>();
  for (const st of stores) {
    const nm = norm(st.name);
    if (n.length >= 3 && nm.includes(n)) {
      if (!seen.has(st.id)) {
        seen.add(st.id);
        candidates.push(st);
      }
    }
    if (st.employeeSiteKey) {
      const sk = norm(st.employeeSiteKey);
      if (n.length >= 3 && (nm.includes(n) || sk.includes(n) || n.includes(sk))) {
        if (!seen.has(st.id)) {
          seen.add(st.id);
          candidates.push(st);
        }
      }
    }
  }
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    const bySite = candidates.find(
      (st) => st.employeeSiteKey && n.includes(norm(st.employeeSiteKey)),
    );
    return bySite ?? candidates[0];
  }
  return null;
}

export type NormalizeEmployeeStoresResult = {
  employee: Employee;
  /** True if primaryStoreId, storeIds, or primaryStore were updated. */
  changed: boolean;
};

/**
 * Hydration-time migration: fill storeIds / primaryStoreId from legacy `primaryStore`, and back-fill storeIds when only primaryStoreId exists.
 */
export function normalizeEmployeeStoreAssignments(employee: Employee, stores: RetailStore[]): NormalizeEmployeeStoresResult {
  let e = employee;
  let changed = false;

  const storeById = new Map(stores.map((s) => [s.id, s] as const));

  const rawIds = Array.isArray(e.storeIds) ? e.storeIds.filter(Boolean) : [];
  const hasIds = rawIds.length > 0;
  const pid = typeof e.primaryStoreId === "string" && e.primaryStoreId ? e.primaryStoreId : null;

  // Back-fill storeIds from primaryStoreId (e.g. Supabase has store_id but empty cache / empty array).
  if (!hasIds && pid && storeById.has(pid)) {
    e = { ...e, storeIds: [pid] };
    changed = true;
  }

  const idsAfter = Array.isArray(e.storeIds) ? e.storeIds.filter(Boolean) : [];
  const stillNoIds = idsAfter.length === 0;

  // Legacy: only primaryStore string (site key or display name).
  if (stillNoIds && e.primaryStore) {
    const matched = resolveStoreFromLegacyLabel(e.primaryStore, stores);
    if (matched) {
      const siteKey = matched.employeeSiteKey;
      e = {
        ...e,
        primaryStoreId: matched.id,
        storeIds: [matched.id],
        primaryStore: (siteKey ?? e.primaryStore) as Employee["primaryStore"],
      };
      changed = true;
    }
  }

  const finalPid = typeof e.primaryStoreId === "string" && e.primaryStoreId ? e.primaryStoreId : null;
  if (finalPid) {
    const st = storeById.get(finalPid);
    if (st?.employeeSiteKey && e.primaryStore !== st.employeeSiteKey) {
      e = { ...e, primaryStore: st.employeeSiteKey };
      changed = true;
    }
  }

  return { employee: e, changed };
}
