"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/app/lib/cn";
import { addWeeks, formatWeekLabel, getToday, getWeekStart, isDateInWeek, isSameDay } from "@/app/lib/dateUtils";

export type WeekNavigatorProps = {
  weekStartDate: Date;
  onWeekChange: (newWeekStartDate: Date) => void;
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function mondayIndexFromJsDay(jsDay: number) {
  return (jsDay + 6) % 7; // 0=Mon .. 6=Sun
}

function calendarCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = mondayIndexFromJsDay(first.getDay());
  const total = daysInMonth(year, month);
  const cells: Array<{ day: number; date: Date | null }> = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: 0, date: null });
  for (let d = 1; d <= total; d++) cells.push({ day: d, date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({ day: 0, date: null });
  return cells;
}

export function WeekNavigator({ weekStartDate, onWeekChange }: WeekNavigatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const today = useMemo(() => getToday(), []);
  const selectedWeekStart = useMemo(() => getWeekStart(weekStartDate), [weekStartDate]);

  const [pickerMonth, setPickerMonth] = useState<number>(() => selectedWeekStart.getMonth());
  const [pickerYear, setPickerYear] = useState<number>(() => selectedWeekStart.getFullYear());

  useEffect(() => {
    if (!isOpen) return;
    setPickerMonth(selectedWeekStart.getMonth());
    setPickerYear(selectedWeekStart.getFullYear());
  }, [isOpen, selectedWeekStart]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    function onMouseDown(e: MouseEvent) {
      if (!isOpen) return;
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setIsOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [isOpen]);

  return (
    <>
      <div className="flex items-center gap-2 rounded-2xl bg-white/70 p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
        <button
          type="button"
          className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-50"
          aria-label="Forrige uke"
          onClick={() => onWeekChange(addWeeks(selectedWeekStart, -1))}
        >
          <ChevronLeft className="size-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => onWeekChange(getWeekStart(getToday()))}
          className="rounded-xl bg-white/70 px-3 py-2 text-[12.5px] font-semibold text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
        >
          I dag
        </button>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-50"
          aria-label="Neste uke"
          onClick={() => onWeekChange(addWeeks(selectedWeekStart, 1))}
        >
          <ChevronRight className="size-[18px]" />
        </button>
      </div>

      <div className="relative" ref={rootRef}>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
        >
          {formatWeekLabel(selectedWeekStart)}
        </button>

        {isOpen ? (
          <div
            role="dialog"
            aria-label="Velg dato"
            className="absolute left-0 top-[calc(100%+10px)] z-50 w-[280px] rounded-[22px] bg-white/90 p-4 shadow-[0_28px_70px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.06] backdrop-blur"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-semibold text-slate-600">Velg dato</div>
              <button
                type="button"
                onClick={() => {
                  onWeekChange(getWeekStart(getToday()));
                  setIsOpen(false);
                }}
                className="rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm"
              >
                I dag
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <select
                value={pickerMonth}
                onChange={(e) => setPickerMonth(Number(e.target.value))}
                className="w-full rounded-2xl bg-white/85 px-3 py-2.5 text-[12.5px] font-semibold text-slate-800 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-200"
                aria-label="Måned"
              >
                {["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"].map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={pickerYear}
                onChange={(e) => setPickerYear(Number(e.target.value))}
                className="w-[104px] rounded-2xl bg-white/85 px-3 py-2.5 text-[12.5px] font-semibold text-slate-800 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-200"
                aria-label="År"
              >
                {Array.from({ length: 7 }, (_, i) => {
                  const y = getToday().getFullYear() - 3 + i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1">
              {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((d) => (
                <div key={d} className="pb-1 text-center text-[10px] font-semibold text-slate-500">
                  {d}
                </div>
              ))}

              {calendarCells(pickerYear, pickerMonth).map((c, idx) => {
                if (!c.date) return <div key={`pad-${pickerYear}-${pickerMonth}-${idx}`} className="h-9" aria-hidden />;
                const inWeek = isDateInWeek(c.date, selectedWeekStart);
                const isToday = isSameDay(c.date, today);
                return (
                  <button
                    key={`${idx}-${c.date!.toISOString()}`}
                    type="button"
                    onClick={() => {
                      onWeekChange(getWeekStart(c.date!));
                      setIsOpen(false);
                    }}
                    className={cn(
                      "grid h-9 place-items-center rounded-xl text-[12px] font-semibold",
                      !inWeek && !isToday && "bg-white/70 text-slate-700 ring-2 ring-slate-900/[0.06] hover:bg-white",
                      inWeek && !isToday && "bg-violet-100/90 text-violet-950 ring-2 ring-violet-200/75 hover:bg-violet-100",
                      !inWeek && isToday && "bg-white/70 text-slate-700 ring-2 ring-violet-400/55 hover:bg-white",
                      inWeek && isToday && "bg-violet-100/90 text-violet-950 ring-2 ring-violet-400/65 hover:bg-violet-100",
                    )}
                    aria-label={`Velg ${c.date.toLocaleDateString("no-NO")}`}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 text-[12px] font-medium text-slate-500">Velg en dato – Shiftly hopper til riktig uke.</div>
          </div>
        ) : null}
      </div>
    </>
  );
}

