export type ContractState = "green" | "yellow" | "red";

export type ShiftStatus = "normal" | "near_limit" | "over_limit" | "unconfirmed";

export type UnavailablePeriodReason = "Fri" | "Ferie" | "Syk" | "Skole" | "Annet";

export type UnavailablePeriod = {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  startTime?: string;
  endTime?: string;
  reason: UnavailablePeriodReason;
};

export type RecurringUnavailablePeriod = {
  id: string;
  /** 0=Monday .. 6=Sunday */
  weekday: number;
  /** Empty => whole day */
  startTime?: string;
  /** Empty => whole day */
  endTime?: string;
  reason?: string;
  /** Optional inclusive ISO date (YYYY-MM-DD) */
  validFrom?: string;
  /** Optional inclusive ISO date (YYYY-MM-DD) */
  validTo?: string;
};

export type Employee = {
  id: string;
  /** Supabase auth user id if linked. */
  userId?: string;
  role?: "admin" | "employee";
  name: string;
  contractPercent: number; // e.g. 20
  contractHours: number; // per week, derived from percent × 37.5 (stored for schedule/alerts)
  unavailableDays: number[]; // 0..6 (Man–Søn)
  unavailablePeriods: UnavailablePeriod[];
  /** Recurring weekly unavailability (weekday + optional time window + optional validity range). */
  recurringUnavailablePeriods?: RecurringUnavailablePeriod[];
  /**
   * Primary store UUID (RetailStore.id). This is the persisted value in Supabase (employees.store_id).
   * null = ikke tilknyttet butikk.
   */
  primaryStoreId: string | null;
  /**
   * Connected stores (RetailStore.id). Supports multi-store assignment.
   * In current Supabase schema, only `primaryStoreId` is persisted; `storeIds` is persisted in localStorage as MVP fallback.
   */
  storeIds: string[];
  /**
   * Backwards-compatible site key aligned with `RetailStore.employeeSiteKey`.
   * Derived from `primaryStoreId` when possible; kept for existing shift/site-key logic.
   */
  primaryStore: "Solsiden" | "City Lade" | null;
  badges: Array<"Ferie" | "Syk" | "Fri" | "Tilgjengelig">;
  notes: string;
  avatarBg: string;
};

export type EmployeeComputed = Employee & {
  totalHours: number;
  progress: number; // totalHours/contractHours
  contractLabel: string; // e.g. "20% • 6,0/7,5 t"
  computedStatus: ShiftStatus; // derived from totalHours vs contractHours
};

export type Shift = {
  id: string;
  week: number; // 0=current base week, 1=next, etc.
  employeeId: string;
  /** Supabase store UUID when backend is enabled (UI still uses `store` site key). */
  storeId?: string;
  day: number; // 0..6 (Man–Søn)
  startTime: string; // "HH:mm" (or empty for off)
  endTime: string; // "HH:mm" (or empty for off)
  store: string; // e.g. "Solsiden" | "City Lade" | "Fri"
  status: ShiftStatus;
  publishState?: "draft" | "published";
  showMenu?: boolean;
};

export type StoreStatus = "active" | "inactive";

/** One weekday row: opening hours + staffing floor + optional note. */
export type StoreDaySchedule = {
  dayIndex: number; // 0 Mon .. 6 Sun
  open: boolean;
  startTime: string;
  endTime: string;
  minStaff: number;
  staffingNote: string;
};

/** Retail location (UI / HR). `employeeSiteKey` maps to `Employee.primaryStore` for headcount. */
export type RetailStore = {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: StoreStatus;
  notes: string;
  employeeSiteKey: "Solsiden" | "City Lade" | null;
  days: StoreDaySchedule[];
};

export type ReportTabId = "timer" | "overtid" | "bemanning" | "fravaer";

export type EmployeeRequestType = "be_om_fri" | "bytt_vakt" | "meld_sykdom";

export type EmployeeRequestStatus = "pending" | "approved" | "rejected";

export type EmployeeRequest = {
  id: string;
  employeeId: string;
  type: EmployeeRequestType;
  shiftId?: string;
  date: string; // YYYY-MM-DD
  message: string;
  status: EmployeeRequestStatus;
};

