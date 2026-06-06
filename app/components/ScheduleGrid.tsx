"use client";

import { useId } from "react";
import type { EmployeeComputed, Shift } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";
import { EmployeeRow } from "@/app/components/EmployeeRow";
import { getToday, isSameDay } from "@/app/lib/dateUtils";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { parseCellId } from "@/app/components/DroppableDayCell";
import { getStatusPalette } from "@/app/lib/statusColors";
import type { StaffingLevel } from "@/app/lib/rules/staffing";

const GRID_COLS = "220px repeat(7, minmax(0, 1fr))";

function LegendDot({ color }: { color: string }) {
  return <span className={cn("inline-block size-2 rounded-full", color)} />;
}

function StaffingBadge({ level }: { level: StaffingLevel }) {
  if (level === "understaffed") {
    return (
      <span
        className="inline-flex max-w-full items-center gap-0.5 truncate rounded-full bg-rose-50 px-1.5 py-0.5 text-[8.5px] font-semibold leading-none text-rose-800 ring-1 ring-rose-100"
        title="Underbemannet"
      >
        <span className="size-1 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
        Under
      </span>
    );
  }
  if (level === "overstaffed") {
    return (
      <span
        className="inline-flex max-w-full items-center gap-0.5 truncate rounded-full bg-sky-50 px-1.5 py-0.5 text-[8.5px] font-semibold leading-none text-sky-900 ring-1 ring-sky-100"
        title="Overbemannet"
      >
        <span className="size-1 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
        Over
      </span>
    );
  }
  return (
    <span
      className="inline-flex max-w-full items-center gap-0.5 truncate rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8.5px] font-semibold leading-none text-emerald-800 ring-1 ring-emerald-100"
      title="Fullt bemannet"
    >
      <span className="size-1 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
      Fullt
    </span>
  );
}

export function ScheduleGrid({
  days,
  weekOffset,
  employees,
  shifts,
  conflictShiftIds,
  onOpenEmployee,
  onOpenSuggestions,
  suggestionsEnabled = true,
  dragEnabled = true,
  onRequireStoreSelection,
  onShiftClick,
  onShiftContextMenu,
  showStoreOnShifts,
  onMoveShift,
  staffingByDay,
}: {
  days: Array<{ short: string; date: string; dateObj: Date }>;
  weekOffset: number;
  employees: EmployeeComputed[];
  shifts: Shift[];
  conflictShiftIds?: Set<string>;
  onOpenEmployee?: (employeeId: string) => void;
  onOpenSuggestions: (originEmployeeId: string, day: number, anchorRect: DOMRect) => void;
  suggestionsEnabled?: boolean;
  dragEnabled?: boolean;
  onRequireStoreSelection?: () => void;
  onShiftClick: (shift: Shift, anchorRect: DOMRect) => void;
  onShiftContextMenu?: (shift: Shift, x: number, y: number) => void;
  showStoreOnShifts?: boolean;
  onMoveShift: (shiftId: string, nextEmployeeId: string, nextDay: number) => void;
  staffingByDay?: Array<StaffingLevel | null>;
}) {
  const today = getToday();
  const shiftsByEmployeeDay = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = `${s.employeeId}:${s.day}`;
    const list = shiftsByEmployeeDay.get(key) ?? [];
    list.push(s);
    shiftsByEmployeeDay.set(key, list);
  }

  const dayCellClassName = (day: number) =>
    day !== days.length - 1 ? "border-r border-slate-200/70" : "";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const dndContextId = useId();

  function onDragEnd(event: DragEndEvent) {
    if (!dragEnabled) return;
    const overId = event.over?.id;
    if (!overId) return;
    const parsed = parseCellId(String(overId));
    if (!parsed) return;
    onMoveShift(String(event.active.id), parsed.employeeId, parsed.day);
  }

  return (
    <section className="mt-5 overflow-hidden rounded-2xl bg-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80">
      <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {/* Header row */}
        <div
          className="grid border-b border-slate-200/80 bg-slate-50/50"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div className="flex items-end px-3 pb-2.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Navn
          </div>
          {days.map((d, idx) => {
            const staff = staffingByDay?.[idx] ?? null;
            const isToday = isSameDay(d.dateObj, today);
            return (
              <div
                key={d.short}
                className={cn("flex min-w-0 flex-col items-center gap-0.5 px-1 pb-2.5 pt-2.5", dayCellClassName(idx))}
              >
                <div
                  className={cn(
                    "flex w-full min-w-0 max-w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1",
                    isToday && "bg-violet-50 ring-1 ring-violet-100",
                  )}
                >
                  <span className="text-[11px] font-semibold leading-none text-slate-800">{d.short}</span>
                  <span className="truncate text-[10px] font-medium leading-none text-slate-500">{d.date}</span>
                  {staff ? <StaffingBadge level={staff} /> : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Body rows */}
        <div>
          {employees.map((emp, rowIdx) => {
            const rowBorder = rowIdx !== employees.length - 1 ? "border-b border-slate-200/60" : "";
            const shiftsByDay: Shift[][] = Array.from({ length: days.length }, (_, day) => {
              const key = `${emp.id}:${day}`;
              return shiftsByEmployeeDay.get(key) ?? [];
            });

            return (
              <div key={emp.id} className={cn("grid hover:bg-slate-50/20", rowBorder)} style={{ gridTemplateColumns: GRID_COLS }}>
                <EmployeeRow
                  employee={emp}
                  weekOffset={weekOffset}
                  daysCount={days.length}
                  shiftsByDay={shiftsByDay}
                  dayCellClassName={dayCellClassName}
                  onOpenEmployee={onOpenEmployee}
                  onOpenSuggestions={onOpenSuggestions}
                  suggestionsEnabled={suggestionsEnabled}
                  dragEnabled={dragEnabled}
                  onRequireStoreSelection={onRequireStoreSelection}
                  onShiftClick={onShiftClick}
                  onShiftContextMenu={onShiftContextMenu}
                  showStoreOnShifts={showStoreOnShifts}
                  conflictShiftIds={conflictShiftIds}
                />
              </div>
            );
          })}
        </div>
      </DndContext>

      {/* Legend */}
      <div className="border-t border-slate-200/70 bg-[#F8FAFC]/80 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <LegendDot color={getStatusPalette("normal").dotClass} />
              Innenfor
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LegendDot color={getStatusPalette("near_limit").dotClass} />
              Nær grense
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LegendDot color={getStatusPalette("over_limit").dotClass} />
              Over
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LegendDot color="bg-violet-400" />
              Ferie
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LegendDot color="bg-slate-600" />
              Syk
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
            {staffingByDay ? (
              <>
                <StaffingBadge level="understaffed" />
                <StaffingBadge level="ok" />
                <StaffingBadge level="overstaffed" />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
