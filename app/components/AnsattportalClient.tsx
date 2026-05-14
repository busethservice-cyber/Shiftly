"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmployeeRequestType, Shift, ShiftStatus } from "@/app/lib/types";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { useRequests } from "@/app/components/RequestsProvider";
import { addDays, baseWeekStart, dayShort, formatNorDate } from "@/app/lib/mockData";
import { cn } from "@/app/lib/cn";
import { shiftDurationHours } from "@/app/lib/hours";
import { RequestModal } from "@/app/components/RequestModal";
import { makeId } from "@/app/lib/mockData";
import { getUserRole, signOut } from "@/app/lib/auth";

function statusPill(status: ShiftStatus) {
  if (status === "over_limit") return "bg-rose-50 text-rose-800 ring-rose-100";
  if (status === "near_limit") return "bg-amber-50 text-amber-900 ring-amber-100";
  if (status === "unconfirmed") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-emerald-50 text-emerald-900 ring-emerald-100";
}

function statusLabel(status: ShiftStatus) {
  if (status === "over_limit") return "Over kontrakt";
  if (status === "near_limit") return "Nær grense";
  if (status === "unconfirmed") return "Ubekreftet";
  return "Innenfor";
}

function shiftSortKey(s: Shift) {
  const start = s.startTime || "00:00";
  return `${String(s.week).padStart(3, "0")}:${String(s.day).padStart(2, "0")}:${start}`;
}

function formatDayDate(week: number, day: number) {
  const d = addDays(baseWeekStart, week * 7 + day);
  return { short: dayShort[day] ?? `Dag ${day}`, date: formatNorDate(d) };
}

function timeLabel(s: Shift) {
  if (s.store === "Fri" || (!s.startTime && !s.endTime)) return "Fri";
  if (!s.startTime || !s.endTime) return "—";
  return `${s.startTime}–${s.endTime}`;
}

function storeLabel(store: string) {
  if (store === "Fri") return "Fri";
  if (/solsiden/i.test(store)) return "Solsiden";
  if (/city\\s*lade/i.test(store)) return "City Lade";
  return store || "—";
}

