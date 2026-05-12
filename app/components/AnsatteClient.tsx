"use client";

import { useEffect, useMemo, useState } from "react";
import type { Employee, EmployeeComputed, Shift } from "@/app/lib/types";
import { Sidebar } from "@/app/components/Sidebar";
import { TopBar } from "@/app/components/TopBar";
import { AlertsPanel } from "@/app/components/AlertsPanel";
import { EmployeeDetailsPanel } from "@/app/components/EmployeeDetailsPanel";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { addDays, baseWeekStart, dayShort, formatNorDate, makeId } from "@/app/lib/mockData";
import { formatHours, sumEmployeeWeekHours } from "@/app/lib/hours";
import { calculateContractHours, getContractStatus } from "@/app/lib/rules/contracts";
import { cn } from "@/app/lib/cn";
import { useStores } from "@/app/components/StoresProvider";
import { useSettings } from "@/app/components/SettingsProvider";
import { useAlerts } from "@/app/components/AlertsProvider";
import { InviteEmployeeModal } from "@/app/components/InviteEmployeeModal";
import { useMockData } from "@/app/lib/runtimeConfig";
import { useInvites } from "@/app/components/InvitesProvider";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/app/lib/auth";
import { activeStores } from "@/app/lib/storeUtils";
import { employeeStoreLabel } from "@/app/lib/employeeStoreLabel";

const FILTER_ALLE = "alle";
const FILTER_UTIL = "utilgjengelig";
function storeFilterId(storeId: string) {
  return `store:${storeId}`;
}

function Avatar({ name, gradient }: { name: string; gradient: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "grid size-10 place-items-center rounded-full bg-gradient-to-br text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-white/60",
        gradient,
      )}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  );
}

function badgeClass(label: Employee["badges"][number]) {
  if (label === "Ferie") return "bg-[#E9DFFF] text-slate-800 ring-1 ring-black/[0.03]";
  if (label === "Syk") return "bg-[#FFD6DC] text-slate-900 ring-1 ring-black/[0.03]";
  if (label === "Fri") return "bg-[#EEF1F6] text-slate-700 ring-1 ring-black/[0.03]";
  return "bg-[#DFF7E8] text-slate-900 ring-1 ring-black/[0.03]";
}

function accountStatusLabel(e: Employee) {
  if (e.userId) return "Aktiv";
  if (/@/.test(e.name)) return "Invitert";
  return "Ikke koblet";
}

