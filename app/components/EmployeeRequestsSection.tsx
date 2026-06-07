"use client";

import { cn } from "@/app/lib/cn";
import type { EmployeeRequest } from "@/app/lib/types";
import { requestStatusLabel, requestTypeLabel } from "@/app/lib/requestHelpers";

export function EmployeeRequestsSection({
  requests,
  employeeNameById,
  pendingCount,
  isMutating,
  onApprove,
  onReject,
  limit,
}: {
  requests: EmployeeRequest[];
  employeeNameById: Map<string, string>;
  pendingCount: number;
  isMutating: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  limit?: number;
}) {
  const sorted = requests
    .slice()
    .sort((a, b) => {
      const sRank = (s: EmployeeRequest["status"]) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
      const rank = sRank(a.status) - sRank(b.status);
      if (rank !== 0) return rank;
      return String(b.date).localeCompare(String(a.date));
    })
    .slice(0, limit ?? requests.length);

  return (
    <section className="rounded-3xl bg-white/80 p-6 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">Forespørsler</h2>
          <p className="mt-1 text-[13px] font-medium text-slate-500">Forespørsler fra ansatte.</p>
        </div>
        <div className="rounded-full bg-violet-50 px-3 py-1 text-[12px] font-semibold text-violet-800 ring-1 ring-violet-100">
          {pendingCount} venter
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {sorted.map((r) => {
          const typeLabel = requestTypeLabel(r.type);
          const statusLabel = requestStatusLabel(r.status);
          const statusStyles =
            r.status === "approved"
              ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
              : r.status === "rejected"
                ? "bg-rose-50 text-rose-800 ring-rose-100"
                : "bg-amber-50 text-amber-900 ring-amber-100";

          return (
            <div
              key={r.id}
              className="rounded-[28px] bg-[#F6F8FC] p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-slate-900">
                    {typeLabel} · {employeeNameById.get(r.employeeId) ?? "Ansatt"}
                  </div>
                  <div className="mt-1 text-[12.5px] font-medium text-slate-600">
                    {r.date}
                    {r.message ? ` · ${r.message}` : ""}
                  </div>
                  {r.type === "bytt_vakt" && r.status === "approved" ? (
                    <div className="mt-1 text-[12px] font-medium text-violet-700">
                      Godkjent — håndteres manuelt i planleggeren.
                    </div>
                  ) : null}
                </div>
                <span className={cn("rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1", statusStyles)}>
                  {statusLabel}
                </span>
              </div>

              {r.status === "pending" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => onApprove(r.id)}
                    className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.25)] hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Godkjenn
                  </button>
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => onReject(r.id)}
                    className="rounded-2xl bg-white/80 px-4 py-2.5 text-[13px] font-semibold text-rose-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-rose-100 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Avslå
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {requests.length === 0 ? (
          <div className="rounded-[28px] bg-[#F6F8FC] p-4 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-900/[0.04]">
            Ingen forespørsler ennå.
          </div>
        ) : null}
      </div>
    </section>
  );
}
