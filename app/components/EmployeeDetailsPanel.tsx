"use client";

import { useEffect, useMemo, useState } from "react";
import type { Employee, RecurringUnavailablePeriod, UnavailablePeriod, UnavailablePeriodReason } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";
import { formatHours } from "@/app/lib/hours";
import { useSettings } from "@/app/components/SettingsProvider";
import { calculateContractHours } from "@/app/lib/rules/contracts";
import { dayShort, makeId } from "@/app/lib/mockData";
import { Trash2, X } from "lucide-react";
import { useStores } from "@/app/components/StoresProvider";
import { activeStores } from "@/app/lib/storeUtils";
import { useMockData } from "@/app/lib/runtimeConfig";
import { getCurrentUser } from "@/app/lib/auth";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { employeeStoreLabel } from "@/app/lib/employeeStoreLabel";
import { TimePickerField } from "@/app/components/TimePickerField";

const monthsFullNor = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
] as const;

const weekdayPlural = ["mandager", "tirsdager", "onsdager", "torsdager", "fredager", "lørdager", "søndager"] as const;

const periodReasons: UnavailablePeriodReason[] = ["Fri", "Ferie", "Syk", "Skole", "Annet"];

function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d);
}

function mondayIndexFromDate(d: Date) {
  return (d.getDay() + 6) % 7;
}

function formatDateNor(d: Date) {
  return `${d.getDate()}. ${monthsFullNor[d.getMonth()]}`;
}

function formatPeriodSummary(p: UnavailablePeriod): string {
  const a = parseIsoDate(p.startDate);
  const b = parseIsoDate(p.endDate);
  if (!a || !b) return "";

  const hasTimes = Boolean(p.startTime && p.endTime);
  const sameDay = p.startDate === p.endDate;

  if (hasTimes && sameDay) {
    const idx = mondayIndexFromDate(a);
    const wd = weekdayPlural[idx] ?? weekdayPlural[0];
    const cap = wd.charAt(0).toUpperCase() + wd.slice(1);
    return `${cap} ${p.startTime}–${p.endTime}`;
  }

  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth && a.getFullYear() === b.getFullYear()) {
    if (a.getDate() === b.getDate()) return formatDateNor(a);
    return `${a.getDate()}. – ${b.getDate()}. ${monthsFullNor[b.getMonth()]}`;
  }

  return `${formatDateNor(a)} – ${formatDateNor(b)}`;
}

function todayIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold text-slate-600">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{children}</div>;
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
        "mt-2 min-h-[96px] w-full resize-y rounded-2xl bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200",
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

function availabilityLabel(days: number[]) {
  if (days.length === 0) return "Ingen begrensninger";
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => dayShort[d] ?? String(d))
    .join(", ");
}

function normalizeEmployee(
  e: Employee,
  fullTimeHours: number,
  autoCalc: boolean,
  patch: Pick<Employee, "primaryStoreId" | "storeIds" | "primaryStore">,
): Employee {
  return {
    ...e,
    unavailablePeriods: e.unavailablePeriods ?? [],
    recurringUnavailablePeriods: e.recurringUnavailablePeriods ?? [],
    contractHours: autoCalc ? calculateContractHours(e.contractPercent, fullTimeHours) : e.contractHours,
    primaryStoreId: patch.primaryStoreId,
    storeIds: patch.storeIds,
    primaryStore: patch.primaryStore,
  };
}

