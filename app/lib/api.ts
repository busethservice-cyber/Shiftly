"use client";

import type { DbAvailabilityPeriod, DbEmployee, DbRequest, DbShift, DbStore } from "@/app/lib/dbTypes";
import type { Employee, EmployeeRequest, RecurringUnavailablePeriod, RetailStore, Shift, UnavailablePeriodReason } from "@/app/lib/types";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { initialEmployees, initialShifts } from "@/app/lib/mockData";
import { initialRetailStores } from "@/app/lib/storesData";
import { makeId, baseWeekStart, addDays } from "@/app/lib/mockData";
import { useMockData } from "@/app/lib/runtimeConfig";
import { getCurrentOrganizationId } from "@/app/lib/auth";
import { normalizeEmployeeStoreAssignments } from "@/app/lib/employeeStoreMigration";

const LS_KEYS = {
  employees: "shiftly:mock:employees",
  shifts: "shiftly:mock:shifts",
  stores: "shiftly:mock:stores",
  employeeUnavailableDays: "shiftly:employeeUnavailableDays",
  /**
   * MVP fallback for recurring weekly unavailability in Supabase mode (until we add a table).
   * Shape: { [employeeId]: RecurringUnavailablePeriod[] }
   */
  employeeRecurringUnavailable: "shiftly:employeeRecurringUnavailable",
  /**
   * MVP fallback for multi-store assignment in Supabase mode.
   * Shape: { [employeeId]: { storeIds: string[]; primaryStoreId: string | null } }
   */
  employeeStores: "shiftly:employeeStores",
} as const;

function lsReadJson<T>(key: string): T | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function lsWriteJson(key: string, value: unknown) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function reasonToDb(r: UnavailablePeriodReason): DbAvailabilityPeriod["reason"] {
  if (r === "Syk") return "syk";
  if (r === "Fri") return "fri";
  return "annet";
}

