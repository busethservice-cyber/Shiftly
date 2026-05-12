"use client";

import type { Shift } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";
import { getStatusPalette } from "@/app/lib/statusColors";
import { useStores } from "@/app/components/StoresProvider";
import { isShiftOff } from "@/app/lib/hours";

function TimeStack({ shift }: { shift: Shift }) {
  if (!shift.startTime || !shift.endTime) {
    return <span>Fri</span>;
  }

  return (
    <span className="inline-flex flex-col items-center whitespace-nowrap">
      <span className="leading-4 whitespace-nowrap">{shift.startTime}</span>
      <span className="leading-4 text-slate-600/70">–</span>
      <span className="leading-4 whitespace-nowrap">{shift.endTime}</span>
    </span>
  );
}

export function ShiftCard({
  shift,
  onClick,
}: {
  shift: Shift;
  onClick: (shift: Shift) => void;
}) {
  const { stores } = useStores();
  const storeName = shift.storeId ? stores.find((s) => s.id === shift.storeId)?.name ?? "" : "";
  const isOff = isShiftOff(shift);
  const palette = getStatusPalette(isOff ? "unconfirmed" : shift.status);

  return (
    <button
      type="button"
      onClick={() => onClick(shift)}
      className={cn(
        "group relative w-full min-w-[72px] overflow-hidden rounded-3xl px-5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.03]",
        palette.pillBg,
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200",
      )}
    >
      <span
        className={cn(
          "absolute left-3 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-black/[0.03]",
          (shift.publishState ?? "draft") === "published"
            ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
            : "bg-white/60 text-slate-600 ring-slate-900/[0.06]",
        )}
      >
        {(shift.publishState ?? "draft") === "published" ? "Publisert" : "Utkast"}
      </span>
      {shift.showMenu ? (
        <span className="absolute right-3 top-2.5 rounded-full p-1 text-slate-500/70 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="block text-[18px] leading-[12px]">⋯</span>
        </span>
      ) : null}

      <div className="text-center">
        <div className={cn("text-[14px] font-semibold tracking-tight", palette.pillText)}>
          <TimeStack shift={shift} />
        </div>
        {!isOff ? (
          <div
            className={cn(
              "mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] leading-4",
              palette.pillSubtext,
            )}
            title={storeName || "—"}
          >
            {storeName || "—"}
          </div>
        ) : (
          <div className={cn("mt-1 text-[11.5px] leading-4", palette.pillSubtext)}>Fri</div>
        )}
      </div>
    </button>
  );
}