export function AnsattportalClient() {
  const router = useRouter();
  const { employees, shifts } = useWorkforce();
  const { setRequests } = useRequests();
  const [employeeId, setEmployeeId] = useState<string>(() => employees[0]?.id ?? "");
  const [requestType, setRequestType] = useState<EmployeeRequestType | null>(null);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    getUserRole()
      .then((r) => {
        if (!alive) return;
        setCanAccessAdmin(r === "admin");
      })
      .catch(() => {
        if (!alive) return;
        setCanAccessAdmin(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const employee = useMemo(() => employees.find((e) => e.id === employeeId) ?? null, [employees, employeeId]);

  const published = useMemo(() => {
    return shifts
      .filter((s) => s.employeeId === employeeId && (s.publishState ?? "draft") === "published")
      .slice()
      .sort((a, b) => shiftSortKey(a).localeCompare(shiftSortKey(b)));
  }, [employeeId, shifts]);

  const publishedWorkShifts = useMemo(
    () => published.filter((s) => shiftDurationHours(s) > 0),
    [published],
  );

  const nextShift = useMemo(() => {
    return (
      published.find((s) => shiftDurationHours(s) > 0) ??
      published[0] ??
      null
    );
  }, [published]);

  const groupedByWeek = useMemo(() => {
    const map = new Map<number, Shift[]>();
    for (const s of published) {
      const list = map.get(s.week) ?? [];
      list.push(s);
      map.set(s.week, list);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [published]);

  return (
    <div className="min-h-screen w-full bg-[#F3F6FB] text-slate-900">
      <div className="mx-auto w-full max-w-[560px] px-4 py-6 sm:px-6">
        <header className="rounded-[28px] bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[24px] font-semibold tracking-tight text-slate-900">Mine vakter</div>
              <p className="mt-2 text-[13px] font-medium text-slate-600">
                Velg ansatt for demo. Du ser kun <span className="font-semibold text-slate-800">publiserte</span> vakter.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {canAccessAdmin ? (
                <Link
                  href="/oversikt"
                  className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_12px_24px_rgba(124,58,237,0.25)] ring-1 ring-violet-500/30 hover:bg-violet-500"
                >
                  Til adminpanel
                </Link>
              ) : null}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signOut();
                  } catch (err) {
                    console.error("Sign out failed", err);
                  }
                  try {
                    router.replace("/login");
                  } catch {
                    window.location.assign("/login");
                  }
                }}
                className="rounded-2xl bg-white/90 px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.08] hover:bg-white"
              >
                Logg ut
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-[12px] font-semibold text-slate-600">Ansatt</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-2 w-full rounded-2xl bg-white/90 px-4 py-2.5 text-[13.5px] font-semibold text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-200"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setRequestType("be_om_fri")}
            className="rounded-2xl bg-white/85 px-4 py-3 text-[13px] font-semibold text-slate-800 shadow-[0_12px_26px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
          >
            Be om fri
          </button>
          <button
            type="button"
            onClick={() => setRequestType("bytt_vakt")}
            className="rounded-2xl bg-white/85 px-4 py-3 text-[13px] font-semibold text-slate-800 shadow-[0_12px_26px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
          >
            Bytt vakt
          </button>
          <button
            type="button"
            onClick={() => setRequestType("meld_sykdom")}
            className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-800 shadow-[0_12px_26px_rgba(15,23,42,0.06)] ring-1 ring-rose-100 hover:bg-rose-100"
          >
            Meld sykdom
          </button>
        </section>

        <section className="mt-6 rounded-3xl bg-white/80 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[16px] font-semibold text-slate-900">Neste vakt</div>
              <div className="mt-1 text-[12.5px] font-medium text-slate-500">
                {employee ? employee.name : "—"}
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
              Publisert
            </span>
          </div>

          {nextShift ? (
            <div className="mt-4 rounded-[26px] bg-[#F6F8FC] p-4 ring-1 ring-slate-900/[0.04]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-slate-900">
                    {formatDayDate(nextShift.week, nextShift.day).short}{" "}
                    <span className="text-slate-400">{formatDayDate(nextShift.week, nextShift.day).date}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] font-medium text-slate-700">
                    {timeLabel(nextShift)} • {storeLabel(nextShift.store)}
                  </div>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1 ring-black/[0.04]", statusPill(nextShift.status))}>
                  {statusLabel(nextShift.status)}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[26px] bg-[#F6F8FC] p-4 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-900/[0.04]">
              Ingen publiserte vakter ennå.
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl bg-white/80 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
          <div className="text-[16px] font-semibold text-slate-900">Ukeoversikt</div>
          <p className="mt-1 text-[12.5px] font-medium text-slate-500">
            Publiserte vakter per uke (mock).
          </p>

          <div className="mt-4 space-y-5">
            {groupedByWeek.map(([week, list]) => (
              <div key={week} className="space-y-2">
                <div className="px-1 text-[12px] font-semibold text-slate-500">Uke {week + 1}</div>
                {list.map((s) => {
                  const d = formatDayDate(s.week, s.day);
                  return (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-[#F6F8FC] px-4 py-3 ring-1 ring-slate-900/[0.04]"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900">
                          {d.short} <span className="text-slate-400">{d.date}</span>
                        </div>
                        <div className="mt-1 text-[12.5px] font-medium text-slate-700">
                          {timeLabel(s)} • {storeLabel(s.store)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
                          Publisert
                        </span>
                        <span className={cn("rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1 ring-black/[0.04]", statusPill(s.status))}>
                          {statusLabel(s.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {published.length === 0 ? (
              <div className="rounded-[26px] bg-[#F6F8FC] p-4 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-900/[0.04]">
                Ingen publiserte vakter for valgt ansatt.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <RequestModal
        open={Boolean(requestType)}
        type={requestType ?? "be_om_fri"}
        availableShifts={publishedWorkShifts}
        onClose={() => setRequestType(null)}
        onSubmit={({ date, message, shiftId }) => {
          const derivedDate =
            requestType === "bytt_vakt"
              ? (() => {
                  const s = publishedWorkShifts.find((x) => x.id === shiftId) ?? null;
                  if (!s) return date;
                  const d = addDays(baseWeekStart, s.week * 7 + s.day);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                })()
              : date;

          if (!requestType) return;
          setRequests((prev) => [
            ...prev,
            {
              id: makeId(),
              employeeId,
              type: requestType,
              shiftId,
              date: derivedDate,
              message: message.trim(),
              status: "pending",
            },
          ]);
          setRequestType(null);
        }}
      />
    </div>
  );
}