function accountStatusStyles(label: ReturnType<typeof accountStatusLabel>) {
  if (label === "Aktiv") return "bg-emerald-50 text-emerald-800 ring-emerald-100";
  if (label === "Invitert") return "bg-amber-50 text-amber-900 ring-amber-100";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function hasUtilgjengelig(e: Employee) {
  return e.unavailableDays.length > 0 || (e.unavailablePeriods?.length ?? 0) > 0;
}

export function AnsatteClient() {
  const { employees, updateEmployee, createEmployee, deleteEmployee: deleteEmployeePersist, shifts, setShifts, employeesLoading } = useWorkforce();
  const { stores, storesLoading } = useStores();
  const storesActive = useMemo(() => activeStores(stores), [stores]);
  const { settings } = useSettings();
  const { activeAlerts, alertCount } = useAlerts();
  const { addInvite } = useInvites();

  const weekOffset = 0;
  const days = useMemo(() => {
    const start = addDays(baseWeekStart, weekOffset * 7);
    return dayShort.map((short, idx) => {
      const d = addDays(start, idx);
      return { short, date: formatNorDate(d) };
    });
  }, []);

  const alertsContext = useMemo(() => {
    const weekShifts = shifts.filter((s) => s.week === weekOffset);
    const totals = new Map<string, number>();
    for (const e of employees) totals.set(e.id, 0);
    for (const e of employees) {
      const total = sumEmployeeWeekHours(weekShifts.filter((s) => s.employeeId === e.id));
      totals.set(e.id, total);
    }

    const employeesComputed: EmployeeComputed[] = employees.map((e) => {
      const total = totals.get(e.id) ?? 0;
      const status = getContractStatus(e, weekShifts, settings);
      const computedStatus = status === "over" ? "over_limit" : status === "near" ? "near_limit" : "normal";
      const progress = e.contractHours > 0 ? total / e.contractHours : 0;
      const contractLabel = `${e.contractPercent}% • ${formatHours(total)}/${formatHours(e.contractHours)} t`;
      return { ...e, totalHours: total, progress, contractLabel, computedStatus };
    });

    return { employeesComputed, weekShifts };
  }, [employees, shifts, settings]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>(FILTER_ALLE);

  useEffect(() => {
    if (filter === FILTER_ALLE || filter === FILTER_UTIL) return;
    if (!filter.startsWith("store:")) return;
    const id = filter.slice("store:".length);
    if (!storesActive.some((s) => s.id === id)) setFilter(FILTER_ALLE);
  }, [filter, storesActive]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [alertsAnchorRect, setAlertsAnchorRect] = useState<DOMRect | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const selectedEmployee = useMemo(
    () => (selectedEmployeeId ? employees.find((e) => e.id === selectedEmployeeId) ?? null : null),
    [employees, selectedEmployeeId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;

      if (filter === FILTER_UTIL) return hasUtilgjengelig(e);
      if (filter.startsWith("store:")) {
        const id = filter.slice("store:".length);
        const st = storesActive.find((s) => s.id === id);
        if (!st) return false;
        const storeIds = Array.isArray(e.storeIds) ? e.storeIds : [];
        if (storeIds.includes(st.id)) return true;
        if (e.primaryStoreId && e.primaryStoreId === st.id) return true;
        // Back-compat fallback: old site key mapping.
        if (st.employeeSiteKey && e.primaryStore === st.employeeSiteKey) return true;
        return false;
      }
      return true;
    });
  }, [employees, filter, search, storesActive]);

  function openEmployee(id: string) {
    setSelectedEmployeeId(id);
    setPanelOpen(true);
  }

  function openNewEmployee() {
    const id = makeId();
    const pct = 20;
    const primaryStoreId = storesActive[0]?.id ?? null;
    const next: Employee = {
      id,
      name: "Ny ansatt",
      contractPercent: pct,
      contractHours: settings.autoCalculateContractHours ? calculateContractHours(pct, settings.fullTimeHours) : 0,
      unavailableDays: [],
      unavailablePeriods: [],
      primaryStoreId,
      storeIds: primaryStoreId ? [primaryStoreId] : [],
      primaryStore: (primaryStoreId ? storesActive.find((s) => s.id === primaryStoreId)?.employeeSiteKey ?? null : null) as Employee["primaryStore"],
      badges: ["Tilgjengelig"],
      notes: "",
      avatarBg: "from-slate-200 to-slate-300",
    };
    createEmployee(next);
    setSelectedEmployeeId(id);
    setPanelOpen(true);
  }

  function deleteEmployee(employeeId: string) {
    setShifts((prev) => prev.filter((s) => s.employeeId !== employeeId));
    setPanelOpen(false);
    setSelectedEmployeeId(null);
    deleteEmployeePersist(employeeId);
  }

  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-[1280px] gap-7 px-6 py-6">
        <Sidebar
          onOpenAlerts={() => {
            setIsAlertsOpen(true);
            setAlertsAnchorRect(null);
          }}
        />

        <main className="min-w-0 flex-1">
          <TopBar
            mode="employees"
            title="Ansatte"
            alertsCount={alertCount}
            onBellClick={(rect) => {
              setAlertsAnchorRect(rect);
              setIsAlertsOpen((v) => !v);
            }}
            searchValue={search}
            onSearchChange={setSearch}
            primaryActionLabel="+ Ny ansatt"
            onPrimaryAction={openNewEmployee}
          />

          {employeesLoading || storesLoading ? (
            <div className="mt-4 rounded-[22px] bg-white/70 px-4 py-3 text-[13px] font-semibold text-slate-600 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
              Laster data…
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] hover:bg-white"
            >
              Inviter ansatt
            </button>
          </div>

          <section className="mt-6 rounded-[34px] bg-white/80 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
            <div className="flex flex-wrap gap-2 px-1">
              <button
                type="button"
                onClick={() => setFilter(FILTER_ALLE)}
                className={cn(
                  "rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05]",
                  filter === FILTER_ALLE ? "bg-violet-600 text-white ring-violet-200" : "bg-white/70 text-slate-700 hover:bg-white",
                )}
              >
                Alle
              </button>
              {storesActive.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFilter(storeFilterId(s.id))}
                  className={cn(
                    "rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05]",
                    filter === storeFilterId(s.id) ? "bg-violet-600 text-white ring-violet-200" : "bg-white/70 text-slate-700 hover:bg-white",
                  )}
                >
                  {s.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilter(FILTER_UTIL)}
                className={cn(
                  "rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05]",
                  filter === FILTER_UTIL ? "bg-violet-600 text-white ring-violet-200" : "bg-white/70 text-slate-700 hover:bg-white",
                )}
              >
                Utilgjengelig
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {filtered.length === 0 ? (
                <div className="rounded-[28px] bg-white/70 p-4 text-[13px] font-semibold text-slate-600 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05]">
                  Ingen ansatte funnet
                </div>
              ) : null}

              {filtered.map((e) => {
                const status = accountStatusLabel(e);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => openEmployee(e.id)}
                    className="w-full rounded-[28px] bg-white/70 p-3.5 text-left shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar name={e.name} gradient={e.avatarBg} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-[14px] font-semibold text-slate-900">{e.name}</div>
                          <span className={cn("rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1", accountStatusStyles(status))}>
                            {status}
                          </span>
                        </div>

                        <div className="mt-1 text-[12.5px] font-semibold text-slate-600">
                          {employeeStoreLabel({ employee: e, stores: storesActive })} • {e.contractPercent}% • {formatHours(e.contractHours)} t/uke
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {e.badges.map((b) => (
                            <span key={b} className={cn("rounded-full px-3 py-1 text-[11.5px] font-semibold", badgeClass(b))}>
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      <EmployeeDetailsPanel
        open={panelOpen}
        employee={selectedEmployee}
        onClose={() => {
          setPanelOpen(false);
          setSelectedEmployeeId(null);
        }}
        onSave={(updated) => updateEmployee(updated)}
        onDelete={deleteEmployee}
      />

      <InviteEmployeeModal
        open={inviteOpen}
        stores={storesActive}
        onCancel={() => setInviteOpen(false)}
        onSend={async ({ email, storeId, role }) => {
          const normalizedEmail = email.trim().toLowerCase();
          addInvite({ email: normalizedEmail, status: "pending" });

          if (useMockData) {
            const pct = 20;
            const st = storeId ? storesActive.find((s) => s.id === storeId) : null;
            const primaryStoreId = st?.id ?? null;
            const next: Employee = {
              id: makeId(),
              name: normalizedEmail,
              contractPercent: pct,
              contractHours: settings.autoCalculateContractHours ? calculateContractHours(pct, settings.fullTimeHours) : 0,
              unavailableDays: [],
              unavailablePeriods: [],
              primaryStoreId,
              storeIds: primaryStoreId ? [primaryStoreId] : [],
              primaryStore: (primaryStoreId ? st?.employeeSiteKey ?? null : null) as Employee["primaryStore"],
              badges: ["Tilgjengelig"],
              notes: "",
              avatarBg: "from-slate-200 to-slate-300",
              userId: undefined,
              role,
            };
            createEmployee(next);
            setInviteOpen(false);
            return;
          }

          const orgId = await getCurrentOrganizationId();
          if (!orgId) throw new Error("Ikke innlogget");

          const supabase = getSupabaseClient();
          const { data: existing, error: existingError } = await supabase
            .from("employees")
            .select("id")
            .eq("organization_id", orgId)
            .ilike("name", normalizedEmail)
            .maybeSingle();
          if (existingError) throw existingError;

          if (!existing?.id) {
            const { error: insError } = await supabase.from("employees").insert([
              {
                organization_id: orgId,
                store_id: storeId,
                user_id: null,
                role,
                name: normalizedEmail,
                position_percent: 20,
                contract_hours: 7.5,
                is_active: true,
              },
            ]);
            if (insError) throw insError;
          }

          setInviteOpen(false);
        }}
      />

      <AlertsPanel
        open={isAlertsOpen}
        anchorRect={alertsAnchorRect}
        alerts={activeAlerts}
        onClose={() => setIsAlertsOpen(false)}
      />
    </div>
  );
}
