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

function LegendDot({ color }: { color: string }) {
  return <span className={cn("inline-block size-2.5 rounded-full", color)} />;
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
  onRequireStoreSelection,
  onShiftClick,
  onMoveShift,
}: {
  days: Array<{ short: string; date: string; dateObj: Date }>;
  /** Week index aligned with `shift.week` (Planlegg). */
  weekOffset: number;
  employees: EmployeeComputed[];
  shifts: Shift[];
  conflictShiftIds?: Set<string>;
  onOpenEmployee?: (employeeId: string) => void;
  onOpenSuggestions: (originEmployeeId: string, day: number, anchorRect: DOMRect) => void;
  suggestionsEnabled?: boolean;
  onRequireStoreSelection?: () => void;
  onShiftClick: (shift: Shift) => void;
  onMoveShift: (shiftId: string, nextEmployeeId: string, nextDay: number) => void;
}) {
  const today = getToday();
  const shiftsByEmployeeDay = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = `${s.employeeId}:${s.day}`;
    const list = shiftsByEmployeeDay.get(key) ?? [];
    list.push(s);
    shiftsByEmployeeDay.set(key, list);
  }

  const dayCellClassName = (day: number) => (day !== days.length - 1 ? "border-r border-slate-900/[0.04]" : "");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const dndContextId = useId();

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (!overId) return;
    const parsed = parseCellId(String(overId));
    if (!parsed) return;
    onMoveShift(String(event.active.id), parsed.employeeId, parsed.day);
  }

  return (
    <section className="mt-6 rounded-[34px] bg-white/80 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
      <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {/* Grid header */}
        <div className="grid items-end gap-0" style={{ gridTemplateColumns: "248px repeat(7, minmax(0, 1fr))" }}>
          <div className="px-4 pb-3 text-[12px] font-semibold text-slate-500">Navn</div>
          {days.map((d, idx) => (
            <div key={d.short} className={cn("px-3 pb-3 text-center", dayCellClassName(idx))}>
              <div
                className={cn(
                  "mx-auto inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[12px] font-semibold text-slate-600",
                  isSameDay(d.dateObj, today) && "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
                )}
              >
                {d.short} <span className="ml-1 font-semibold text-slate-400">{d.date}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="mt-2 overflow-hidden rounded-[28px] bg-white ring-1 ring-slate-900/[0.04]">
          {employees.map((emp, rowIdx) => {
            const rowBorder = rowIdx !== employees.length - 1 ? "border-b border-slate-900/[0.04]" : "";

            const shiftsByDay: Shift[][] = Array.from({ length: days.length }, (_, day) => {
              const key = `${emp.id}:${day}`;
              return shiftsByEmployeeDay.get(key) ?? [];
            });

            return (
              <div
                key={emp.id}
                className={cn("grid", rowBorder)}
                style={{ gridTemplateColumns: "248px repeat(7, minmax(0, 1fr))" }}
              >
                <EmployeeRow
                  employee={emp}
                  weekOffset={weekOffset}
                  daysCount={days.length}
                  shiftsByDay={shiftsByDay}
                  dayCellClassName={dayCellClassName}
                  onOpenEmployee={onOpenEmployee}
                  onOpenSuggestions={onOpenSuggestions}
                  suggestionsEnabled={suggestionsEnabled}
                  onRequireStoreSelection={onRequireStoreSelection}
                  onShiftClick={onShiftClick}
                  conflictShiftIds={conflictShiftIds}
                />
              </div>
            );
          })}
        </div>
      </DndContext>

      {/* Legend */}
      <div className="mt-5 rounded-3xl bg-[#F6F8FC] px-5 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-slate-600">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <LegendDot color={getStatusPalette("normal").dotClass} />
              <span>Innenfor kontrakt</span>
            </div>
            <div className="flex items-center gap-2">
              <LegendDot color={getStatusPalette("near_limit").dotClass} />
              <span>Nær grense</span>
            </div>
            <div className="flex items-center gap-2">
              <LegendDot color={getStatusPalette("over_limit").dotClass} />
              <span>Over kontrakt</span>
            </div>
            <div className="flex items-center gap-2">
              <LegendDot color={getStatusPalette("unconfirmed").dotClass} />
              <span>Ubekreftet</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <span className="inline-block size-2.5 rounded-full border border-dashed border-slate-300" />
            <span>Dra og slipp for å flytte vakter</span>
          </div>
        </div>
      </div>
    </section>
  );
}

