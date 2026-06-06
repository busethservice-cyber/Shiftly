"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { Employee, Shift } from "@/app/lib/types";
import type { ShiftTemplate } from "@/app/lib/settings";
import { cn } from "@/app/lib/cn";
import { TimePickerField } from "@/app/components/TimePickerField";
import { Pencil } from "lucide-react";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function QuickShiftEditPopup({
  open,
  anchorRect,
  shift,
  employees,
  shiftTemplates,
  onSave,
  onMoreOptions,
  onClose,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  shift: Shift | null;
  employees: Employee[];
  shiftTemplates: ShiftTemplate[];
  onSave: (updated: Shift) => void;
  onMoreOptions: (shift: Shift) => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [employeeId, setEmployeeId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (!shift) return;
    setEmployeeId(shift.employeeId);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
  }, [shift]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !anchorRect) return;
    const w = 300;
    const h = 380;
    const margin = 12;
    let left = anchorRect.left + anchorRect.width / 2 - w / 2;
    left = clamp(left, margin, window.innerWidth - w - margin);
    let top = anchorRect.bottom + 8;
    if (top + h > window.innerHeight - margin) {
      top = Math.max(margin, anchorRect.top - h - 8);
    }
    setPos({ top, left });
  }, [anchorRect, open]);

  const employeeName = useMemo(
    () => employees.find((e) => e.id === employeeId)?.name ?? "Ansatt",
    [employeeId, employees],
  );

  if (!open || !shift) return null;

  function applyTemplate(tpl: ShiftTemplate) {
    setStartTime(tpl.startTime);
    setEndTime(tpl.endTime);
  }

  function handleSave() {
    if (!shift) return;
    onSave({ ...shift, employeeId, startTime, endTime });
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-transparent" aria-label="Lukk" />

      <div
        className="fixed w-[300px] overflow-hidden rounded-2xl bg-white/95 p-4 shadow-[0_22px_50px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.06] backdrop-blur"
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-label="Rediger vakt"
      >
        <div className="flex items-start gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
            <Pencil className="size-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-slate-900">Rediger vakt</div>
            <div className="mt-0.5 text-[12px] font-medium text-slate-600">{employeeName}</div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="text-[11.5px] font-semibold text-slate-600">Ansatt</div>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1.5 w-full rounded-2xl bg-white/80 px-3 py-2 text-[13px] font-medium text-slate-900 ring-1 ring-slate-900/[0.06] focus:outline-none focus:ring-2 focus:ring-violet-200"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          {shiftTemplates.length > 0 ? (
            <div>
              <div className="text-[11.5px] font-semibold text-slate-600">Standardvakt</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {shiftTemplates.map((tpl) => {
                  const active = startTime === tpl.startTime && endTime === tpl.endTime;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                        active
                          ? "bg-violet-100 text-violet-900 ring-violet-200"
                          : "bg-white/80 text-slate-700 ring-slate-900/[0.06] hover:bg-violet-50",
                      )}
                    >
                      {tpl.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <TimePickerField label="Start" value={startTime} onChange={setStartTime} />
            <TimePickerField label="Slutt" value={endTime} onChange={setEndTime} />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-2xl bg-violet-600 px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(124,58,237,0.25)] hover:bg-violet-500"
          >
            Lagre
          </button>
          <button
            type="button"
            onClick={() => onMoreOptions({ ...shift!, employeeId, startTime, endTime })}
            className="w-full rounded-2xl bg-white/80 px-3 py-2 text-[12.5px] font-semibold text-violet-700 ring-1 ring-violet-100 hover:bg-violet-50"
          >
            Flere valg
          </button>
        </div>
      </div>
    </div>
  );
}
