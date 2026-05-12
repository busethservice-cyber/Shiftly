"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/app/lib/cn";

const LS_KEY = "shiftly:mvpTestChecklist";

const SECTIONS: Array<{ id: string; title: string; items: Array<{ id: string; label: string }> }> = [
  {
    id: "innlogging",
    title: "1. Innlogging",
    items: [
      { id: "login-1", label: "Logg inn" },
      { id: "login-2", label: "Logg ut" },
      { id: "login-3", label: "Refresh etter innlogging" },
    ],
  },
  {
    id: "planlegg",
    title: "2. Planlegging",
    items: [
      { id: "plan-1", label: "Legg til vakt" },
      { id: "plan-2", label: "Endre vakt" },
      { id: "plan-3", label: "Flytt vakt" },
      { id: "plan-4", label: "Slett vakt" },
      { id: "plan-5", label: "Kopier uke" },
      { id: "plan-6", label: "Auto-planlegg" },
      { id: "plan-7", label: "Publiser ukeplan" },
    ],
  },
  {
    id: "ansatte",
    title: "3. Ansatte",
    items: [
      { id: "emp-1", label: "Opprett ansatt" },
      { id: "emp-2", label: "Endre stillingsprosent" },
      { id: "emp-3", label: "Sjekk kontraktstimer" },
      { id: "emp-4", label: "Legg til utilgjengelighet" },
      { id: "emp-5", label: "Slett ansatt" },
    ],
  },
  {
    id: "butikker",
    title: "4. Butikker",
    items: [
      { id: "store-1", label: "Endre åpningstider" },
      { id: "store-2", label: "Endre minimumsbemanning" },
      { id: "store-3", label: "Sjekk at varsler påvirkes" },
    ],
  },
  {
    id: "varsler",
    title: "5. Varsler",
    items: [
      { id: "al-1", label: "Sjekk bjelle-count" },
      { id: "al-2", label: "Marker ett varsel som løst" },
      { id: "al-3", label: "Marker alle som løst" },
      { id: "al-4", label: "Refresh og sjekk at de fortsatt er løst" },
    ],
  },
  {
    id: "rapporter",
    title: "6. Rapporter",
    items: [
      { id: "rep-1", label: "Sjekk timer mot plan" },
      { id: "rep-2", label: "Eksporter PDF" },
      { id: "rep-3", label: "Eksporter Excel" },
    ],
  },
  {
    id: "portal",
    title: "7. Ansattportal",
    items: [
      { id: "port-1", label: "Se publiserte vakter" },
      { id: "port-2", label: "Send forespørsel" },
      { id: "port-3", label: "Godkjenn/avslå i admin" },
    ],
  },
];

const ALL_ITEM_IDS = SECTIONS.flatMap((s) => s.items.map((i) => i.id));
const TOTAL = ALL_ITEM_IDS.length;

function loadChecked(): Record<string, boolean> {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, boolean> = {};
    for (const id of ALL_ITEM_IDS) {
      out[id] = Boolean((parsed as Record<string, unknown>)[id]);
    }
    return out;
  } catch {
    return {};
  }
}

function saveChecked(next: Record<string, boolean>) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function TestChecklistClient() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setChecked(loadChecked());
    setHydrated(true);
  }, []);

  const doneCount = useMemo(
    () => ALL_ITEM_IDS.filter((id) => checked[id]).length,
    [checked],
  );

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveChecked(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const empty: Record<string, boolean> = {};
    for (const id of ALL_ITEM_IDS) empty[id] = false;
    setChecked(empty);
    try {
      window.localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="min-h-screen w-full px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-[720px]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Shiftly MVP test</h1>
            <p className="mt-1 text-[13px] font-medium text-slate-500">
              Intern sjekkliste før pilot. Status lagres lokalt i denne nettleseren.
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex text-[13px] font-semibold text-violet-700 hover:text-violet-600"
            >
              ← Tilbake til appen
            </Link>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div
              className="rounded-2xl bg-white/80 px-4 py-3 text-center shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] sm:text-right"
              suppressHydrationWarning
            >
              <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Fremdrift</div>
              <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-slate-900">
                {hydrated ? `${doneCount} / ${TOTAL}` : `— / ${TOTAL}`}
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-2xl bg-white/90 px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.08] hover:bg-slate-50"
            >
              Nullstill test
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              className="rounded-[28px] bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] backdrop-blur"
            >
              <h2 className="text-[15px] font-semibold text-slate-900">{section.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {section.items.map((item) => {
                  const isOn = Boolean(checked[item.id]);
                  return (
                    <li key={item.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                          "hover:bg-slate-50/90",
                          isOn && "bg-emerald-50/50",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={hydrated ? isOn : false}
                          onChange={() => toggle(item.id)}
                          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-[13.5px] font-medium leading-snug text-slate-800">{item.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