function normalizeIsoDate(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function expandIsoRangeInclusive(startIso: string, endIso: string) {
  const a = normalizeIsoDate(startIso);
  const b = normalizeIsoDate(endIso);
  if (!a || !b) return [];
  const start = new Date(`${a}T00:00:00`);
  const end = new Date(`${b}T00:00:00`);
  const out: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (d.getTime() <= end.getTime()) {
    out.push(toIsoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isEmployeeSiteKey(value: string | null): value is "Solsiden" | "City Lade" {
  return value === "Solsiden" || value === "City Lade";
}

type EmployeeStoresCache = Record<string, { storeIds: string[]; primaryStoreId: string | null }>;

type EmployeeRecurringUnavailableCache = Record<string, RecurringUnavailablePeriod[]>;

function readEmployeeStoresCache(): EmployeeStoresCache {
  return lsReadJson<EmployeeStoresCache>(LS_KEYS.employeeStores) ?? {};
}

function writeEmployeeStoresCache(next: EmployeeStoresCache) {
  lsWriteJson(LS_KEYS.employeeStores, next);
}

function readEmployeeRecurringUnavailableCache(): EmployeeRecurringUnavailableCache {
  return lsReadJson<EmployeeRecurringUnavailableCache>(LS_KEYS.employeeRecurringUnavailable) ?? {};
}

function writeEmployeeRecurringUnavailableCache(next: EmployeeRecurringUnavailableCache) {
  // MVP fallback only; persisted in localStorage even in Supabase mode.
  lsWriteJson(LS_KEYS.employeeRecurringUnavailable, next);
}

async function persistSupabaseEmployeeStoreNormalization(args: {
  orgId: string;
  dbRows: DbEmployee[];
  normalized: ReturnType<typeof normalizeEmployeeStoreAssignments>[];
}): Promise<void> {
  const { orgId, dbRows, normalized } = args;
  const dbById = new Map(dbRows.map((r) => [r.id, r] as const));
  let cache = readEmployeeStoresCache();
  let cacheDirty = false;
  const supabase = getSupabaseClient();

  for (const r of normalized) {
    if (!r.changed) continue;
    const emp = r.employee;
    const row = dbById.get(emp.id);
    const nextEntry = {
      storeIds: emp.storeIds ?? [],
      primaryStoreId: emp.primaryStoreId ?? null,
    };
    const prev = cache[emp.id];
    if (JSON.stringify(prev) !== JSON.stringify(nextEntry)) {
      cache = { ...cache, [emp.id]: nextEntry };
      cacheDirty = true;
    }
    if (row && row.store_id == null && emp.primaryStoreId) {
      const { error } = await supabase
        .from("employees")
        .update({ store_id: emp.primaryStoreId } as any)
        .eq("id", emp.id)
        .eq("organization_id", orgId);
      if (error) console.error("Failed to persist migrated employee store_id", error);
    }
  }
  if (cacheDirty) writeEmployeeStoresCache(cache);
}

function parseDbTimeToHm(t: string) {
  // Accept "HH:mm:ss" or "HH:mm"
  if (!t) return "";
  const [hh, mm] = t.split(":");
  if (!hh || !mm) return t;
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

function hmToDbTime(hm: string) {
  if (!hm) return "00:00:00";
  const [hh, mm] = hm.split(":");
  return `${String(hh ?? "00").padStart(2, "0")}:${String(mm ?? "00").padStart(2, "0")}:00`;
}

function diffDays(a: Date, b: Date) {
  const ms = 24 * 60 * 60 * 1000;
  const aa = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((aa - bb) / ms);
}

function dateFromWeekDay(week: number, day: number) {
  return addDays(baseWeekStart, week * 7 + day);
}

function reasonToUi(r: DbAvailabilityPeriod["reason"]): UnavailablePeriodReason {
  if (r === "syk") return "Syk";
  if (r === "fri") return "Fri";
  return "Annet";
}

function requestTypeToUi(t: DbRequest["type"]): EmployeeRequest["type"] {
  if (t === "fri") return "be_om_fri";
  if (t === "syk") return "meld_sykdom";
  return "bytt_vakt";
}

function requestStatusToUi(s: DbRequest["status"]): EmployeeRequest["status"] {
  return s;
}

export async function getStores(): Promise<RetailStore[]> {
  if (useMockData) return lsReadJson<RetailStore[]>(LS_KEYS.stores) ?? initialRetailStores;

  const orgId = await getCurrentOrganizationId();
  if (!orgId) throw new Error("Not authenticated");

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .eq("organization_id", orgId);
  if (error) throw error;

  const stores = (data ?? []) as DbStore[];
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    address: "",
    phone: "",
    status: s.is_active ? "active" : "inactive",
    notes: "",
    employeeSiteKey: isEmployeeSiteKey(s.employee_site_key) ? s.employee_site_key : null,
    days: [
      { dayIndex: 0, open: true, startTime: "10:00", endTime: "17:00", minStaff: 0, staffingNote: "" },
      { dayIndex: 1, open: true, startTime: "10:00", endTime: "17:00", minStaff: 0, staffingNote: "" },
      { dayIndex: 2, open: true, startTime: "10:00", endTime: "17:00", minStaff: 0, staffingNote: "" },
      { dayIndex: 3, open: true, startTime: "10:00", endTime: "17:00", minStaff: 0, staffingNote: "" },
      { dayIndex: 4, open: true, startTime: "10:00", endTime: "17:00", minStaff: 0, staffingNote: "" },
      { dayIndex: 5, open: true, startTime: "10:00", endTime: "18:00", minStaff: 0, staffingNote: "" },
      { dayIndex: 6, open: false, startTime: "10:00", endTime: "17:00", minStaff: 0, staffingNote: "" },
    ],
  }));
}

export async function upsertStore(store: RetailStore): Promise<void> {
  if (useMockData) {
    const prev = lsReadJson<RetailStore[]>(LS_KEYS.stores) ?? initialRetailStores;
    const exists = prev.some((s) => s.id === store.id);
    const next = exists ? prev.map((s) => (s.id === store.id ? store : s)) : [...prev, store];
    lsWriteJson(LS_KEYS.stores, next);
    return;
  }

  const orgId = await getCurrentOrganizationId();
  if (!orgId) throw new Error("Not authenticated");

  const supabase = getSupabaseClient();
  const row = {
    id: store.id,
    organization_id: orgId,
    name: store.name,
    is_active: store.status !== "inactive",
    employee_site_key: store.employeeSiteKey,
  } as const;

  const { error } = await supabase.from("stores").upsert(row as any);
  if (error) throw error;
}

export async function deactivateStore(storeId: string): Promise<void> {
  if (useMockData) {
    const prev = lsReadJson<RetailStore[]>(LS_KEYS.stores) ?? initialRetailStores;
    const next = prev.filter((s) => s.id !== storeId);
    lsWriteJson(LS_KEYS.stores, next);
    return;
  }

  const orgId = await getCurrentOrganizationId();
  if (!orgId) throw new Error("Not authenticated");

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("stores")
    .update({ is_active: false } as any)
    .eq("organization_id", orgId)
    .eq("id", storeId);
  if (error) throw error;
}

export async function getEmployees(): Promise<Employee[]> {
  if (useMockData) {
    const stores = lsReadJson<RetailStore[]>(LS_KEYS.stores) ?? initialRetailStores;
    const raw = lsReadJson<Employee[]>(LS_KEYS.employees) ?? initialEmployees;
    const normalized = raw.map((emp) => normalizeEmployeeStoreAssignments(emp, stores));
    const next = normalized.map((r) => r.employee);
    if (normalized.some((r) => r.changed)) {
      lsWriteJson(LS_KEYS.employees, next);
    }
    return next;
  }

  const orgId = await getCurrentOrganizationId();
  if (!orgId) throw new Error("Not authenticated");

  // Needed to derive site key and to hydrate storeIds.
  const stores = await getStores();
  const storeById = new Map(stores.map((s) => [s.id, s] as const));

  const supabase = getSupabaseClient();
  const { data: employeesData, error: employeesError } = await supabase
    .from("employees")
    .select("*")
    .eq("is_active", true)
    .eq("organization_id", orgId);
  if (employeesError) throw employeesError;

  const dbEmployees = (employeesData ?? []) as DbEmployee[];
  const employeeIds = dbEmployees.map((e) => e.id);
  const { data: availabilityData, error: availabilityError } =
    employeeIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("availability_periods").select("*").in("employee_id", employeeIds);
  if (availabilityError) throw availabilityError;

  const availability = (availabilityData ?? []) as DbAvailabilityPeriod[];

  const periodsByEmployee = new Map<string, DbAvailabilityPeriod[]>();
  for (const p of availability) {
    const list = periodsByEmployee.get(p.employee_id) ?? [];
    list.push(p);
    periodsByEmployee.set(p.employee_id, list);
  }

  const unavailableDaysCache = lsReadJson<Record<string, number[]>>(LS_KEYS.employeeUnavailableDays) ?? {};
  const storesCache = readEmployeeStoresCache();
  const recurringCache = readEmployeeRecurringUnavailableCache();

  const normalized = dbEmployees.map((e) => {
    const periods = (periodsByEmployee.get(e.id) ?? []).map((p) => ({
      id: p.id,
      startDate: p.date,
      endDate: p.date,
      reason: reasonToUi(p.reason),
    }));

    const primaryStoreId = e.store_id ?? null;
    const primaryStore = (primaryStoreId ? storeById.get(primaryStoreId)?.employeeSiteKey ?? null : null) as
      | "Solsiden"
      | "City Lade"
      | null;
    const cacheEntry = storesCache[e.id] ?? null;
    const storeIds = cacheEntry?.storeIds ?? (primaryStoreId ? [primaryStoreId] : []);

    const emp: Employee = {
      id: e.id,
      userId: e.user_id ?? undefined,
      role: e.role ?? "employee",
      name: e.name,
      contractPercent: e.position_percent,
      contractHours: e.contract_hours,
      unavailableDays: unavailableDaysCache[e.id] ?? [],
      unavailablePeriods: periods,
      recurringUnavailablePeriods: recurringCache[e.id] ?? [],
      primaryStoreId,
      storeIds,
      primaryStore,
      badges: ["Tilgjengelig"],
      notes: "",
      avatarBg: "from-slate-200 to-slate-100",
    };
    return normalizeEmployeeStoreAssignments(emp, stores);
  });

  if (normalized.some((r) => r.changed)) {
    await persistSupabaseEmployeeStoreNormalization({ orgId, dbRows: dbEmployees, normalized });
  }

  return normalized.map((r) => r.employee);
}

export async function getShifts(): Promise<Shift[]> {
  if (useMockData) return lsReadJson<Shift[]>(LS_KEYS.shifts) ?? initialShifts;

  const orgId = await getCurrentOrganizationId();
  if (!orgId) throw new Error("Not authenticated");

  const [stores, employees] = await Promise.all([getStores(), getEmployees()]);
  const storeById = new Map(stores.map((s) => [s.id, s] as const));
  const employeeById = new Map(employees.map((e) => [e.id, e] as const));

  const supabase = getSupabaseClient();
  const storeIds = stores.map((s) => s.id);
  const { data, error } =
    storeIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("shifts").select("*").in("store_id", storeIds);
  if (error) throw error;
  const shifts = (data ?? []) as DbShift[];

  return shifts.map((s) => {
    const store = storeById.get(s.store_id);
    const dayDate = new Date(`${s.day}T00:00:00`);
    const daysFromBase = diffDays(dayDate, baseWeekStart);
    const week = Math.floor(daysFromBase / 7);
    const day = ((daysFromBase % 7) + 7) % 7;

    return {
      id: s.id,
      week,
      employeeId: employeeById.has(s.employee_id) ? s.employee_id : (employees[0]?.id ?? ""),
      storeId: s.store_id,
      day,
      startTime: parseDbTimeToHm(s.start_time),
      endTime: parseDbTimeToHm(s.end_time),
      store: store?.employeeSiteKey ?? "Solsiden",
      status: "normal",
      publishState: s.status === "published" ? "published" : "draft",
    };
  });
}

export async function upsertShifts(next: Shift[]): Promise<void> {
  if (useMockData) {
    const current = lsReadJson<Shift[]>(LS_KEYS.shifts) ?? initialShifts;
    const byId = new Map(current.map((s) => [s.id, s] as const));
    for (const s of next) byId.set(s.id, s);
    lsWriteJson(LS_KEYS.shifts, Array.from(byId.values()));
    return;
  }
  if (next.length === 0) return;

  const supabase = getSupabaseClient();
  const rows: DbShift[] = next
    .map((s) => {
      if (!s.storeId) return null;
      const d = dateFromWeekDay(s.week, s.day);
      return {
        id: s.id,
        employee_id: s.employeeId,
        store_id: s.storeId,
        day: toIsoDate(d),
        start_time: hmToDbTime(s.startTime),
        end_time: hmToDbTime(s.endTime),
        status: (s.publishState ?? "draft") === "published" ? "published" : "draft",
      } satisfies DbShift;
    })
    .filter((x): x is DbShift => Boolean(x));

  if (rows.length === 0) return;

  const { error } = await supabase.from("shifts").upsert(rows);
  if (error) throw error;
}

export async function deleteShiftsById(ids: string[]): Promise<void> {
  if (useMockData) {
    const current = lsReadJson<Shift[]>(LS_KEYS.shifts) ?? initialShifts;
    const idSet = new Set(ids);
    lsWriteJson(LS_KEYS.shifts, current.filter((s) => !idSet.has(s.id)));
    return;
  }
  if (ids.length === 0) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("shifts").delete().in("id", ids);
  if (error) throw error;
}

export async function updateEmployee(updated: Employee): Promise<void> {
  if (useMockData) {
    const current = lsReadJson<Employee[]>(LS_KEYS.employees) ?? initialEmployees;
    lsWriteJson(
      LS_KEYS.employees,
      current.map((e) => (e.id === updated.id ? updated : e)),
    );
    lsWriteJson(LS_KEYS.employeeUnavailableDays, {
      ...(lsReadJson<Record<string, number[]>>(LS_KEYS.employeeUnavailableDays) ?? {}),
      [updated.id]: updated.unavailableDays ?? [],
    });
    return;
  }

  const orgId = await getCurrentOrganizationId();
  if (!orgId) throw new Error("Not authenticated");
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("employees")
    .update({
      name: updated.name,
      role: updated.role ?? "employee",
      position_percent: updated.contractPercent,
      contract_hours: updated.contractHours,
      store_id: updated.primaryStoreId ?? null,
      user_id: updated.userId ?? null,
      is_active: true,
    })
    .eq("id", updated.id)
    .eq("organization_id", orgId);
  if (error) throw error;

  // MVP fallback: store multi-store assignment locally until Supabase schema supports it.
  writeEmployeeStoresCache({
    ...readEmployeeStoresCache(),
    [updated.id]: { storeIds: updated.storeIds ?? [], primaryStoreId: updated.primaryStoreId ?? null },
  });

  // MVP fallback: recurring weekly unavailability stored in localStorage until schema supports it.
  writeEmployeeRecurringUnavailableCache({
    ...readEmployeeRecurringUnavailableCache(),
    [updated.id]: updated.recurringUnavailablePeriods ?? [],
  });

  // Weekday blocks: stored as local cache (no DB column in current schema).
  lsWriteJson(LS_KEYS.employeeUnavailableDays, {
    ...(lsReadJson<Record<string, number[]>>(LS_KEYS.employeeUnavailableDays) ?? {}),
    [updated.id]: updated.unavailableDays ?? [],
  });

  await upsertAvailabilityPeriods(updated.id, updated.unavailablePeriods ?? []);
}

export async function createEmployee(next: Employee): Promise<void> {
  if (useMockData) {
    const current = lsReadJson<Employee[]>(LS_KEYS.employees) ?? initialEmployees;
    lsWriteJson(LS_KEYS.employees, current.some((e) => e.id === next.id) ? current : [...current, next]);
    lsWriteJson(LS_KEYS.employeeUnavailableDays, {
      ...(lsReadJson<Record<string, number[]>>(LS_KEYS.employeeUnavailableDays) ?? {}),
      [next.id]: next.unavailableDays ?? [],
    });
    return;
  }

  const orgId = await getCurrentOrganizationId();
  if (!orgId) throw new Error("Not authenticated");
  const supabase = getSupabaseClient();

  const row: DbEmployee = {
    id: next.id || makeId(),
    organization_id: orgId,
    store_id: next.primaryStoreId ?? null,
    user_id: next.userId ?? null,
    role: (next.role ?? "employee") as DbEmployee["role"],
    name: next.name,
    position_percent: next.contractPercent,
    contract_hours: next.contractHours,
    is_active: true,
  };

  const { error } = await supabase.from("employees").insert([row]);
  if (error) throw error;

  // MVP fallback: store multi-store assignment locally until Supabase schema supports it.
  writeEmployeeStoresCache({
    ...readEmployeeStoresCache(),
    [row.id]: { storeIds: next.storeIds ?? [], primaryStoreId: next.primaryStoreId ?? null },
  });

  // MVP fallback: recurring weekly unavailability stored in localStorage until schema supports it.
  writeEmployeeRecurringUnavailableCache({
    ...readEmployeeRecurringUnavailableCache(),
    [row.id]: next.recurringUnavailablePeriods ?? [],
  });

  lsWriteJson(LS_KEYS.employeeUnavailableDays, {
    ...(lsReadJson<Record<string, number[]>>(LS_KEYS.employeeUnavailableDays) ?? {}),
    [row.id]: next.unavailableDays ?? [],
  });
  await upsertAvailabilityPeriods(row.id, next.unavailablePeriods ?? []);
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  if (useMockData) {
    const current = lsReadJson<Employee[]>(LS_KEYS.employees) ?? initialEmployees;
    lsWriteJson(LS_KEYS.employees, current.filter((e) => e.id !== employeeId));
    const cache = lsReadJson<Record<string, number[]>>(LS_KEYS.employeeUnavailableDays) ?? {};
    delete cache[employeeId];
    lsWriteJson(LS_KEYS.employeeUnavailableDays, cache);
    return;
  }

  const orgId = await getCurrentOrganizationId();
  if (!orgId) throw new Error("Not authenticated");
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("employees")
    .update({ is_active: false })
    .eq("id", employeeId)
    .eq("organization_id", orgId);
  if (error) throw error;

  await supabase.from("availability_periods").delete().eq("employee_id", employeeId);
}

export async function upsertAvailabilityPeriods(employeeId: string, periods: Employee["unavailablePeriods"]): Promise<void> {
  if (useMockData) return;
  const supabase = getSupabaseClient();

  const { error: delErr } = await supabase.from("availability_periods").delete().eq("employee_id", employeeId);
  if (delErr) throw delErr;

  const rows: DbAvailabilityPeriod[] = [];
  for (const p of periods ?? []) {
    const days = expandIsoRangeInclusive(p.startDate, p.endDate);
    for (const iso of days) {
      rows.push({
        id: makeId(),
        employee_id: employeeId,
        date: iso,
        reason: reasonToDb(p.reason),
      });
    }
  }

  if (rows.length === 0) return;
  const { error } = await supabase.from("availability_periods").insert(rows);
  if (error) throw error;
}

export async function getRequests(): Promise<EmployeeRequest[]> {
  if (useMockData) return [];

  const orgId = await getCurrentOrganizationId();
  if (!orgId) throw new Error("Not authenticated");

  const employees = await getEmployees();
  const employeeIds = employees.map((e) => e.id);

  const supabase = getSupabaseClient();
  const { data, error } =
    employeeIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("requests").select("*").in("employee_id", employeeIds);
  if (error) throw error;
  const reqs = (data ?? []) as DbRequest[];

  return reqs.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    type: requestTypeToUi(r.type),
    date: r.date,
    message: r.message ?? "",
    status: requestStatusToUi(r.status),
  }));
}

// Convenience for seeding UI-only requests locally (still no backend routes)
export function createLocalRequest(args: Omit<EmployeeRequest, "id" | "status">): EmployeeRequest {
  return { id: makeId(), status: "pending", ...args };
}

