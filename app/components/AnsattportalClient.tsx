"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmployeeRequestType, Shift, ShiftStatus } from "@/app/lib/types";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { addDays, baseWeekStart, dayShort, formatNorDate } from "@/app/lib/mockData";
import { cn } from "@/app/lib/cn";
import { shiftDurationHours } from "@/app/lib/hours";
import { RequestModal } from "@/app/components/RequestModal";
import { getLinkedEmployeeId, getUserRole, signOut } from "@/app/lib/auth";
import { createRequest, getMyRequests } from "@/app/lib/api";
import { StatusToast, useStatusToast } from "@/app/components/StatusToast";
import {
  requestStatusBadgeClass,
  requestStatusLabel,
  requestTypeLabel,
} from "@/app/lib/requestHelpers";
import { absenceTypeBadgeClass, buildUpcomingAbsences } from "@/app/lib/absenceOverview";
import { todayLocal } from "@/app/lib/weekDate";
import type { EmployeeRequest } from "@/app/lib/types";

type LinkState = "loading" | "ready" | "missing";

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

function shiftDate(week: number, day: number) {
  return addDays(baseWeekStart, week * 7 + day);
}

function isShiftTodayOrFuture(s: Shift): boolean {
  const d = shiftDate(s.week, s.day);
  const today = todayLocal();
  return d.getTime() >= today.getTime();
}

function formatDayDate(week: number, day: number) {
  const d = shiftDate(week, day);
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
  if (/city\s*lade/i.test(store)) return "City Lade";
  return store || "—";
}

function PortalSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-28 rounded-[28px] bg-white/60 ring-1 ring-slate-900/[0.04]" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-12 rounded-2xl bg-white/60" />
        <div className="h-12 rounded-2xl bg-white/60" />
        <div className="h-12 rounded-2xl bg-white/60" />
      </div>
      <div className="h-40 rounded-3xl bg-white/60" />
      <div className="h-56 rounded-3xl bg-white/60" />
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[26px] bg-[#F6F8FC] p-4 text-[13px] font-medium leading-relaxed text-slate-600 ring-1 ring-slate-900/[0.04]">
      {children}
    </div>
  );
}

