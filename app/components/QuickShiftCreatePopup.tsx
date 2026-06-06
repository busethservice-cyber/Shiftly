"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type { ShiftTemplate } from "@/app/lib/settings";
import { cn } from "@/app/lib/cn";
import { TimePickerField } from "@/app/components/TimePickerField";
import { CalendarPlus } from "lucide-react";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function QuickShiftCreatePopup({
  open,
  anchorRect,
  employeeName,
  dayLabel,
  storeName,
  shiftTemplates,
  defaultStartTime,
  defaultEndTime,
  onPickTemplate,
  onCreateCustom,
  onClose,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  employeeName: string;
  dayLabel: string;
  storeName: string;
  shiftTemplates: ShiftTemplate[];
  defaultStartTime: string;
  defaultEndTime: string;
  onPickTemplate: (tpl: ShiftTemplate) => void;
  onCreateCustom: (startTime: string, endTime: string) => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [showCustom, setShowCustom] = useState(false);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);

  useEffect(() => {
    if (!open) {
      setShowCustom(false);
      setStartTime(defaultStartTime);
      setEndTime(defaultEndTime);
    }
  }, [open, defaultStartTime, defaultEndTime]);

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
    const w = 280;
    const h = 320;
    const margin = 12;
    let left = anchorRect.left + anchorRect.width / 2 - w / 2;
    left = clamp(left, margin, window.innerWidth - w - margin);
    let top = anchorRect.bottom + 8;
    if (top + h > window.innerHeight - margin) {
      top = Math.max(margin, anchorRect.top - h - 8);
    }
    setPos({ top, left });
  }, [anchorRect, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-transparent" aria-label="Lukk" />

      <div
        className="fixed w-[280px] overflow-hidden rounded-2xl bg-white/95 p-4 shadow-[0_22px_50px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.06] backdrop-blur"
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-label="Opprett vakt"
      >
        <div className="flex items-start gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
            <CalendarPlus className="size-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-slate-900">Ny vakt</div>
            <div className="mt-0.5 truncate text-[12px] font-medium text-slate-600">{employeeName}</div>
            <div className="text-[11.5px] font-medium text-slate-500">
              {dayLabel} · {storeName}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {shiftTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onPickTemplate(tpl)}
              className="flex w-full items-center justify-between rounded-2xl bg-[#F6F8FC]/90 px-3.5 py-2.5 text-left shadow-[0_8px_18px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05] transition-colors hover:bg-violet-50/80 hover:ring-violet-100"
            >
              <span className="text-[13px] font-semibold text-slate-900">{tpl.name}</span>
              <span className="text-[12px] font-medium text-slate-500">
                {tpl.startTime}–{tpl.endTime}
              </span>
            </button>
          ))}

          {!showCustom ? (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="flex w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 px-3.5 py-2.5 text-[13px] font-semibold text-slate-600 hover:border-violet-200 hover:bg-violet-50/40 hover:text-violet-800"
            >
              Egendefinert
            </button>
          ) : (
            <div className="rounded-2xl bg-[#F6F8FC]/90 p-3 ring-1 ring-slate-900/[0.05]">
              <div className="grid grid-cols-2 gap-3">
                <TimePickerField label="Start" value={startTime} onChange={setStartTime} />
                <TimePickerField label="Slutt" value={endTime} onChange={setEndTime} />
              </div>
              <button
                type="button"
                onClick={() => onCreateCustom(startTime, endTime)}
                className={cn(
                  "mt-3 w-full rounded-2xl bg-violet-600 px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(124,58,237,0.25)] hover:bg-violet-500",
                )}
              >
                Opprett vakt
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
