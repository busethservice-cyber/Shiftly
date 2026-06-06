"use client";

import type { EmployeeComputed, Shift } from "@/app/lib/types";
import { isShiftOff } from "@/app/lib/hours";
import { getEmployeeDayUnavailableDisplay, type EmployeeDayUnavailableDisplay } from "@/app/lib/rules/shifts";
import {
  getUnavailabilityChipStyle,
  unavailabilityPrimaryTextClass,
} from "@/app/lib/unavailabilityColors";
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

function unavailableBadgeCopy(u: EmployeeDayUnavailableDisplay): {
  label: string;
  tooltip: string;
  style: ReturnType<typeof getUnavailabilityChipStyle>;
} {
  const primaryEntry = u.entries[0];
  const reason = (u.primaryReason || primaryEntry?.reason || "Utilgjengelig").trim();
  const style = getUnavailabilityChipStyle({
    reason,
    wholeDay: u.blocksWholeDay || Boolean(primaryEntry?.wholeDay),
    isRecurring: primaryEntry?.isRecurring,
  });

  const parsed = u.details.map(parseUnavailableDetailLine);
  const ranges = parsed.map((p) => p.range).filter((r): r is string => Boolean(r));
  const reasons = new Set<string>();
  const notes = new Set<string>();
  for (const e of u.entries) {
    if (e.reason) reasons.add(e.reason);
    if (e.note) notes.add(e.note);
  }
  for (const p of parsed) {
    if (p.reason) reasons.add(p.reason);
  }
  const reasonStr = reasons.size > 0 ? [...reasons].join(" · ") : null;
  const noteStr = notes.size > 0 ? [...notes].join(" · ") : null;
  const wholeDay = u.blocksWholeDay || Boolean(primaryEntry?.wholeDay);
  const timeRange = ranges.length === 1 ? ranges[0]! : ranges.length > 1 ? ranges.join(", ") : null;

  let label: string;
  if (reason === "Fri" && wholeDay) {
    label = "Fri hele dagen";
  } else if (wholeDay) {
    label = reason === "Annet" ? "Utilgjengelig" : reason;
  } else if (timeRange) {
    label = `${reason} ${timeRange}`;
  } else {
    label = reason;
  }

  const tooltipParts: string[] = [];
  if (reasonStr) tooltipParts.push(reasonStr);
  if (timeRange) tooltipParts.push(timeRange);
  else if (primaryEntry?.startTime && primaryEntry?.endTime) {
    tooltipParts.push(`${primaryEntry.startTime}–${primaryEntry.endTime}`);
  }
  if (wholeDay) tooltipParts.push("Hele dagen");
  if (noteStr) tooltipParts.push(noteStr);
  const tooltip = tooltipParts.filter(Boolean).join(" · ") || label;

  return { label, tooltip, style };
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
  dragEnabled = true,
  onRequireStoreSelection,
  onShiftClick,
  onShiftContextMenu,
  showStoreOnShifts,
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
  dragEnabled?: boolean;
  onRequireStoreSelection?: () => void;
  onShiftClick: (shift: Shift, anchorRect: DOMRect) => void;
  onShiftContextMenu?: (shift: Shift, x: number, y: number) => void;
  showStoreOnShifts?: boolean;
  dayCellClassName: (day: number) => string;
  conflictShiftIds?: Set<string>;
}) {
  return (
    <>
      {/* Employee cell (compact) */}
      <div className="px-2 py-2">
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
              "min-h-[52px] px-1 py-1",
              u.blocksWholeDay && "opacity-75",
              dayCellClassName(day),
            )}
          >
            <div
              className={cn(
                "group/cell relative flex h-full min-h-0 w-full flex-col rounded-md transition-colors",
                !dropDisabled && isEmpty && suggestionsEnabled && "cursor-pointer hover:bg-slate-50/80",
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
                <div className="flex w-full min-w-0 shrink-0 flex-col gap-1">
                  {cellShifts.map((s) => (
                    <DraggableShiftChip
                      key={s.id}
                      shift={s}
                      employeeName={employee.name}
                      showStoreName={showStoreOnShifts}
                      onClick={onShiftClick}
                      onContextMenu={onShiftContextMenu}
                      hasAlert={Boolean(conflictShiftIds?.has(s.id))}
                      dragEnabled={dragEnabled}
                    />
                  ))}
                </div>
              ) : null}

              {unavailableBadge ? (
                <div
                  className={cn(
                    "w-full min-w-0",
                    cellShifts.length > 0 ? "mt-0.5 shrink-0" : "flex flex-1 items-center justify-center",
                  )}
                >
                  <div
                    title={unavailableBadge.tooltip}
                    className={cn(
                      "w-full max-w-full truncate rounded-md px-1 py-0.5 text-center ring-1 ring-inset",
                      unavailableBadge.style.container,
                    )}
                  >
                    <div
                      className={cn(
                        "truncate text-[8.5px] font-semibold leading-tight",
                        unavailabilityPrimaryTextClass(unavailableBadge.style),
                      )}
                    >
                      {unavailableBadge.label}
                    </div>
                  </div>
                </div>
              ) : null}

              {!dropDisabled && isEmpty && suggestionsEnabled ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/cell:opacity-100">
                  <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 ring-1 ring-slate-200/80">
                    +
                  </span>
                </div>
              ) : null}
            </div>
          </DroppableDayCell>
        );
      })}
    </>
  );
}