export function AnsattportalClient() {
  const router = useRouter();
  const { employees, shifts, employeesLoading, shiftsLoading } = useWorkforce();
  const { toast, showToast } = useStatusToast();

  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<LinkState>("loading");
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [requestType, setRequestType] = useState<EmployeeRequestType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<EmployeeRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const reloadMyRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const data = await getMyRequests();
      setMyRequests(data);
    } catch (err) {
      console.error("[Shiftly][portal] requests load failed", err);
      setMyRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    let alive = true;
    setLinkState("loading");
    getLinkedEmployeeId()
      .then((id) => {
        if (!alive) return;
        setLinkedEmployeeId(id);
        setLinkState(id ? "ready" : "missing");
      })
      .catch(() => {
        if (!alive) return;
        setLinkedEmployeeId(null);
        setLinkState("missing");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (linkState !== "ready" || !linkedEmployeeId) {
      setMyRequests([]);
      setRequestsLoading(false);
      return;
    }
    void reloadMyRequests();
  }, [linkState, linkedEmployeeId, reloadMyRequests]);

  const employee = useMemo(
    () => (linkedEmployeeId ? employees.find((e) => e.id === linkedEmployeeId) ?? null : null),
    [employees, linkedEmployeeId],
  );

  const isPageLoading =
    linkState === "loading" || employeesLoading || shiftsLoading || (linkState === "ready" && !employee && employees.length > 0);

  const published = useMemo(() => {
    if (!linkedEmployeeId) return [];
    return shifts
      .filter((s) => s.employeeId === linkedEmployeeId && (s.publishState ?? "draft") === "published")
      .slice()
      .sort((a, b) => shiftSortKey(a).localeCompare(shiftSortKey(b)));
  }, [linkedEmployeeId, shifts]);

  const publishedWorkShifts = useMemo(
    () => published.filter((s) => shiftDurationHours(s) > 0),
    [published],
  );

  const upcomingShifts = useMemo(
    () => published.filter((s) => isShiftTodayOrFuture(s)),
    [published],
  );

  const nextShift = useMemo(() => {
    return (
      upcomingShifts.find((s) => shiftDurationHours(s) > 0) ??
      upcomingShifts[0] ??
      null
    );
  }, [upcomingShifts]);

  const groupedByWeek = useMemo(() => {
    const map = new Map<number, Shift[]>();
    for (const s of upcomingShifts) {
      const list = map.get(s.week) ?? [];
      list.push(s);
      map.set(s.week, list);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [upcomingShifts]);

  const upcomingAbsences = useMemo(
    () => (employee ? buildUpcomingAbsences([employee], 8) : []),
    [employee],
  );

  const sortedRequests = useMemo(
    () =>
      myRequests.slice().sort((a, b) => {
        const sRank = (s: EmployeeRequest["status"]) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
        const rank = sRank(a.status) - sRank(b.status);
        if (rank !== 0) return rank;
        return String(b.date).localeCompare(String(a.date));
      }),
    [myRequests],
  );

  const canSubmitRequests = linkState === "ready" && Boolean(linkedEmployeeId);

  return (
    <div className="min-h-screen w-full bg-[#F3F6FB] text-slate-900">
      <div className="mx-auto w-full max-w-[560px] px-4 py-6 sm:px-6">
        <header className="rounded-[28px] bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[24px] font-semibold tracking-tight text-slate-900">Mine vakter</div>
              <p className="mt-2 text-[13px] font-medium text-slate-600">
                {employee ? (
                  <>
                    Hei, <span className="font-semibold text-slate-800">{employee.name}</span>. Her ser du dine
                    publiserte vakter og forespørsler.
                  </>
                ) : linkState === "missing" ? (
                  <>Kontoen din er ikke koblet til en ansattprofil ennå.</>
                ) : (
                  <>Laster din profil…</>
                )}
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
        </header>

        {isPageLoading ? (
          <div className="mt-6">
            <PortalSkeleton />
          </div>
        ) : linkState === "missing" ? (
          <section className="mt-6">
            <EmptyCard>
              Vi fant ingen ansattprofil knyttet til innloggingen din. Be leder om å koble brukeren din til riktig
              ansatt i systemet, og prøv igjen etterpå.
            </EmptyCard>
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                disabled={!canSubmitRequests || isSubmitting}
                onClick={() => setRequestType("be_om_fri")}
                className="rounded-2xl bg-white/85 px-4 py-3 text-[13px] font-semibold text-slate-800 shadow-[0_12px_26px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white disabled:opacity-50"
              >
                Be om fri
              </button>
              <button
                type="button"
                disabled={!canSubmitRequests || isSubmitting}
                onClick={() => setRequestType("bytt_vakt")}
                className="rounded-2xl bg-white/85 px-4 py-3 text-[13px] font-semibold text-slate-800 shadow-[0_12px_26px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white disabled:opacity-50"
              >
                Bytt vakt
              </button>
              <button
                type="button"
                disabled={!canSubmitRequests || isSubmitting}
                onClick={() => setRequestType("meld_sykdom")}
                className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-800 shadow-[0_12px_26px_rgba(15,23,42,0.06)] ring-1 ring-rose-100 hover:bg-rose-100 disabled:opacity-50"
              >
                Meld sykdom
              </button>
            </section>

            <section className="mt-6 rounded-3xl bg-white/80 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[16px] font-semibold text-slate-900">Neste vakt</div>
                  <p className="mt-1 text-[12.5px] font-medium text-slate-500">Kommende publiserte vakter.</p>
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
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1 ring-black/[0.04]",
                        statusPill(nextShift.status),
                      )}
                    >
                      {statusLabel(nextShift.status)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyCard>Du har ingen kommende publiserte vakter akkurat nå.</EmptyCard>
                </div>
              )}
            </section>

            <section className="mt-6 rounded-3xl bg-white/80 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
              <div className="text-[16px] font-semibold text-slate-900">Kommende vakter</div>
              <p className="mt-1 text-[12.5px] font-medium text-slate-500">Dine publiserte vakter fremover i tid.</p>

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
                            <span
                              className={cn(
                                "rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1 ring-black/[0.04]",
                                statusPill(s.status),
                              )}
                            >
                              {statusLabel(s.status)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {upcomingShifts.length === 0 ? (
                  <EmptyCard>Ingen kommende vakter å vise.</EmptyCard>
                ) : null}
              </div>
            </section>

            <section className="mt-6 rounded-3xl bg-white/80 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
              <div className="text-[16px] font-semibold text-slate-900">Mine fravær</div>
              <p className="mt-1 text-[12.5px] font-medium text-slate-500">Registrert utilgjengelighet og fravær.</p>

              <ul className="mt-4 space-y-2">
                {upcomingAbsences.map((row) => (
                  <li
                    key={row.id}
                    className={cn(
                      "rounded-[24px] px-4 py-3 ring-1 ring-slate-900/[0.04]",
                      row.isActive ? "bg-violet-50/50 ring-violet-100/80" : "bg-[#F6F8FC]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ring-1",
                          absenceTypeBadgeClass(row.type),
                        )}
                      >
                        {row.type}
                      </span>
                      {row.isActive ? (
                        <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Aktiv
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 text-[12.5px] font-medium text-slate-700">{row.whenLabel}</div>
                    {row.timeLabel ? (
                      <div className="mt-0.5 text-[11.5px] font-medium text-sky-800">{row.timeLabel}</div>
                    ) : null}
                    {row.note ? <div className="mt-0.5 text-[11px] text-slate-500">{row.note}</div> : null}
                  </li>
                ))}
                {upcomingAbsences.length === 0 ? (
                  <li>
                    <EmptyCard>Du har ingen registrert fravær fremover.</EmptyCard>
                  </li>
                ) : null}
              </ul>
            </section>

            <section className="mt-6 rounded-3xl bg-white/80 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
              <div className="text-[16px] font-semibold text-slate-900">Mine forespørsler</div>
              <p className="mt-1 text-[12.5px] font-medium text-slate-500">
                Status på dine innsendte forespørsler til leder.
              </p>

              {requestsLoading ? (
                <div className="mt-4 space-y-2">
                  <div className="h-16 animate-pulse rounded-[24px] bg-[#F6F8FC]" />
                  <div className="h-16 animate-pulse rounded-[24px] bg-[#F6F8FC]" />
                </div>
              ) : sortedRequests.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {sortedRequests.map((r) => (
                    <div key={r.id} className="rounded-[24px] bg-[#F6F8FC] px-4 py-3 ring-1 ring-slate-900/[0.04]">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-slate-900">
                            {requestTypeLabel(r.type)} · {r.date}
                          </div>
                          {r.message ? (
                            <div className="mt-1 text-[12px] font-medium text-slate-600">{r.message}</div>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1",
                            requestStatusBadgeClass(r.status),
                          )}
                        >
                          {requestStatusLabel(r.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyCard>
                    Du har ikke sendt noen forespørsler ennå. Bruk knappene over for å be om fri, bytte vakt eller melde
                    sykdom.
                  </EmptyCard>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <RequestModal
        open={Boolean(requestType)}
        type={requestType ?? "be_om_fri"}
        availableShifts={publishedWorkShifts}
        isSubmitting={isSubmitting}
        onClose={() => {
          if (!isSubmitting) setRequestType(null);
        }}
        onSubmit={async ({ date, message, shiftId }) => {
          const derivedDate =
            requestType === "bytt_vakt"
              ? (() => {
                  const s = publishedWorkShifts.find((x) => x.id === shiftId) ?? null;
                  if (!s) return date;
                  const d = shiftDate(s.week, s.day);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                })()
              : date;

          if (!requestType || !linkedEmployeeId || isSubmitting) return;

          setIsSubmitting(true);
          try {
            const saved = await createRequest({
              employeeId: linkedEmployeeId,
              type: requestType,
              shiftId,
              date: derivedDate,
              message: message.trim(),
            });
            setMyRequests((prev) => [saved, ...prev]);
            setRequestType(null);
            showToast("Forespørsel sendt til leder");
            void reloadMyRequests();
          } catch (err) {
            console.error("[Shiftly][portal] submit failed", err);
            showToast("Kunne ikke sende forespørsel. Prøv igjen.", "negative");
          } finally {
            setIsSubmitting(false);
          }
        }}
      />

      <StatusToast toast={toast} />
    </div>
  );
}
