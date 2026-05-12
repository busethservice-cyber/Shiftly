"use client";

import { useEffect, useMemo, useState } from "react";
import type { RetailStore, StoreDaySchedule, StoreStatus } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";
import { dayShort } from "@/app/lib/mockData";
import { activeStores } from "@/app/lib/storeUtils";
import { useStores } from "@/app/components/StoresProvider";
import { TimePickerField } from "@/app/components/TimePickerField";
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
        "mt-2 w-full rounded-2xl bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200",
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
        "mt-2 min-h-[88px] w-full resize-y rounded-2xl bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200",
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
        "mt-2 w-full appearance-none rounded-2xl bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-200",
        className,
      )}
    />
  );
}

function orderedDays(store: RetailStore): StoreDaySchedule[] {
  return [...store.days].sort((a, b) => a.dayIndex - b.dayIndex);
}

export function StoreDetailsPanel({
  open,
  store,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  store: RetailStore | null;
  onClose: () => void;
  onSave: (updated: RetailStore) => void;
  onDelete: (id: string) => void;
}) {
  const { stores } = useStores();
  const storesActive = useMemo(() => activeStores(stores), [stores]);

  const employeeSiteKeyOptions = useMemo(() => {
    const pairs: Array<{ key: NonNullable<RetailStore["employeeSiteKey"]>; label: string }> = [];
    const seen = new Set<string>();
    for (const s of storesActive) {
      const k = s.employeeSiteKey;
      if (!k || seen.has(k)) continue;
      seen.add(k);
      pairs.push({ key: k, label: s.name });
    }
    return pairs.sort((a, b) => a.label.localeCompare(b.label, "nb"));
  }, [storesActive]);

  const [draft, setDraft] = useState<RetailStore | null>(store);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setDeleteConfirmOpen(false);
    setDraft(store);
  }, [store]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const title = useMemo(() => draft?.name ?? "Butikk", [draft?.name]);
  const canSave = Boolean(draft);

  function patchDay(dayIndex: number, patch: Partial<StoreDaySchedule>) {
    if (!draft) return;
    setDraft({
      ...draft,
      days: draft.days.map((d) => (d.dayIndex === dayIndex ? { ...d, ...patch } : d)),
    });
  }

  return (
    <div className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
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

      <aside
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-[480px] transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="h-full p-4 sm:p-6">
          <div className="relative flex h-full flex-col rounded-[32px] bg-white/85 shadow-[0_28px_70px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.05] backdrop-blur">
            <div className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-slate-500">Butikk</div>
                <div className="mt-1 truncate text-[18px] font-semibold tracking-tight text-slate-900">{title}</div>
                <div className="mt-1 text-[13px] font-semibold text-slate-600">{draft?.address ? draft.address : "Ingen adresse"}</div>
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
              <div className="rounded-3xl bg-white/70 p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
                <FieldLabel>Butikknavn</FieldLabel>
                <SoftInput value={draft?.name ?? ""} onChange={(e) => draft && setDraft({ ...draft, name: e.target.value })} disabled={!draft} />

                <div className="mt-4">
                  <FieldLabel>Adresse</FieldLabel>
                  <SoftInput value={draft?.address ?? ""} onChange={(e) => draft && setDraft({ ...draft, address: e.target.value })} disabled={!draft} />
                </div>

                <div className="mt-4">
                  <FieldLabel>Telefon</FieldLabel>
                  <SoftInput value={draft?.phone ?? ""} onChange={(e) => draft && setDraft({ ...draft, phone: e.target.value })} disabled={!draft} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Status</FieldLabel>
                    <SoftSelect
                      value={draft?.status ?? "active"}
                      onChange={(e) =>
                        draft && setDraft({ ...draft, status: e.target.value as StoreStatus })
                      }
                      disabled={!draft}
                    >
                      <option value="active">Aktiv</option>
                      <option value="inactive">Inaktiv</option>
                    </SoftSelect>
                  </div>
                  <div>
                    <FieldLabel>Kobling ansatte</FieldLabel>
                    <SoftSelect
                      value={draft?.employeeSiteKey ?? ""}
                      onChange={(e) => {
                        if (!draft) return;
                        const v = e.target.value;
                        setDraft({
                          ...draft,
                          employeeSiteKey: v === "" ? null : (v as RetailStore["employeeSiteKey"]),
                        });
                      }}
                      disabled={!draft}
                    >
                      <option value="">Ingen tilknytning</option>
                      {draft?.employeeSiteKey &&
                      !employeeSiteKeyOptions.some((o) => o.key === draft.employeeSiteKey) ? (
                        <option value={draft.employeeSiteKey}>{draft.employeeSiteKey}</option>
                      ) : null}
                      {employeeSiteKeyOptions.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label} ({o.key})
                        </option>
                      ))}
                    </SoftSelect>
                  </div>
                </div>

                <div className="mt-4">
                  <FieldLabel>Notater</FieldLabel>
                  <SoftTextarea value={draft?.notes ?? ""} onChange={(e) => draft && setDraft({ ...draft, notes: e.target.value })} disabled={!draft} />
                </div>
              </div>

              <div className="rounded-3xl bg-[#F6F8FC] p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
                <div className="text-[13px] font-semibold text-slate-900">Åpningstider og bemanning</div>
                <p className="mt-1 text-[12px] font-medium text-slate-500">Per ukedag: åpent/stengt, tider, minste antall og valgfri merknad.</p>

                <div className="mt-4 space-y-3">
                  {draft
                    ? orderedDays(draft).map((d) => {
                        const label = dayShort[d.dayIndex] ?? `Dag ${d.dayIndex}`;
                        return (
                          <div
                            key={d.dayIndex}
                            className="rounded-2xl bg-white/80 p-3.5 shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.04]"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[13px] font-semibold text-slate-900">{label}</div>
                              <button
                                type="button"
                                onClick={() =>
                                  patchDay(d.dayIndex, {
                                    open: !d.open,
                                    minStaff: !d.open ? Math.max(d.minStaff, 1) : 0,
                                  })
                                }
                                className={cn(
                                  "rounded-full px-3 py-1 text-[12px] font-semibold ring-1 ring-slate-900/[0.06]",
                                  d.open ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-100 text-slate-600",
                                )}
                              >
                                {d.open ? "Åpen" : "Stengt"}
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                              <div className="col-span-1">
                                <TimePickerField
                                  label="Åpner"
                                  value={d.startTime}
                                  onChange={(v) => patchDay(d.dayIndex, { startTime: v })}
                                  disabled={!d.open}
                                  allowEmpty={false}
                                  inputClassName="mt-1 px-3 py-2 text-[13px]"
                                />
                              </div>
                              <div className="col-span-1">
                                <TimePickerField
                                  label="Stenger"
                                  value={d.endTime}
                                  onChange={(v) => patchDay(d.dayIndex, { endTime: v })}
                                  disabled={!d.open}
                                  allowEmpty={false}
                                  inputClassName="mt-1 px-3 py-2 text-[13px]"
                                />
                              </div>
                              <div className="col-span-1">
                                <div className="text-[11px] font-semibold text-slate-500">Min. ansatte</div>
                                <SoftInput
                                  type="number"
                                  min={0}
                                  className="mt-1 px-3 py-2 text-[13px]"
                                  disabled={!d.open}
                                  value={d.open ? String(d.minStaff) : "0"}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    patchDay(d.dayIndex, { minStaff: Number.isFinite(n) ? Math.max(0, n) : 0 });
                                  }}
                                />
                              </div>
                              <div className="col-span-2 sm:col-span-4">
                                <div className="text-[11px] font-semibold text-slate-500">Merknad (valgfritt)</div>
                                <SoftInput
                                  className="mt-1"
                                  placeholder="F.eks. ekstra bemanning lørdag"
                                  disabled={!d.open}
                                  value={d.staffingNote}
                                  onChange={(e) => patchDay(d.dayIndex, { staffingNote: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    : null}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-900/[0.05] p-5">
              <button
                type="button"
                onClick={() => draft && setDeleteConfirmOpen(true)}
                disabled={!draft}
                className="w-full rounded-2xl bg-rose-50 px-4 py-3 text-[13.5px] font-semibold text-rose-700 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-rose-100 hover:bg-rose-100 disabled:opacity-50"
              >
                Slett butikk
              </button>

              <button
                type="button"
                onClick={() => draft && onSave(draft)}
                disabled={!canSave}
                className={cn(
                  "mt-3 w-full rounded-2xl bg-violet-600 px-4 py-3 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500",
                  !canSave && "opacity-50 hover:bg-violet-600",
                )}
              >
                Lagre
              </button>

              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full rounded-2xl bg-white/70 px-4 py-3 text-[13.5px] font-semibold text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
              >
                Lukk
              </button>
            </div>

            {deleteConfirmOpen && draft ? (
              <div className="absolute inset-0 z-10 flex items-end justify-center rounded-[32px] bg-slate-900/20 p-4 backdrop-blur-[2px] sm:items-center">
                <div className="w-full max-w-[360px] rounded-[26px] bg-white p-5 shadow-[0_28px_70px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/[0.06]">
                  <div className="text-[15px] font-semibold text-slate-900">Slette butikk?</div>
                  <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-600">
                    Er du sikker på at du vil slette denne butikken? Dette kan ikke angres.
                  </p>
                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(false)}
                      className="flex-1 rounded-2xl bg-white/80 px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
                    >
                      Avbryt
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(draft.id);
                        setDeleteConfirmOpen(false);
                      }}
                      className="flex-1 rounded-2xl bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(225,29,72,0.35)] hover:bg-rose-500"
                    >
                      Slett
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
