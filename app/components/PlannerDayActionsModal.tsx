"use client";

import { useEffect, useState } from "react";
import { cn } from "@/app/lib/cn";

export type PlannerDayActionMode = "copy_day" | "clear_day";

export function PlannerDayActionsModal({
  open,
  mode,
  weekDays,
  shiftCount,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  mode: PlannerDayActionMode;
  weekDays: Array<{ day: number; label: string }>;
  shiftCount: (day: number) => number;
  onConfirm: (sourceDay: number, targetDays: number[]) => void;
  onCancel: () => void;
}) {
  const [sourceDay, setSourceDay] = useState(0);
  const [targetDays, setTargetDays] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) {
      setSourceDay(0);
      setTargetDays(new Set());
    }
  }, [open]);

  if (!open) return null;

  const isCopy = mode === "copy_day";
  const title = isCopy ? "Kopier dag" : "Fjern vakter";
  const description = isCopy
    ? "Kopier alle vakter fra én dag til andre dager denne uken."
    : "Fjern alle vakter for valgt dag i gjeldende filter.";

  function toggleTarget(day: number) {
    if (isCopy && day === sourceDay) return;
    setTargetDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function handleConfirm() {
    if (isCopy) {
      if (targetDays.size === 0) return;
      onConfirm(sourceDay, [...targetDays]);
      return;
    }
    onConfirm(sourceDay, [sourceDay]);
  }

  const canConfirm = isCopy ? targetDays.size > 0 : shiftCount(sourceDay) > 0;

  return (
    <div className="fixed inset-0 z-[95]">
      <button type="button" onClick={onCancel} className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px]" aria-label="Lukk" />

      <div className="absolute left-1/2 top-1/2 w-[min(100vw-2rem,420px)] -translate-x-1/2 -translate-y-1/2 p-4">
        <div className="rounded-[28px] bg-white/95 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.06] backdrop-blur">
          <div className="text-[15px] font-semibold text-slate-900">{title}</div>
          <div className="mt-2 text-[12.5px] font-medium text-slate-600">{description}</div>

          <div className="mt-4">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
              {isCopy ? "Kopier fra" : "Velg dag"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {weekDays.map((d) => (
                <button
                  key={`src-${d.day}`}
                  type="button"
                  onClick={() => {
                    setSourceDay(d.day);
                    if (isCopy) {
                      setTargetDays((prev) => {
                        const next = new Set(prev);
                        next.delete(d.day);
                        return next;
                      });
                    }
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1",
                    sourceDay === d.day
                      ? "bg-violet-100 text-violet-900 ring-violet-200"
                      : "bg-white/80 text-slate-700 ring-slate-900/[0.06] hover:bg-violet-50",
                  )}
                >
                  {d.label} ({shiftCount(d.day)})
                </button>
              ))}
            </div>
          </div>

          {isCopy ? (
            <div className="mt-4">
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">Kopier til</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {weekDays.map((d) => {
                  const isSource = d.day === sourceDay;
                  const active = targetDays.has(d.day);
                  return (
                    <button
                      key={`tgt-${d.day}`}
                      type="button"
                      disabled={isSource}
                      onClick={() => toggleTarget(d.day)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1",
                        isSource && "cursor-not-allowed bg-slate-100 text-slate-400 ring-slate-200",
                        !isSource && active && "bg-violet-100 text-violet-900 ring-violet-200",
                        !isSource && !active && "bg-white/80 text-slate-700 ring-slate-900/[0.06] hover:bg-violet-50",
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-rose-50/70 px-3 py-2.5 text-[12.5px] font-medium text-rose-900 ring-1 ring-rose-100">
              {shiftCount(sourceDay) > 0
                ? `${shiftCount(sourceDay)} vakt${shiftCount(sourceDay) === 1 ? "" : "er"} fjernes permanent for denne dagen.`
                : "Ingen vakter å fjerne for valgt dag."}
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className={cn(
                "flex-1 rounded-2xl px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)]",
                isCopy ? "bg-violet-600 hover:bg-violet-500" : "bg-rose-600 hover:bg-rose-500",
                !canConfirm && "cursor-not-allowed opacity-50",
              )}
            >
              {isCopy ? "Kopier dag" : "Fjern vakter"}
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
