"use client";

import type { EmployeeComputed, Shift } from "@/app/lib/types";
import { isShiftOff } from "@/app/lib/hours";
import { getEmployeeDayUnavailableDisplay, type EmployeeDayUnavailableDisplay } from "@/app/lib/rules/shifts";
import { cn } from "@/app/lib/cn";
import { DraggableShiftChip } from "@/app/components/DraggableShiftChip";
import { DroppableDayCell, cellId } from "@/app/components/DroppableDayCell";

/** Compact "09:00" → "09", keep minutes when non-zero. */
function compactClockToken(t: string): string {
  const [hRaw, mRaw] = t.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t.trim();
  if (m === 0) return String(h).padStart(2, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function compactTimeRangeFromParts(start: string, end: string): string {
  return `${compactClockToken(start)}–${compactClockToken(end)}`;
}

/** Parse lines from `getEmployeeDayUnavailableDisplay` (`HH:MM–HH:MM` or `… · reason`). */
function parseUnavailableDetailLine(line: string): { range: string | null; reason: string | null } {
  const sep = " · ";
  const idx = line.indexOf(sep);
  if (idx !== -1) {
    const left = line.slice(0, idx).trim();
    const right = line.slice(idx + sep.length).trim();
    const m = left.match(/^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/);
    if (m) return { range: compactTimeRangeFromParts(m[1]!, m[2]!), reason: right || null };
    return { range: null, reason: line.trim() || null };
  }
  const trimmed = line.trim();
  const m = trimmed.match(/^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/);
  if (m) return { range: compactTimeRangeFromParts(m[1]!, m[2]!), reason: null };
  return { range: null, reason: trimmed || null };
}

function unavailableBadgeCopy(u: EmployeeDayUnavailableDisplay): { primary: string; secondary: string | null } {
  const parsed = u.details.map(parseUnavailableDetailLine);
  const ranges = parsed.map((p) => p.range).filter((r): r is string => Boolean(r));
  const reasons = new Set<string>();
  for (const p of parsed) {
    if (p.reason) reasons.add(p.reason);
  }
  const reasonStr = reasons.size > 0 ? [...reasons].join(" · ") : null;

  if (u.blocksWholeDay) {
    return { primary: "Hele dagen", secondary: reasonStr };
  }
  if (ranges.length > 0) {
    return { primary: ranges.join(", "), secondary: reasonStr };
  }
  if (reasonStr) {
    return { primary: reasonStr, secondary: null };
  }
  return { primary: "Utilgjengelig", secondary: null };
}

function Avatar({ name, gradient }: { name: string; gradient: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "grid size-9 place-items-center rounded-full bg-gradient-to-br text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-white/60",
        gradient,
      )}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  );
}