export function EmployeeDetailsPanel({
  open,
  employee,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSave: (updated: Employee) => void;
  onDelete: (id: string) => void;
}) {
  const { settings } = useSettings();
  const { stores } = useStores();
  const storesActive = useMemo(() => activeStores(stores), [stores]);

  const storeOptions = useMemo(
    () => [...storesActive].sort((a, b) => a.name.localeCompare(b.name, "nb")),
    [storesActive],
  );
  const storeById = useMemo(() => new Map(storeOptions.map((s) => [s.id, s] as const)), [storeOptions]);

  const [draft, setDraft] = useState<Employee | null>(employee);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  useEffect(() => {
    setDeleteConfirmOpen(false);
    if (!employee) {
      setDraft(null);
      setLinkEmail("");
      setLinkError(null);
      setLinkLoading(false);
      return;
    }

    const rawStoreIds = Array.isArray(employee.storeIds) ? employee.storeIds.filter(Boolean) : [];
    const rawPrimaryId = typeof employee.primaryStoreId === "string" ? employee.primaryStoreId : null;

    let storeIds = rawStoreIds;
    let primaryStoreId = rawPrimaryId;

    // Back-compat: if only primaryStore (site key) exists, try to infer store id (only if unambiguous).
    if (!primaryStoreId && storeIds.length === 0 && employee.primaryStore) {
      const matches = storeOptions.filter((s) => s.employeeSiteKey === employee.primaryStore);
      if (matches.length === 1) {
        primaryStoreId = matches[0]!.id;
        storeIds = [matches[0]!.id];
      }
    }

    if (primaryStoreId && !storeIds.includes(primaryStoreId)) storeIds = [primaryStoreId, ...storeIds];
    if (!primaryStoreId && storeIds.length > 0) primaryStoreId = storeIds[0] ?? null;

    const primaryStore = (primaryStoreId ? storeById.get(primaryStoreId)?.employeeSiteKey ?? null : null) as Employee["primaryStore"];

    setDraft(
      normalizeEmployee(employee, settings.fullTimeHours, settings.autoCalculateContractHours, {
        primaryStoreId,
        storeIds,
        primaryStore,
      }),
    );
    setLinkEmail("");
    setLinkError(null);
    setLinkLoading(false);
  }, [employee, settings.autoCalculateContractHours, settings.fullTimeHours, storeById, storeOptions]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const title = useMemo(() => draft?.name ?? "Ny ansatt", [draft?.name]);

  const canSave = Boolean(draft);

  const derivedContractHours = useMemo(() => {
    if (!draft) return 0;
    return settings.autoCalculateContractHours
      ? calculateContractHours(draft.contractPercent, settings.fullTimeHours)
      : draft.contractHours;
  }, [draft, settings.autoCalculateContractHours, settings.fullTimeHours]);

  function patchPeriod(id: string, patch: Partial<UnavailablePeriod>) {
    if (!draft) return;
    setDraft({
      ...draft,
      unavailablePeriods: draft.unavailablePeriods.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function removePeriod(id: string) {
    if (!draft) return;
    setDraft({ ...draft, unavailablePeriods: draft.unavailablePeriods.filter((p) => p.id !== id) });
  }

  function addPeriod() {
    if (!draft) return;
    const day = todayIsoLocal();
    const next: UnavailablePeriod = {
      id: makeId(),
      startDate: day,
      endDate: day,
      reason: "Fri",
      startTime: "",
      endTime: "",
    };
    setDraft({ ...draft, unavailablePeriods: [...draft.unavailablePeriods, next] });
  }

  function patchRecurring(id: string, patch: Partial<RecurringUnavailablePeriod>) {
    if (!draft) return;
    const list = Array.isArray(draft.recurringUnavailablePeriods) ? draft.recurringUnavailablePeriods : [];
    setDraft({
      ...draft,
      recurringUnavailablePeriods: list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function removeRecurring(id: string) {
    if (!draft) return;
    const list = Array.isArray(draft.recurringUnavailablePeriods) ? draft.recurringUnavailablePeriods : [];
    setDraft({ ...draft, recurringUnavailablePeriods: list.filter((p) => p.id !== id) });
  }

  function addRecurring() {
    if (!draft) return;
    const list = Array.isArray(draft.recurringUnavailablePeriods) ? draft.recurringUnavailablePeriods : [];
    const next: RecurringUnavailablePeriod = {
      id: makeId(),
      weekday: 0,
      startTime: "08:00",
      endTime: "15:00",
      reason: "Skole",
      validFrom: "",
      validTo: "",
    };
    setDraft({ ...draft, recurringUnavailablePeriods: [...list, next] });
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
          "absolute right-0 top-0 h-full w-full max-w-[440px] transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="h-full p-4 sm:p-6">
          <div className="relative flex h-full flex-col rounded-[32px] bg-white/85 shadow-[0_28px_70px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.05] backdrop-blur">
            <div className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-slate-500">Ansatt</div>
                <div className="mt-1 truncate text-[18px] font-semibold tracking-tight text-slate-900">{title}</div>
                <div className="mt-1 text-[13px] font-semibold text-slate-600">
                  {draft
                    ? `${employeeStoreLabel({ employee: draft, stores: storeOptions })} • ${draft.contractPercent}%`
                    : ""}
                </div>
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
              <div className="rounded-3xl bg-[#F6F8FC] p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
                <div className="grid grid-cols-2 gap-3 text-[12.5px] font-semibold text-slate-700">
                  <div>
                    <div className="text-[12px] font-semibold text-slate-500">Kontrakt</div>
                    <div className="mt-1">{draft ? `${formatHours(derivedContractHours)} t/uke` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-slate-500">Tilgjengelighet (ukedager)</div>
                    <div className="mt-1">{draft ? availabilityLabel(draft.unavailableDays) : "—"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white/70 p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
                <SectionTitle>Basisinfo</SectionTitle>

                <div className="mt-3">
                  <FieldLabel>Navn</FieldLabel>
                  <SoftInput value={draft?.name ?? ""} onChange={(e) => draft && setDraft({ ...draft, name: e.target.value })} disabled={!draft} />
                </div>

                {!useMockData ? (
                  <div className="mt-4">
                    <SectionTitle>Brukerkonto</SectionTitle>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <FieldLabel>Status</FieldLabel>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1",
                          draft?.userId
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                            : "bg-slate-50 text-slate-700 ring-slate-200",
                        )}
                      >
                        {draft?.userId ? "Aktiv" : "Ikke koblet"}
                      </span>
                    </div>

                    <div className="mt-3">
                      <FieldLabel>Knytt til bruker (email)</FieldLabel>
                    <SoftInput
                      value={linkEmail}
                      onChange={(e) => setLinkEmail(e.target.value)}
                      placeholder="navn@firma.no"
                      disabled={!draft || linkLoading}
                    />
                    </div>
                    {linkError ? (
                      <div className="mt-2 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-800 ring-1 ring-rose-100">
                        {linkError}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={!draft || linkLoading || linkEmail.trim().length < 3}
                      onClick={async () => {
                        if (!draft) return;
                        setLinkError(null);
                        setLinkLoading(true);
                        try {
                          const user = await getCurrentUser();
                          const email = linkEmail.trim().toLowerCase();
                          const userEmail = (user?.email ?? "").toLowerCase();
                          if (!user || !userEmail) throw new Error("Ikke innlogget");
                          if (email !== userEmail) throw new Error("E-post må matche innlogget bruker for nå");

                          const supabase = getSupabaseClient();
                          const { error } = await supabase
                            .from("employees")
                            .update({ user_id: user.id, role: "employee" })
                            .eq("id", draft.id);
                          if (error) throw error;

                          const updated: Employee = { ...draft, userId: user.id, role: "employee" };
                          setDraft(updated);
                          onSave(updated);
                          setLinkEmail("");
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : "Kunne ikke knytte bruker";
                          setLinkError(msg);
                        } finally {
                          setLinkLoading(false);
                        }
                      }}
                      className={cn(
                        "mt-3 w-full rounded-2xl bg-white/80 px-4 py-2.5 text-[13px] font-semibold text-slate-800 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white",
                        (linkLoading || !draft) && "opacity-60 hover:bg-white/80",
                      )}
                    >
                      Knytt bruker
                    </button>
                  </div>
                ) : null}

                <div className="mt-4">
                  <SectionTitle>Kontrakt</SectionTitle>
                  <div className="mt-3">
                    <FieldLabel>Butikker</FieldLabel>
                    {storeOptions.length === 0 ? (
                      <div className="mt-2 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200">
                        Ingen butikker
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {storeOptions.map((s) => {
                          const selected = Boolean(draft?.storeIds?.includes(s.id));
                          return (
                            <button
                              key={s.id}
                              type="button"
                              disabled={!draft}
                              onClick={() => {
                                if (!draft) return;
                                const has = draft.storeIds.includes(s.id);
                                const nextStoreIds = has ? draft.storeIds.filter((id) => id !== s.id) : [...draft.storeIds, s.id];

                                let nextPrimaryId = draft.primaryStoreId;
                                if (has && draft.primaryStoreId === s.id) nextPrimaryId = nextStoreIds[0] ?? null;
                                if (!has && !draft.primaryStoreId) nextPrimaryId = s.id;

                                const nextPrimaryStore = (nextPrimaryId ? storeById.get(nextPrimaryId)?.employeeSiteKey ?? null : null) as Employee["primaryStore"];

                                setDraft({
                                  ...draft,
                                  storeIds: nextStoreIds,
                                  primaryStoreId: nextPrimaryId,
                                  primaryStore: nextPrimaryStore,
                                });
                              }}
                              className={cn(
                                "rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05]",
                                selected ? "bg-violet-50 text-violet-700 ring-violet-100" : "bg-white/70 text-slate-700 hover:bg-white",
                              )}
                            >
                              {s.name}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-3">
                      <FieldLabel>Primærbutikk</FieldLabel>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!draft}
                          onClick={() => {
                            if (!draft) return;
                            setDraft({ ...draft, primaryStoreId: null, primaryStore: null, storeIds: [] });
                          }}
                          className={cn(
                            "rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05]",
                            draft?.primaryStoreId == null ? "bg-violet-600 text-white ring-violet-200" : "bg-white/70 text-slate-700 hover:bg-white",
                          )}
                        >
                          Ikke tilknyttet
                        </button>
                        {(draft?.storeIds ?? []).map((id) => {
                          const st = storeById.get(id);
                          if (!st) return null;
                          const selected = draft?.primaryStoreId === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              disabled={!draft}
                              onClick={() => {
                                if (!draft) return;
                                const nextPrimaryStore = (st.employeeSiteKey ?? null) as Employee["primaryStore"];
                                setDraft({ ...draft, primaryStoreId: id, primaryStore: nextPrimaryStore });
                              }}
                              className={cn(
                                "rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05]",
                                selected ? "bg-violet-600 text-white ring-violet-200" : "bg-white/70 text-slate-700 hover:bg-white",
                              )}
                            >
                              {st.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <FieldLabel>Stillingsprosent</FieldLabel>
                  <SoftInput
                    inputMode="numeric"
                    value={String(draft?.contractPercent ?? "")}
                    onChange={(e) => {
                      if (!draft) return;
                      const n = Number(e.target.value);
                      const pct = Number.isFinite(n) ? n : draft.contractPercent;
                      setDraft({
                        ...draft,
                        contractPercent: pct,
                        contractHours: settings.autoCalculateContractHours
                          ? calculateContractHours(pct, settings.fullTimeHours)
                          : draft.contractHours,
                      });
                    }}
                    disabled={!draft}
                  />
                  <p className="mt-2 text-[12px] font-medium leading-relaxed text-slate-500">
                    Kontraktstimer beregnes automatisk ut fra stillingsprosent.{" "}
                    <span className="font-semibold text-slate-600">
                      {String(settings.fullTimeHours).replace(".", ",")} t/uke ved 100%.
                    </span>
                  </p>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>Kontraktstimer (auto-beregnet)</FieldLabel>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                      Auto
                    </span>
                  </div>
                  <SoftInput
                    readOnly
                    tabIndex={-1}
                    value={draft ? formatHours(derivedContractHours) : ""}
                    disabled={!draft}
                    className="cursor-default bg-slate-50/80 text-slate-700"
                  />
                </div>

                <div className="mt-4">
                  <SectionTitle>Utilgjengelighet</SectionTitle>
                  <div className="mt-3">
                    <FieldLabel>Ukedager (gjentakende)</FieldLabel>
                  <p className="mt-1 text-[12px] font-medium text-slate-500">Utilgjengelige ukedager (gjentakende)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dayShort.map((label, idx) => {
                      const selected = draft?.unavailableDays.includes(idx) ?? false;
                      return (
                        <button
                          key={label}
                          type="button"
                          disabled={!draft}
                          onClick={() => {
                            if (!draft) return;
                            const has = draft.unavailableDays.includes(idx);
                            const nextDays = has ? draft.unavailableDays.filter((d) => d !== idx) : [...draft.unavailableDays, idx];
                            setDraft({ ...draft, unavailableDays: nextDays });
                          }}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-[12px] font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05]",
                            selected ? "bg-violet-50 text-violet-700 ring-violet-100" : "bg-white/70 text-slate-600 hover:bg-white",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-900/[0.06] pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>Fast utilgjengelighet</FieldLabel>
                    <button
                      type="button"
                      disabled={!draft}
                      onClick={addRecurring}
                      className="rounded-full bg-white/80 px-3 py-1.5 text-[11.5px] font-semibold text-violet-700 shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-violet-100 hover:bg-violet-50 disabled:opacity-50"
                    >
                      + Legg til fast
                    </button>
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-slate-500">
                    Gjentakende blokkeringer per ukedag, med valgfri tidsperiode og gyldighetsdato.
                  </p>

                  <div className="mt-3 space-y-3">
                    {(draft?.recurringUnavailablePeriods ?? []).map((p) => {
                      const dayLabel = dayShort[p.weekday] ?? `Dag ${p.weekday}`;
                      const wholeDay = !(p.startTime && p.endTime);
                      const validity =
                        (p.validFrom ? `fra ${p.validFrom}` : "") +
                        (p.validTo ? `${p.validFrom ? " " : ""}til ${p.validTo}` : "");

                      return (
                        <div
                          key={p.id}
                          className="rounded-2xl bg-[#F6F8FC] p-3.5 shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.04]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white/80 px-3 py-1 text-[11.5px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.05]">
                                  {dayLabel}
                                </span>
                                <div className="text-[13px] font-semibold text-slate-900">
                                  {wholeDay ? "Hele dagen" : `${p.startTime}–${p.endTime}`}
                                  {p.reason ? ` · ${p.reason}` : ""}
                                </div>
                              </div>
                              {validity.trim() ? (
                                <div className="mt-1 text-[12px] font-medium text-slate-500">{validity.trim()}</div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeRecurring(p.id)}
                              className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:text-rose-600"
                              aria-label="Fjern fast utilgjengelighet"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <div className="text-[11px] font-semibold text-slate-500">Ukedag</div>
                              <SoftSelect
                                className="mt-1"
                                value={String(p.weekday)}
                                onChange={(e) => patchRecurring(p.id, { weekday: Number(e.target.value) })}
                              >
                                {dayShort.map((lbl, idx) => (
                                  <option key={lbl} value={String(idx)}>
                                    {lbl}
                                  </option>
                                ))}
                              </SoftSelect>
                            </div>

                            <div className="col-span-2 flex items-center justify-between rounded-2xl bg-white/70 px-3.5 py-2.5 ring-1 ring-slate-900/[0.05]">
                              <div className="text-[12px] font-semibold text-slate-600">Hele dagen</div>
                              <button
                                type="button"
                                disabled={!draft}
                                onClick={() => {
                                  const makeWholeDay = !wholeDay;
                                  if (makeWholeDay) patchRecurring(p.id, { startTime: "", endTime: "" });
                                  else patchRecurring(p.id, { startTime: "08:00", endTime: "15:00" });
                                }}
                                className={cn(
                                  "rounded-full px-3 py-1 text-[12px] font-semibold ring-1 ring-slate-900/[0.06]",
                                  wholeDay ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-100 text-slate-600",
                                )}
                              >
                                {wholeDay ? "På" : "Av"}
                              </button>
                            </div>

                            {!wholeDay ? (
                              <>
                                <div>
                                  <TimePickerField
                                    label="Start"
                                    value={p.startTime ?? ""}
                                    onChange={(v) => patchRecurring(p.id, { startTime: v })}
                                    inputClassName="mt-1 px-3 py-2 text-[13px]"
                                  />
                                </div>
                                <div>
                                  <TimePickerField
                                    label="Slutt"
                                    value={p.endTime ?? ""}
                                    onChange={(v) => patchRecurring(p.id, { endTime: v })}
                                    inputClassName="mt-1 px-3 py-2 text-[13px]"
                                  />
                                </div>
                              </>
                            ) : null}

                            <div className="col-span-2">
                              <div className="text-[11px] font-semibold text-slate-500">Årsak (valgfritt)</div>
                              <SoftInput
                                className="mt-1"
                                placeholder="F.eks. Skole"
                                value={p.reason ?? ""}
                                onChange={(e) => patchRecurring(p.id, { reason: e.target.value })}
                              />
                            </div>

                            <div>
                              <div className="text-[11px] font-semibold text-slate-500">Gyldig fra (valgfritt)</div>
                              <SoftInput
                                type="date"
                                className="mt-1"
                                value={p.validFrom ?? ""}
                                onChange={(e) => patchRecurring(p.id, { validFrom: e.target.value })}
                              />
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold text-slate-500">Gyldig til (valgfritt)</div>
                              <SoftInput
                                type="date"
                                className="mt-1"
                                value={p.validTo ?? ""}
                                onChange={(e) => patchRecurring(p.id, { validTo: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-900/[0.06] pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>Utilgjengelige perioder</FieldLabel>
                    <button
                      type="button"
                      disabled={!draft}
                      onClick={addPeriod}
                      className="rounded-full bg-white/80 px-3 py-1.5 text-[11.5px] font-semibold text-violet-700 shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-violet-100 hover:bg-violet-50 disabled:opacity-50"
                    >
                      + Legg til periode
                    </button>
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-slate-500">Konkrete fravær eller blokker med dato og valgfri klokkeslett.</p>

                  <div className="mt-3 space-y-3">
                    {draft?.unavailablePeriods.map((p) => {
                      const line = formatPeriodSummary(p);
                      return (
                        <div
                          key={p.id}
                          className="rounded-2xl bg-[#F6F8FC] p-3.5 shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.04]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white/80 px-3 py-1 text-[11.5px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.05]">
                                  {p.reason}
                                </span>
                                <div className="text-[13px] font-semibold text-slate-900">{line || "—"}</div>
                              </div>
                              <div className="mt-1 text-[12px] font-medium text-slate-500">
                                {p.startTime && p.endTime ? `${p.startTime}–${p.endTime}` : "Hele dagen"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePeriod(p.id)}
                              className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:text-rose-600"
                              aria-label="Fjern periode"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-[11px] font-semibold text-slate-500">Fra dato</div>
                              <SoftInput
                                type="date"
                                className="mt-1"
                                value={p.startDate}
                                onChange={(e) => patchPeriod(p.id, { startDate: e.target.value })}
                              />
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold text-slate-500">Til dato</div>
                              <SoftInput
                                type="date"
                                className="mt-1"
                                value={p.endDate}
                                onChange={(e) => patchPeriod(p.id, { endDate: e.target.value })}
                              />
                            </div>
                            <div>
                              <TimePickerField
                                label="Start (valgfritt)"
                                value={p.startTime ?? ""}
                                onChange={(v) => patchPeriod(p.id, { startTime: v })}
                                inputClassName="mt-1 px-3 py-2 text-[13px]"
                              />
                            </div>
                            <div>
                              <TimePickerField
                                label="Slutt (valgfritt)"
                                value={p.endTime ?? ""}
                                onChange={(v) => patchPeriod(p.id, { endTime: v })}
                                inputClassName="mt-1 px-3 py-2 text-[13px]"
                              />
                            </div>
                            <div className="col-span-2">
                              <div className="text-[11px] font-semibold text-slate-500">Årsak</div>
                              <SoftSelect
                                className="mt-1"
                                value={p.reason}
                                onChange={(e) => patchPeriod(p.id, { reason: e.target.value as UnavailablePeriodReason })}
                              >
                                {periodReasons.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </SoftSelect>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* "+ Legg til periode" shown in header */}
                </div>

                <div className="mt-4">
                  <SectionTitle>Notater</SectionTitle>
                  <div className="mt-3">
                    <FieldLabel>Notater</FieldLabel>
                  <SoftTextarea value={draft?.notes ?? ""} onChange={(e) => draft && setDraft({ ...draft, notes: e.target.value })} disabled={!draft} />
                  </div>
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
                Slett ansatt
              </button>

              <button
                type="button"
                onClick={() =>
                  draft &&
                  onSave(
                    (() => {
                      const storeIds = Array.isArray(draft.storeIds) ? draft.storeIds.filter(Boolean) : [];
                      const primaryStoreId = (draft.primaryStoreId ?? null) ?? (storeIds[0] ?? null);
                      const primaryStore = (primaryStoreId
                        ? storeById.get(primaryStoreId)?.employeeSiteKey ?? null
                        : null) as Employee["primaryStore"];
                      return normalizeEmployee(draft, settings.fullTimeHours, settings.autoCalculateContractHours, {
                        primaryStoreId,
                        storeIds,
                        primaryStore,
                      });
                    })(),
                  )
                }
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
                <div className="w-full max-w-[340px] rounded-[26px] bg-white p-5 shadow-[0_28px_70px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/[0.06]">
                  <div className="text-[15px] font-semibold text-slate-900">Slette ansatt?</div>
                  <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-600">
                    Er du sikker på at du vil slette denne ansatte? Vakter knyttet til personen fjernes også.
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
