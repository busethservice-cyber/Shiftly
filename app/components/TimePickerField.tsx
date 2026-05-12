"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/app/lib/cn";

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTE_LABELS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/** Strict HH:mm (00–23, 00–59). */
export function parseHm(value: string): { h: number; m: number } | null {
  const m = /^([01]?\d|2[0-3]):([0-5]?\d)$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return { h, m: min };
}

export function formatHm(h: number, m: number): string {
  return `${String(Math.max(0, Math.min(23, h))).padStart(2, "0")}:${String(Math.max(0, Math.min(59, m))).padStart(2, "0")}`;
}

type PopoverRect = { top: number; left: number; width: number };

export function TimePickerField({
  label,
  value,
  onChange,
  disabled,
  className,
  inputClassName,
  allowEmpty = true,
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** When true, show “Tøm” to set an empty value. */
  allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<PopoverRect>({ top: 0, left: 0, width: 200 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseHm(value), [value]);
  const display = parsed ? formatHm(parsed.h, parsed.m) : "—";

  const close = useCallback(() => setOpen(false), []);

  const updateRect = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(200, Math.min(280, r.width)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateRect();
    const h = parsed?.h ?? 0;
    const m = parsed?.m ?? 0;
    requestAnimationFrame(() => {
      const hb = hourColRef.current?.querySelector<HTMLElement>(`[data-hour="${h}"]`);
      const mb = minuteColRef.current?.querySelector<HTMLElement>(`[data-minute="${m}"]`);
      hb?.scrollIntoView({ block: "center" });
      mb?.scrollIntoView({ block: "center" });
    });
  }, [open, parsed, updateRect]);

  useEffect(() => {
    if (!open) return;
    function onScrollResize() {
      updateRect();
    }
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open, updateRect]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const pickHour = (h: number) => {
    const m = parsed?.m ?? 0;
    onChange(formatHm(h, m));
  };

  const pickMinute = (m: number) => {
    const h = parsed?.h ?? 0;
    onChange(formatHm(h, m));
  };

  const selectedH = parsed?.h ?? null;
  const selectedM = parsed?.m ?? null;

  const popover =
    open && !disabled && typeof document !== "undefined" ? (
      <div
        ref={popoverRef}
        role="dialog"
        aria-label={label}
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
        }}
        className="flex flex-col rounded-2xl bg-white/95 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.08] backdrop-blur-sm"
      >
        <div className="flex max-h-[168px] min-h-[120px] gap-1">
          <div
            ref={hourColRef}
            className="min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-xl bg-[#F6F8FC]/90 py-1 ring-1 ring-slate-900/[0.04]"
          >
            {HOUR_LABELS.map((hourStr, h) => {
              const active = selectedH === h;
              return (
                <button
                  key={hourStr}
                  type="button"
                  data-hour={h}
                  onClick={() => pickHour(h)}
                  className={cn(
                    "flex w-full shrink-0 items-center justify-center py-1.5 text-[13px] font-medium tabular-nums transition-colors",
                    active
                      ? "bg-violet-100 font-semibold text-violet-900"
                      : "text-slate-700 hover:bg-white/80 hover:text-slate-900",
                  )}
                >
                  {hourStr}
                </button>
              );
            })}
          </div>
          <div
            ref={minuteColRef}
            className="min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-xl bg-[#F6F8FC]/90 py-1 ring-1 ring-slate-900/[0.04]"
          >
            {MINUTE_LABELS.map((minuteStr, m) => {
              const active = selectedM === m;
              return (
                <button
                  key={minuteStr}
                  type="button"
                  data-minute={m}
                  onClick={() => pickMinute(m)}
                  className={cn(
                    "flex w-full shrink-0 items-center justify-center py-1.5 text-[13px] font-medium tabular-nums transition-colors",
                    active
                      ? "bg-violet-100 font-semibold text-violet-900"
                      : "text-slate-700 hover:bg-white/80 hover:text-slate-900",
                  )}
                >
                  {minuteStr}
                </button>
              );
            })}
          </div>
        </div>
        {allowEmpty ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              close();
            }}
            className="mt-1.5 w-full rounded-xl py-1.5 text-center text-[11.5px] font-semibold text-slate-500 hover:bg-slate-100/80 hover:text-slate-700"
          >
            Tøm
          </button>
        ) : null}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="text-[12px] font-semibold text-slate-600">{label}</div>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "mt-2 flex w-full min-h-[42px] items-center justify-between rounded-2xl bg-white/80 px-3.5 py-2.5 text-left text-[13.5px] font-medium text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05]",
          "focus:outline-none focus:ring-2 focus:ring-violet-200",
          "tabular-nums disabled:cursor-not-allowed disabled:opacity-50",
          inputClassName,
        )}
      >
        <span className={cn(!parsed && "text-slate-400")}>{display}</span>
        <span className="text-[10px] font-semibold text-slate-400" aria-hidden>
          ▾
        </span>
      </button>

      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
