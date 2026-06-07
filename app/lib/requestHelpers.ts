import type { DbRequestType } from "@/app/lib/dbTypes";
import type { Employee, EmployeeRequest, EmployeeRequestStatus, EmployeeRequestType, Shift } from "@/app/lib/types";
import { addDays, baseWeekStart } from "@/app/lib/mockData";
import { makeId } from "@/app/lib/mockData";

const SHIFT_ID_LINE = /^__shiftId:([0-9a-f-]{36})__$/i;

export function requestTypeLabel(type: EmployeeRequestType): string {
  if (type === "be_om_fri") return "Be om fri";
  if (type === "meld_sykdom") return "Meld sykdom";
  return "Bytt vakt";
}

export function requestStatusLabel(status: EmployeeRequestStatus): string {
  if (status === "pending") return "Venter";
  if (status === "approved") return "Godkjent";
  return "Avslått";
}

export function requestTypeToDb(type: EmployeeRequestType): DbRequestType {
  if (type === "be_om_fri") return "fri";
  if (type === "meld_sykdom") return "syk";
  return "bytt";
}

export function encodeRequestMessage(message: string, shiftId?: string): string {
  const text = message.trim();
  if (!shiftId) return text;
  const prefix = `__shiftId:${shiftId}__`;
  return text ? `${prefix}\n${text}` : prefix;
}

export function decodeRequestMessage(raw: string | null | undefined): { message: string; shiftId?: string } {
  const value = (raw ?? "").trim();
  if (!value) return { message: "" };

  const [first, ...rest] = value.split("\n");
  const match = SHIFT_ID_LINE.exec(first.trim());
  if (!match) return { message: value };

  return {
    shiftId: match[1],
    message: rest.join("\n").trim(),
  };
}

export function buildApprovedSideEffects(
  req: EmployeeRequest,
  employee: Employee,
  shifts: Shift[],
): { updatedEmployee: Employee | null; remainingShifts: Shift[]; manualOnly: boolean } {
  if (req.type === "bytt_vakt") {
    return { updatedEmployee: null, remainingShifts: shifts, manualOnly: true };
  }

  const reason = req.type === "meld_sykdom" ? ("Syk" as const) : ("Fri" as const);
  const period = { id: makeId(), startDate: req.date, endDate: req.date, reason };

  const existing = employee.unavailablePeriods ?? [];
  const duplicate = existing.some((p) => p.startDate === req.date && p.endDate === req.date && p.reason === reason);
  const nextPeriods = duplicate ? existing : [...existing, period];

  const nextBadges = new Set(employee.badges);
  if (reason === "Syk") nextBadges.add("Syk");
  if (reason === "Fri") nextBadges.add("Fri");
  nextBadges.delete("Tilgjengelig");

  const updatedEmployee: Employee = {
    ...employee,
    unavailablePeriods: nextPeriods,
    badges: Array.from(nextBadges) as Employee["badges"],
  };

  const remainingShifts = shifts.filter((s) => {
    if (s.employeeId !== req.employeeId) return true;
    const d = addDays(baseWeekStart, s.week * 7 + s.day);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return iso !== req.date;
  });

  return { updatedEmployee, remainingShifts, manualOnly: false };
}
