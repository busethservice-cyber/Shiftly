"use client";

import { useEffect, useState } from "react";
import type { Shift } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";

export function CopyShiftModal({
  open,
  shift,
  weekDays,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  shift: Shift | null;
  weekDays: Array<{ day: number; label: string }>;
  onConfirm: (targetDays: number[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  if (!open || !shift) return null;

  function toggle(day: number) {
    if (day === shift!.day) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[95]">
      <button type="button" onClick={onCancel} className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px]" aria-label="Lukk" />

      <div className="absolute left-1/2 top-1/2 w-[min(100vw-2rem,400px)] -translate-x-1/2 -translate-y-1/2 p-4">
        <div className="rounded-[28px] bg-white/95 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.06] backdrop-blur">
          <div className="text-[15px] font-semibold text-slate-900">Kopier vakt</div>
          <div className="mt-2 text-[12.5px] font-medium text-slate-600">
            Velg én eller flere dager å kopiere vakten til.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {weekDays.map((d) => {
              const isSource = d.day === shift.day;
              const active = selected.has(d.day);
              return (
                <button
                  key={d.day}
                  type="button"
                  disabled={isSource}
                  onClick={() => toggle(d.day)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition-colors",
                    isSource && "cursor-not-allowed bg-slate-100 text-slate-400 ring-slate-200",
                    !isSource && active && "bg-violet-100 text-violet-900 ring-violet-200",
                    !isSource && !active && "bg-white/80 text-slate-700 ring-slate-900/[0.06] hover:bg-violet-50",
                  )}
                >
                  {d.label}
                  {isSource ? " (kilde)" : ""}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => onConfirm([...selected])}
              className={cn(
                "flex-1 rounded-2xl bg-violet-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500",
                selected.size === 0 && "cursor-not-allowed opacity-50",
              )}
            >
              Kopier{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
