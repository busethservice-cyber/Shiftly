"use client";

import { useEffect, useMemo, useState } from "react";
import type { RetailStore } from "@/app/lib/types";
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
        "mt-2 w-full rounded-2xl bg-white/85 px-4 py-2.5 text-[13.5px] font-semibold text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200",
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
        "mt-2 w-full appearance-none rounded-2xl bg-white/85 px-4 py-2.5 text-[13.5px] font-semibold text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-200",
        className,
      )}
    />
  );
}

export function InviteEmployeeModal({
  open,
  stores,
  onCancel,
  onSend,
}: {
  open: boolean;
  stores: RetailStore[];
  onCancel: () => void;
  onSend: (args: { email: string; storeId: string | null; role: "employee" | "admin" }) => Promise<void> | void;
}) {
  const [email, setEmail] = useState("");
  const [storeId, setStoreId] = useState<string>(""); // "" = none
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setError(null);
    setRole("employee");
    setStoreId(stores[0]?.id ?? "");
  }, [open, stores]);

  useEffect(() => {
    if (storeId && !stores.some((s) => s.id === storeId)) {
      setStoreId(stores[0]?.id ?? "");
    }
  }, [storeId, stores]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  const canSend = useMemo(() => {
    const e = email.trim();
    return e.includes("@") && e.includes(".") && !loading;
  }, [email, loading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px]"
        aria-label="Lukk"
      />

      <div className="absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 p-4">
        <div className="rounded-[28px] bg-white/90 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.06] backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-slate-900">Inviter ansatt</div>
              <div className="mt-1 text-[12.5px] font-medium text-slate-600">
                Ingen e-post sendes ennå – vi lagrer invitasjonen og oppretter ansatt.
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="grid size-10 place-items-center rounded-2xl bg-white/70 text-slate-500 shadow-[0_12px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.05] hover:bg-white"
              aria-label="Lukk"
            >
              <X className="size-[18px]" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <FieldLabel>E-post</FieldLabel>
              <SoftInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="navn@firma.no" />
            </div>
            <div>
              <FieldLabel>Butikk</FieldLabel>
              {stores.length === 0 ? (
                <div className="mt-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-slate-600 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.06]">
                  Ingen butikker
                </div>
              ) : (
                <SoftSelect value={storeId || stores[0]?.id} onChange={(e) => setStoreId(e.target.value)}>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </SoftSelect>
              )}
            </div>
            <div>
              <FieldLabel>Rolle</FieldLabel>
              <SoftSelect value={role} onChange={(e) => setRole(e.target.value as "employee" | "admin")}>
                <option value="employee">Ansatt</option>
                <option value="admin">Admin</option>
              </SoftSelect>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-[12.5px] font-semibold text-rose-800 ring-1 ring-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              disabled={!canSend}
              onClick={async () => {
                setError(null);
                setLoading(true);
                try {
                  await onSend({ email: email.trim(), storeId: storeId || null, role });
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Kunne ikke sende invitasjon";
                  setError(msg);
                  setLoading(false);
                  return;
                }
                setLoading(false);
              }}
              className={cn(
                "flex-1 rounded-2xl bg-violet-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500",
                !canSend && "opacity-50 hover:bg-violet-600",
              )}
            >
              Send invitasjon
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

