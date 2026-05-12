"use client";

import { useMemo, useState } from "react";
import type { Employee, EmployeeComputed, RetailStore, Shift } from "@/app/lib/types";
import { Sidebar } from "@/app/components/Sidebar";
import { TopBar } from "@/app/components/TopBar";
import { AlertsPanel } from "@/app/components/AlertsPanel";
import { StoreDetailsPanel } from "@/app/components/StoreDetailsPanel";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { useStores } from "@/app/components/StoresProvider";
import { useSettings } from "@/app/components/SettingsProvider";
import { addDays, baseWeekStart, dayShort, formatNorDate, makeId } from "@/app/lib/mockData";
import { createDefaultStoreDays, summarizeOpeningHours, summarizeWeeklyStaffing } from "@/app/lib/storesData";
import { formatHours, sumEmployeeWeekHours } from "@/app/lib/hours";
import { getContractStatus } from "@/app/lib/rules/contracts";
import { cn } from "@/app/lib/cn";
import { useAlerts } from "@/app/components/AlertsProvider";

function countEmployeesAtSite(employees: Employee[], site: RetailStore["employeeSiteKey"]) {
  if (!site) return 0;
  return employees.filter((e) => e.primaryStore != null && e.primaryStore === site).length;
}

export function ButikkerClient() {
  const { employees, shifts } = useWorkforce();
  const { stores, storesLoading, createOrUpdateStore, deleteStore: deleteStorePersist } = useStores();
  const { settings } = useSettings();
  const { activeAlerts, alertCount } = useAlerts();

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

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [alertsAnchorRect, setAlertsAnchorRect] = useState<DOMRect | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const selectedStore = useMemo(
    () => (selectedStoreId ? stores.find((s) => s.id === selectedStoreId) ?? null : null),
    [stores, selectedStoreId],
  );

  function openStore(id: string) {
    setSelectedStoreId(id);
    setPanelOpen(true);
  }

  function openNewStore() {
    const id = makeId();
    const next: RetailStore = {
      id,
      name: "Ny butikk",
      address: "Gateadresse, postnummer sted",
      phone: "",
      status: "active",
      notes: "",
      employeeSiteKey: null,
      days: createDefaultStoreDays(),
    };
    createOrUpdateStore(next);
    setSelectedStoreId(id);
    setPanelOpen(true);
  }

  function deleteStore(storeId: string) {
    setPanelOpen(false);
    setSelectedStoreId(null);
    deleteStorePersist(storeId);
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
            mode="stores"
            title="Butikker"
            alertsCount={alertCount}
            onBellClick={(rect) => {
              setAlertsAnchorRect(rect);
              setIsAlertsOpen((v) => !v);
            }}
            primaryActionLabel="+ Ny butikk"
            onPrimaryAction={openNewStore}
          />

          {!storesLoading && stores.length === 0 ? (
            <div className="mt-6 rounded-[28px] bg-white/80 p-8 text-center text-[14px] font-semibold text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
              Ingen butikker enda
            </div>
          ) : null}

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            {stores.map((store) => {
              const headcount = countEmployeesAtSite(employees, store.employeeSiteKey);
              const hoursLine = summarizeOpeningHours(store.days);
              const staffLine = summarizeWeeklyStaffing(store.days);
              const active = store.status === "active";

              return (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => openStore(store.id)}
                  className="rounded-[28px] bg-white/70 p-5 text-left shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] transition-colors hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-semibold text-slate-900">{store.name}</div>
                      <div className="mt-2 text-[12.5px] font-medium leading-relaxed text-slate-600">{store.address}</div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1 ring-black/[0.03]",
                        active ? "bg-[#DFF7E8] text-slate-900" : "bg-[#EEF1F6] text-slate-600",
                      )}
                    >
                      {active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-[12.5px] font-semibold text-slate-700">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Åpningstider</span>
                      <span className="text-right text-slate-800">{hoursLine}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Ansatte</span>
                      <span className="text-slate-800">{headcount} tilknyttet</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Bemanning</span>
                      <span className="text-right text-slate-800">{staffLine}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        </main>
      </div>

      <StoreDetailsPanel
        open={panelOpen}
        store={selectedStore}
        onClose={() => {
          setPanelOpen(false);
          setSelectedStoreId(null);
        }}
        onSave={(updated) => {
          createOrUpdateStore(updated);
        }}
        onDelete={deleteStore}
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
