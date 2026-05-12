"use client";

import { useEffect, useMemo, useState } from "react";
import type { Employee, RetailStore, Shift, ShiftStatus } from "@/app/lib/types";
import type { ShiftlySettings } from "@/app/lib/settings";
import { cn } from "@/app/lib/cn";
import { Trash2, X } from "lucide-react";
import { getStatusPalette } from "@/app/lib/statusColors";
import { TimePickerField } from "@/app/components/TimePickerField";
import { canAssignShift, normalizeShiftStoreFields } from "@/app/lib/rules/shifts";

/** `<select>` value for Fri/off (not a UUID). */
const FRI_SELECT_VALUE = "__shiftly_fri__";

const statusMeta: Array<{ value: ShiftStatus; label: string }> = [
  { value: "normal", label: "Innenfor kontrakt" },
  { value: "near_limit", label: "Nær grense" },
  { value: "over_limit", label: "Over kontrakt" },
  { value: "unconfirmed", label: "Ubekreftet" },
];

function titleForShift(shift: Shift, employees: Employee[]) {
  const emp = employees.find((e) => e.id === shift.employeeId);
  const name = emp?.name ?? "Ukjent ansatt";
  const time = shift.startTime && shift.endTime ? `${shift.startTime} – ${shift.endTime}` : "Fri";
  return { name, time };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold text-slate-600">{children}</div>;
}

function SoftSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <select
      {...rest}
      className={cn(
        "mt-2 w-full appearance-none rounded-2xl bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-200",
        className,
      )}
    />
  );
}

