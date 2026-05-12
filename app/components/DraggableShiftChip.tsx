"use client";

import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Shift } from "@/app/lib/types";
import { ShiftChip } from "@/app/components/ShiftChip";
import { cn } from "@/app/lib/cn";

export function DraggableShiftChip({
  shift,
  onClick,
  hasAlert,
}: {
  shift: Shift;
  onClick: (shift: Shift) => void;
  hasAlert?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    data: { type: "shift" as const, shiftId: shift.id },
  });

  const wasDraggingRef = useRef(false);
  useEffect(() => {
    if (isDragging) wasDraggingRef.current = true;
  }, [isDragging]);

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0) scale(${isDragging ? 1.03 : 1})`
      : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-transform duration-150 ease-out",
        isDragging && "drop-shadow-[0_18px_38px_rgba(15,23,42,0.18)]",
      )}
    >
      <div
        {...listeners}
        {...attributes}
        onClickCapture={(e) => {
          if (wasDraggingRef.current) {
            e.preventDefault();
            e.stopPropagation();
            wasDraggingRef.current = false;
          }
        }}
      >
        <ShiftChip shift={shift} onClick={onClick} hasAlert={hasAlert} />
      </div>
    </div>
  );
}

