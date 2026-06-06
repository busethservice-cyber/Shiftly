"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/app/lib/cn";

export function cellId(employeeId: string, day: number) {
  return `cell:${employeeId}:${day}`;
}

export function parseCellId(id: string) {
  const parts = id.split(":");
  if (parts.length !== 3) return null;
  if (parts[0] !== "cell") return null;
  const employeeId = parts[1] ?? "";
  const day = Number(parts[2]);
  if (!employeeId || !Number.isFinite(day)) return null;
  return { employeeId, day };
}

export function DroppableDayCell({
  id,
  disabled,
  className,
  children,
}: {
  id: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: Boolean(disabled) });

  return (
    <div ref={setNodeRef} className={cn("h-full min-w-0", className, isOver && !disabled && "relative z-[1]")}>
      <div
        className={cn(
          "h-full w-full min-w-0 transition-colors",
          isOver && !disabled && "rounded-md bg-violet-50/40 ring-1 ring-violet-200/70",
        )}
      >
        {children}
      </div>
    </div>
  );
}
