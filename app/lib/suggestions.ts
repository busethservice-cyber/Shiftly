import type { EmployeeComputed } from "@/app/lib/types";

export type SuggestedEmployee = {
  id: string;
  name: string;
  totalHours: number;
  contractHours: number;
  progress: number; // total/contract
  computedStatus: EmployeeComputed["computedStatus"];
};

function statusRank(status: EmployeeComputed["computedStatus"]) {
  // Prefer normal > near_limit > over_limit
  if (status === "normal") return 0;
  if (status === "near_limit") return 1;
  return 2;
}

export function suggestEmployeesForDay(args: {
  employees: EmployeeComputed[];
  day: number;
  limit?: number;
}): SuggestedEmployee[] {
  const { employees, day, limit = 3 } = args;

  return [...employees]
    .filter((e) => !e.unavailableDays.includes(day))
    .map((e) => ({
      id: e.id,
      name: e.name,
      totalHours: e.totalHours,
      contractHours: e.contractHours,
      progress: e.progress,
      computedStatus: e.computedStatus,
    }))
    .sort((a, b) => {
      // 1) Lowest % used
      const byProgress = a.progress - b.progress;
      if (byProgress !== 0) return byProgress;

      // 2) Not over contract
      const aOver = a.computedStatus === "over_limit" ? 1 : 0;
      const bOver = b.computedStatus === "over_limit" ? 1 : 0;
      if (aOver !== bOver) return aOver - bOver;

      // 3) Prefer normal over near/over
      const byStatus = statusRank(a.computedStatus) - statusRank(b.computedStatus);
      if (byStatus !== 0) return byStatus;

      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

