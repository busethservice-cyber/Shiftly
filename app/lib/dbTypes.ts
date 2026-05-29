"use client";

export type DbUuid = string;
export type DbDate = string; // YYYY-MM-DD
export type DbTime = string; // HH:mm:ss or HH:mm

export type DbOrganization = {
  id: DbUuid;
  name: string;
};

export type DbStore = {
  id: DbUuid;
  organization_id: DbUuid;
  name: string;
  employee_site_key: string | null;
  is_active: boolean;
};

export type DbEmployee = {
  id: DbUuid;
  organization_id: DbUuid;
  store_id: DbUuid | null;
  user_id: DbUuid | null;
  role: "admin" | "employee";
  name: string;
  position_percent: number;
  contract_hours: number;
  is_active: boolean;
};

export type DbShiftStatus = "draft" | "published";

export type DbShift = {
  id: DbUuid;
  employee_id: DbUuid;
  store_id: DbUuid;
  day: DbDate;
  start_time: DbTime;
  end_time: DbTime;
  status: DbShiftStatus;
};

export type DbAvailabilityReason = "fri" | "ferie" | "syk" | "skole" | "annet";

export type DbAvailabilityPeriod = {
  id: DbUuid;
  employee_id: DbUuid;
  date: DbDate;
  reason: DbAvailabilityReason;
  start_time: DbTime | null;
  end_time: DbTime | null;
  note: string | null;
  period_group_id: DbUuid | null;
};

export type DbRecurringAvailabilityPeriod = {
  id: DbUuid;
  employee_id: DbUuid;
  weekday: number;
  start_time: DbTime | null;
  end_time: DbTime | null;
  reason: string | null;
  valid_from: DbDate | null;
  valid_to: DbDate | null;
  note: string | null;
};

export type DbRequestType = "fri" | "bytt" | "syk";
export type DbRequestStatus = "pending" | "approved" | "rejected";

export type DbRequest = {
  id: DbUuid;
  employee_id: DbUuid;
  type: DbRequestType;
  date: DbDate;
  message: string | null;
  status: DbRequestStatus;
};

export type DbSettings = {
  id: DbUuid;
  organization_id: DbUuid;
  full_time_hours: number;
  near_limit_threshold: number;
};

