"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmployeeRequestType, Shift } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";
import { X } from "lucide-react";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold text-slate-600">{children}</div>;
}

function SoftInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={cn(
        "mt-2 w-full rounded-2xl bg-white/85 px-3.5 py-2.5 text-[13.5px] font-medium text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200",
        className,
      )}
    />
  );
}

function SoftTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={cn(
        "mt-2 min-h-[96px] w-full resize-y rounded-2xl bg-white/85 px-3.5 py-2.5 text-[13.5px] font-medium text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200",
        className,
      )}
    />
  );
}

function SoftSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <select
      {...rest}
      className={cn(
        "mt-2 w-full appearance-none rounded-2xl bg-white/85 px-3.5 py-2.5 text-[13.5px] font-medium text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-200",
        className,
      )}
    />
  );
}

function titleForType(type: EmployeeRequestType) {
  if (type === "be_om_fri") return "Be om fri";
  if (type === "bytt_vakt") return "Bytt vakt";
  return "Meld sykdom";
}

export function RequestModal({
  open,
  type,
  availableShifts,
  onClose,
  onSubmit,
}: {
  open: boolean;
  type: EmployeeRequestType;
  availableShifts: Shift[];
  onClose: () => void;
  onSubmit: (args: { date: string; message: string; shiftId?: string }) => void;
}) {
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [shiftId, setShiftId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setMessage("");
    if (type === "bytt_vakt") {
      setShiftId(availableShifts[0]?.id ?? "");
      setDate("");
    } else {
      setShiftId("");
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      setDate(iso);
    }
  }, [open, type, availableShifts]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const canSubmit = useMemo(() => {
    if (!open) return false;
    if (type === "bytt_vakt") return Boolean(shiftId);
    return Boolean(date);
  }, [open, type, shiftId, date]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px]"
        aria-label="Lukk"
      />

      <div className="absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 p-4">
        <div className="rounded-[28px] bg-white/90 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.06] backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-slate-900">{titleForType(type)}</div>
              <div className="mt-1 text-[12.5px] font-medium text-slate-600">
                Send en forespørsel til leder (mock).
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 place-items-center rounded-2xl bg-white/70 text-slate-500 shadow-[0_12px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.05] hover:bg-white"
              aria-label="Lukk"
            >
              <X className="size-[18px]" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {type === "bytt_vakt" ? (
              <div>
                <FieldLabel>Velg vakt</FieldLabel>
                <SoftSelect value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                  {availableShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      Uke {s.week + 1} • {s.day} • {s.startTime || "—"}–{s.endTime || "—"} • {s.store}
                    </option>
                  ))}
                </SoftSelect>
              </div>
            ) : (
              <div>
                <FieldLabel>Dato</FieldLabel>
                <SoftInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            )}

            <div>
              <FieldLabel>Melding</FieldLabel>
              <SoftTextarea
                placeholder="Skriv en kort forklaring…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSubmit({ date, message, shiftId: shiftId || undefined })}
              disabled={!canSubmit}
              className={cn(
                "flex-1 rounded-2xl bg-violet-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500",
                !canSubmit && "opacity-50 hover:bg-violet-600",
              )}
            >
              Send forespørsel
            </button>
            <button
              type="button"
              onClick={onClose}
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