export function ShiftDetailsPanel({
  open,
  employees,
  shift,
  shiftsForWeekAllStores,
  settings,
  stores,
  preferredStoreId,
  scheduleStoresForPicker,
  scheduleWeekDays,
  isCreate,
  onClose,
  onSave,
  onDelete,
  onValidationError,
}: {
  open: boolean;
  employees: Employee[];
  shift: Shift | null;
  /** All shifts in the viewed week — used for overlap and contract totals. */
  shiftsForWeekAllStores: Shift[];
  settings: ShiftlySettings;
  stores: RetailStore[];
  preferredStoreId?: string | null;
  /** Active stores for the picker (uuid + display name); Fri is implicit. */
  scheduleStoresForPicker: Array<{ id: string; name: string }>;
  /** Current week day labels (create mode); `day` is 0..6 Mon–Sun. */
  scheduleWeekDays?: Array<{ day: number; label: string }>;
  isCreate?: boolean;
  onClose: () => void;
  onSave: (updated: Shift) => void;
  onDelete: (shiftId: string) => void;
  onValidationError?: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Shift | null>(() =>
    shift ? normalizeShiftStoreFields(shift, stores, preferredStoreId ?? null) : null,
  );

  useEffect(() => {
    setDraft(shift ? normalizeShiftStoreFields(shift, stores, preferredStoreId ?? null) : null);
  }, [shift, stores, preferredStoreId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const header = useMemo(() => (draft ? titleForShift(draft, employees) : null), [draft, employees]);

  const pickerRows = useMemo(() => {
    const byId = new Map(scheduleStoresForPicker.map((s) => [s.id, s] as const));
    if (
      draft &&
      draft.store !== "Fri" &&
      draft.storeId &&
      !byId.has(draft.storeId)
    ) {
      const catalog = stores.find((s) => s.id === draft.storeId);
      byId.set(draft.storeId, { id: draft.storeId, name: catalog?.name ?? "Ukjent butikk" });
    }
    return Array.from(byId.values());
  }, [draft, scheduleStoresForPicker, stores]);

  const storeSelectValue = draft ? (draft.store === "Fri" ? FRI_SELECT_VALUE : (draft.storeId ?? "")) : FRI_SELECT_VALUE;

  const canSave = Boolean(draft);
  const statusLocked = true;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
        aria-label="Lukk"
        tabIndex={open ? 0 : -1}
      />

      {/* Panel */}
      <aside
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-[440px] transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="h-full p-4 sm:p-6">
          <div className="flex h-full flex-col rounded-[32px] bg-white/85 shadow-[0_28px_70px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.05] backdrop-blur">
            <div className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-slate-500">Vakt</div>
                <div className="mt-1 truncate text-[18px] font-semibold tracking-tight text-slate-900">
                  {header ? `${header.name}` : "Ny vakt"}
                </div>
                <div className="mt-1 text-[13px] font-semibold text-slate-600">{header?.time ?? ""}</div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="grid size-10 place-items-center rounded-2xl bg-white/70 text-slate-500 shadow-[0_12px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.05] hover:bg-white"
                aria-label="Lukk panel"
              >
                <X className="size-[18px]" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-auto px-5 pb-5">
              {/* Status */}
              <div className="rounded-3xl bg-[#F6F8FC] p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
                <FieldLabel>Status</FieldLabel>
                <div className="mt-3 flex flex-wrap gap-2">
                  {statusMeta.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => undefined}
                      className={cn(
                        "rounded-3xl px-3.5 py-2 text-[12.5px] font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.05)] transition-transform",
                        getStatusPalette(s.value).pillBg,
                        getStatusPalette(s.value).pillText,
                        "ring-1 ring-black/[0.03]",
                        draft?.status === s.value ? "scale-[1.01]" : "opacity-80 hover:opacity-100",
                        statusLocked && "cursor-not-allowed",
                      )}
                      aria-pressed={draft?.status === s.value}
                      disabled={!draft || statusLocked}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="rounded-3xl bg-white/70 p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
                {isCreate && scheduleWeekDays && scheduleWeekDays.length > 0 && draft ? (
                  <div className="mb-4">
                    <FieldLabel>Dag</FieldLabel>
                    <SoftSelect
                      className="mt-2"
                      value={String(draft.day)}
                      onChange={(e) => {
                        const day = Number(e.target.value);
                        if (!draft || !Number.isFinite(day)) return;
                        setDraft({ ...draft, day });
                      }}
                    >
                      {scheduleWeekDays.map((row) => (
                        <option key={row.day} value={String(row.day)}>
                          {row.label}
                        </option>
                      ))}
                    </SoftSelect>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4">
                  <TimePickerField
                    label="Start"
                    value={draft?.startTime ?? ""}
                    onChange={(v) => draft && setDraft({ ...draft, startTime: v })}
                    disabled={!draft}
                    allowEmpty={draft?.store === "Fri"}
                  />
                  <TimePickerField
                    label="Slutt"
                    value={draft?.endTime ?? ""}
                    onChange={(v) => draft && setDraft({ ...draft, endTime: v })}
                    disabled={!draft}
                    allowEmpty={draft?.store === "Fri"}
                  />
                </div>

                {settings.shiftTemplates.length > 0 && draft != null && draft.store !== "Fri" ? (
                  <div className="mt-4">
                    <FieldLabel>Velg standardvakt</FieldLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {settings.shiftTemplates.map((tpl) => {
                        const active =
                          draft.startTime === tpl.startTime && draft.endTime === tpl.endTime;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => setDraft({ ...draft, startTime: tpl.startTime, endTime: tpl.endTime })}
                            className={cn(
                              "max-w-full truncate rounded-full px-3 py-1.5 text-left text-[11.5px] font-semibold shadow-sm ring-1 transition-colors",
                              active
                                ? "bg-violet-100 text-violet-900 ring-violet-200"
                                : "bg-white/80 text-slate-700 ring-slate-900/[0.06] hover:bg-violet-50/80 hover:ring-violet-100",
                            )}
                          >
                            {tpl.name}{" "}
                            <span className={cn("font-medium", active ? "text-violet-800/90" : "text-slate-500")}>
                              {tpl.startTime}–{tpl.endTime}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <FieldLabel>Butikk</FieldLabel>
                  <SoftSelect
                    value={storeSelectValue}
                    onChange={(e) => {
                      if (!draft) return;
                      const v = e.target.value;
                      if (v === FRI_SELECT_VALUE) {
                        setDraft({ ...draft, store: "Fri", storeId: undefined, startTime: "", endTime: "" });
                        return;
                      }
                      const cat = stores.find((s) => s.id === v) ?? null;
                      const tpl = settings.shiftTemplates[0];
                      const defStart = tpl?.startTime ?? "10:00";
                      const defEnd = tpl?.endTime ?? "17:00";
                      setDraft({
                        ...draft,
                        storeId: v,
                        store: cat?.employeeSiteKey ?? draft.store,
                        startTime: draft.startTime || defStart,
                        endTime: draft.endTime || defEnd,
                      });
                    }}
                    disabled={!draft}
                  >
                    <option value={FRI_SELECT_VALUE}>Fri</option>
                    {pickerRows.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </SoftSelect>
                </div>

                <div className="mt-4">
                  <FieldLabel>Ansatt</FieldLabel>
                  <SoftSelect
                    value={draft?.employeeId ?? employees[0]?.id ?? ""}
                    onChange={(e) => draft && setDraft({ ...draft, employeeId: e.target.value })}
                    disabled={!draft}
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </SoftSelect>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-900/[0.05] p-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!draft) return;
                    const normalized = normalizeShiftStoreFields(draft, stores, preferredStoreId ?? null);
                    const emp = employees.find((e) => e.id === normalized.employeeId) ?? null;
                    if (emp) {
                      const check = canAssignShift({
                        employee: emp,
                        shift: normalized,
                        shifts: shiftsForWeekAllStores,
                        settings,
                        stores,
                      });
                      if (!check.ok) {
                        onValidationError?.(check.reason);
                        return;
                      }
                    }
                    onSave(normalized);
                  }}
                  disabled={!canSave}
                  className={cn(
                    "flex-1 rounded-2xl bg-violet-600 px-4 py-3 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500",
                    !canSave && "opacity-50 hover:bg-violet-600",
                  )}
                >
                  {isCreate ? "Opprett vakt" : "Lagre endringer"}
                </button>

                {!isCreate ? (
                  <button
                    type="button"
                    onClick={() => draft && onDelete(draft.id)}
                    disabled={!draft}
                    className="grid size-12 place-items-center rounded-2xl bg-white/70 text-rose-500 shadow-[0_14px_30px_rgba(15,23,42,0.07)] ring-1 ring-rose-200/70 hover:bg-rose-50"
                    aria-label="Slett vakt"
                    title="Slett vakt"
                  >
                    <Trash2 className="size-[18px]" />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full rounded-2xl bg-white/70 px-4 py-3 text-[13.5px] font-semibold text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
              >
                Lukk
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

