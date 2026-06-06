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
        "group relative block w-full max-w-full min-w-0 min-h-[38px] rounded-lg px-1.5 py-1 text-left ring-1 ring-inset ring-black/[0.05]",
        "overflow-hidden transition-shadow hover:shadow-[0_4px_10px_rgba(15,23,42,0.06)]",
        palette.pillBg,
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200",
      )}
      title={hoverTitle}
    >
      <span
        className={cn(
          "absolute right-1 top-0.5 rounded px-1 py-px text-[7px] font-semibold uppercase leading-none tracking-wide",
          isPublished ? "bg-white/80 text-emerald-700" : "bg-white/70 text-slate-500",
        )}
        title={isPublished ? "Publisert" : "Utkast"}
      >
        {isPublished ? "Pub" : "Utk"}
      </span>
      {hasAlert ? (
        <span
          className="absolute left-1 top-1 inline-block size-1.5 rounded-full bg-rose-500 ring-1 ring-white/90"
          aria-hidden="true"
        />
      ) : null}
      <span className="flex w-full min-w-0 flex-col gap-0.5 pr-6 pt-0.5">
        <span
          className={cn(
            "w-full min-w-0 truncate whitespace-nowrap text-[10px] font-semibold leading-none tabular-nums",
            palette.pillText,
          )}
        >
          {timeCompact}
        </span>
        <span
          className={cn(
            "w-full min-w-0 truncate whitespace-nowrap text-[8.5px] font-medium leading-none opacity-90",
            palette.pillSubtext,
          )}
        >
          {nameLabel}
        </span>
        {!isOff && showStoreName && storeName ? (
          <span className="w-full min-w-0 truncate whitespace-nowrap text-[8px] font-medium leading-none text-slate-500/80">
            {storeName}
          </span>
        ) : null}
      </span>
    </button>
  );
}