function ProgressBar({
  value,
  status,
}: {
  value: number;
  status: EmployeeComputed["computedStatus"];
}) {
  const bar = status === "normal" ? "bg-emerald-400" : status === "near_limit" ? "bg-amber-400" : "bg-rose-500";
  const track = status === "normal" ? "bg-emerald-100" : status === "near_limit" ? "bg-amber-100" : "bg-rose-100";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full", track)}>
      <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(value, 1) * 100}%` }} />
    </div>
  );
}

export function EmployeeRow({
  employee,
  weekOffset,
  daysCount,
  shiftsByDay,
  onOpenEmployee,
  onOpenSuggestions,
  suggestionsEnabled = true,
  onRequireStoreSelection,
  onShiftClick,
  dayCellClassName,
  conflictShiftIds,
}: {
  employee: EmployeeComputed;
  /** Same `weekOffset` as Planlegg / shifts for calendar-based unavailability. */
  weekOffset: number;
  daysCount: number;
  shiftsByDay: Shift[][];
  onOpenEmployee?: (employeeId: string) => void;
  onOpenSuggestions: (originEmployeeId: string, day: number, anchorRect: DOMRect) => void;
  suggestionsEnabled?: boolean;
  onRequireStoreSelection?: () => void;
  onShiftClick: (shift: Shift) => void;
  dayCellClassName: (day: number) => string;
  conflictShiftIds?: Set<string>;
}) {
  return (
    <>
      {/* Employee cell (compact) */}
      <div className="px-3 py-2.5">
        <div
          role={onOpenEmployee ? "button" : undefined}
          tabIndex={onOpenEmployee ? 0 : undefined}
          onClick={() => onOpenEmployee?.(employee.id)}
          onKeyDown={(e) => {
            if (!onOpenEmployee) return;
            if (e.key === "Enter" || e.key === " ") onOpenEmployee(employee.id);
          }}
          className={cn(
            "flex items-center gap-3 rounded-2xl px-1.5 py-1.5",
            onOpenEmployee && "cursor-pointer hover:bg-slate-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200",
          )}
          aria-label={onOpenEmployee ? `Åpne ${employee.name}` : undefined}
        >
          <Avatar name={employee.name} gradient={employee.avatarBg} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-[13.5px] font-semibold text-slate-900">{employee.name}</div>
            </div>
            <div className="mt-1 text-[12px] text-slate-500">{employee.contractLabel}</div>
            <div className="mt-2 max-w-[160px]">
              <ProgressBar value={employee.progress} status={employee.computedStatus} />
            </div>
          </div>

          {employee.computedStatus === "over_limit" ? (
            <div
              className="grid size-7 place-items-center rounded-full bg-rose-50 text-rose-500 ring-1 ring-rose-100"
              title="Over kontrakt"
              aria-label="Over kontrakt"
            >
              !
            </div>
          ) : null}
        </div>
      </div>

      {/* Day cells */}
      {Array.from({ length: daysCount }).map((_, day) => {
        const cellShifts = shiftsByDay[day] ?? [];
        const hasFri = cellShifts.some((s) => isShiftOff(s));
        const u = getEmployeeDayUnavailableDisplay(employee, weekOffset, day);
        const dropDisabled = hasFri || u.blocksWholeDay;
        const isEmpty = cellShifts.length === 0;
        const unavailableBadge = u.showUnavailableChip ? unavailableBadgeCopy(u) : null;

        return (
          <DroppableDayCell
            key={`${employee.id}-${day}`}
            id={cellId(employee.id, day)}
            disabled={dropDisabled}
            className={cn(
              "min-h-[58px] px-2.5 py-2",
              u.blocksWholeDay && "opacity-70",
              dayCellClassName(day),
            )}
          >
            <div
              className={cn(
                "group relative flex h-full min-h-0 w-full flex-col",
                !dropDisabled && isEmpty && suggestionsEnabled && "cursor-pointer",
              )}
              onClick={(e) => {
                if (dropDisabled) return;
                if (!isEmpty) return;
                if (!suggestionsEnabled) {
                  onRequireStoreSelection?.();
                  return;
                }
                onOpenSuggestions(employee.id, day, (e.currentTarget as HTMLDivElement).getBoundingClientRect());
              }}
            >
              {cellShifts.length > 0 ? (
                <div className="flex shrink-0 flex-col gap-1">
                  {cellShifts.map((s) => (
                    <DraggableShiftChip key={s.id} shift={s} onClick={onShiftClick} hasAlert={Boolean(conflictShiftIds?.has(s.id))} />
                  ))}
                </div>
              ) : null}

              {unavailableBadge ? (
                <div
                  className={cn(
                    "w-full",
                    cellShifts.length > 0 ? "mt-1.5 shrink-0" : "flex min-h-[2rem] flex-1 flex-col justify-center",
                  )}
                >
                  <div
                    className={cn(
                      "mx-auto w-full max-w-[11rem] rounded-lg border border-slate-200/70 bg-gradient-to-b from-slate-50/90 to-indigo-50/35 px-1.5 py-1 text-center shadow-none",
                      cellShifts.length === 0 && "self-center",
                    )}
                  >
                    <div className="text-[10.5px] font-medium leading-tight tracking-tight text-slate-500">{unavailableBadge.primary}</div>
                    {unavailableBadge.secondary ? (
                      <div className="mt-0.5 truncate text-[9px] font-normal leading-tight text-slate-400">{unavailableBadge.secondary}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!dropDisabled && isEmpty && suggestionsEnabled ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-3 py-2 text-[12px] font-semibold text-slate-500 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                    Foreslå
                  </div>
                </div>
              ) : null}
            </div>
          </DroppableDayCell>
        );
      })}
    </>
  );
}

