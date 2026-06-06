"use client";

import type { Shift } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";
import { getStatusPalette } from "@/app/lib/statusColors";
import { useStores } from "@/app/components/StoresProvider";
import { isShiftOff } from "@/app/lib/hours";

/** Compact "09:00" → "09", keep minutes when non-zero. */
function compactClockToken(t: string): string {
  const [hRaw, mRaw] = t.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t.trim();
  if (m === 0) return String(h).padStart(2, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function compactTimeRange(start: string, end: string): string {
  return `${compactClockToken(start)}–${compactClockToken(end)}`;
}

function fullTimeRange(start: string, end: string): string {
  return `${start}–${end}`;
}

export function ShiftChip({
  shift,
  employeeName,
  showStoreName = false,
  onClick,
  onContextMenu,
  hasAlert,
}: {
  shift: Shift;
  employeeName?: string;
  showStoreName?: boolean;
  onClick: (shift: Shift, anchorRect: DOMRect) => void;
  onContextMenu?: (shift: Shift, x: number, y: number) => void;
  hasAlert?: boolean;
}) {
  const { stores } = useStores();
  const storeName = shift.storeId ? stores.find((s) => s.id === shift.storeId)?.name ?? "" : "";
  const isOff = isShiftOff(shift);
  const palette = getStatusPalette(isOff ? "unconfirmed" : shift.status);
  const hasTimes = Boolean(shift.startTime && shift.endTime);
  const timeCompact = isOff ? "Fri" : hasTimes ? compactTimeRange(shift.startTime, shift.endTime) : "—";
  const timeFull = isOff ? "Fri" : hasTimes ? fullTimeRange(shift.startTime, shift.endTime) : "—";
  const nameLabel = employeeName?.trim() || "Ansatt";
  const isPublished = (shift.publishState ?? "draft") === "published";
  const hoverTitle = !isOff
    ? [timeFull, nameLabel, storeName].filter(Boolean).join(" · ")
    : timeFull;

  return (
    <button
      type="button"
      onClick={(e) => onClick(shift, (e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        onContextMenu(shift, e.clientX, e.clientY);
      }}
      className={cn(
        "group relative block w-full max-w-full min-w-0 rounded-xl px-1.5 pb-1 pt-3.5 text-center shadow-[0_6px_14px_rgba(15,23,42,0.05)] ring-1 ring-black/[0.04]",
        "overflow-hidden",
        palette.pillBg,
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200",
      )}
      title={hoverTitle}
    >
      <span
        className={cn(
          "absolute left-1 top-0.5 max-w-[calc(100%-1.25rem)] truncate rounded px-1 py-px text-[7.5px] font-semibold leading-none ring-1 ring-black/[0.03]",
          isPublished ? "bg-emerald-50/90 text-emerald-800 ring-emerald-100" : "bg-white/70 text-slate-500 ring-slate-900/[0.05]",
        )}
        title={isPublished ? "Publisert" : "Utkast"}
      >
        {isPublished ? "Pub" : "Utk"}
      </span>
      {hasAlert ? (
        <span
          className="absolute right-1 top-1 inline-block size-1.5 rounded-full bg-rose-500 ring-1 ring-white/80"
          aria-hidden="true"
        />
      ) : null}
      <span className="flex w-full min-w-0 flex-col items-stretch gap-px">
        <span
          className={cn(
            "w-full min-w-0 truncate whitespace-nowrap text-[10.5px] font-semibold leading-[1.15] tabular-nums tracking-tight",
            palette.pillText,
          )}
        >
          {timeCompact}
        </span>
        <span
          className={cn(
            "w-full min-w-0 truncate whitespace-nowrap text-[9px] font-medium leading-[1.15]",
            palette.pillSubtext,
          )}
        >
          {nameLabel}
        </span>
        {!isOff && showStoreName && storeName ? (
          <span className="w-full min-w-0 truncate whitespace-nowrap text-[8.5px] font-medium leading-[1.15] text-slate-500/90">
            {storeName}
          </span>
        ) : null}
      </span>
    </button>
  );
}
