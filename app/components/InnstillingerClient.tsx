"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmployeeComputed, Shift } from "@/app/lib/types";
import { Sidebar } from "@/app/components/Sidebar";
import { TopBar } from "@/app/components/TopBar";
import { AlertsPanel } from "@/app/components/AlertsPanel";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { useSettings } from "@/app/components/SettingsProvider";
import { useStores } from "@/app/components/StoresProvider";
import { addDays, baseWeekStart, dayShort, formatNorDate, makeId } from "@/app/lib/mockData";
import { formatHours, sumEmployeeWeekHours } from "@/app/lib/hours";
import { cn } from "@/app/lib/cn";
import type { ExportFormat, ShiftTemplate, ShiftlySettings } from "@/app/lib/settings";
import { createDefaultSettings } from "@/app/lib/settings";
import { Plus, Trash2 } from "lucide-react";
import { TimePickerField } from "@/app/components/TimePickerField";
import { useAlerts } from "@/app/components/AlertsProvider";
import { getContractStatus } from "@/app/lib/rules/contracts";

type InnstillingerToast = { message: string; tone: "neutral" | "negative" };

function Toggle({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-8 w-[52px] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-50",
        checked ? "bg-violet-600" : "bg-slate-200",
      )}
    >
      <span
        className={cn(
          "absolute top-1 size-6 rounded-full bg-white shadow-md transition-all",
          checked ? "left-[calc(100%-1.75rem)]" : "left-1",
        )}
      />
    </button>
  );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
      <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-slate-500">{description}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-slate-800">{label}</div>
        {hint ? <div className="mt-0.5 text-[12px] font-medium text-slate-500">{hint}</div> : null}
      </div>
      <div className="shrink-0 sm:pl-4">{children}</div>
    </div>
  );
}

function SoftInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={cn(
        "w-full max-w-[200px] rounded-2xl bg-white/90 px-3.5 py-2 text-[13.5px] font-semibold text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-200",
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
        "rounded-2xl bg-white/90 px-3.5 py-2 text-[13.5px] font-semibold text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-200",
        className,
      )}
    />
  );
}

export function InnstillingerClient() {
  const { employees, shifts } = useWorkforce();
  const { settings: loadedSettings, updateSettings, resetSettings, settingsLoading } = useSettings();
  const { stores } = useStores();
  const { activeAlerts, alertCount } = useAlerts();
  const [draft, setDraft] = useState<ShiftlySettings>(() => loadedSettings);
  const [newAbsence, setNewAbsence] = useState("");
  const [toast, setToast] = useState<InnstillingerToast | null>(null);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [alertsAnchorRect, setAlertsAnchorRect] = useState<DOMRect | null>(null);

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
      const status = getContractStatus(e, weekShifts, loadedSettings);
      const computedStatus = status === "over" ? "over_limit" : status === "near" ? "near_limit" : "normal";
      const progress = e.contractHours > 0 ? total / e.contractHours : 0;
      const contractLabel = `${e.contractPercent}% • ${formatHours(total)}/${formatHours(e.contractHours)} t`;
      return { ...e, totalHours: total, progress, contractLabel, computedStatus };
    });
    return { employeesComputed, weekShifts };
  }, [employees, shifts, loadedSettings]);

  // Alerts are sourced from the shared AlertsProvider (activeAlerts/alertCount).

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setDraft(loadedSettings);
  }, [loadedSettings]);

  const settings = draft;

  function patch<K extends keyof ShiftlySettings>(key: K, value: ShiftlySettings[K]) {
    setDraft((s) => ({ ...s, [key]: value }));
  }

  function updateTemplate(id: string, patch: Partial<ShiftTemplate>) {
    setDraft((s) => ({
      ...s,
      shiftTemplates: s.shiftTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  function addTemplate() {
    const id = makeId();
    setDraft((s) => ({
      ...s,
      shiftTemplates: [...s.shiftTemplates, { id, name: "Ny mal", startTime: "09:00", endTime: "17:00" }],
    }));
  }

  function removeTemplate(id: string) {
    setDraft((s) => ({
      ...s,
      shiftTemplates: s.shiftTemplates.filter((t) => t.id !== id),
    }));
  }

  function addAbsenceType() {
    const v = newAbsence.trim();
    if (!v) return;
    if (settings.absenceTypes.includes(v)) return;
    setDraft((s) => ({ ...s, absenceTypes: [...s.absenceTypes, v] }));
    setNewAbsence("");
  }

  function removeAbsenceType(label: string) {
    setDraft((s) => ({ ...s, absenceTypes: s.absenceTypes.filter((x) => x !== label) }));
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

        <main className="min-w-0 flex-1 pb-8">
          <TopBar
            mode="settings"
            title="Innstillinger"
            alertsCount={alertCount}
            onBellClick={(rect) => {
              setAlertsAnchorRect(rect);
              setIsAlertsOpen((v) => !v);
            }}
          />

          <div className="mt-6 space-y-6">
            <SectionCard
              title="Arbeidstid og kontrakt"
              description="Grunnverdier for kontrakt, varsler og pauser i planlegging."
            >
              <Row label="Fulltidstimer per uke">
                <SoftInput
                  type="number"
                  inputMode="decimal"
                  step={0.5}
                  min={1}
                  max={60}
                  value={String(settings.fullTimeHours)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    patch("fullTimeHours", Number.isFinite(n) ? n : settings.fullTimeHours);
                  }}
                />
              </Row>
              <Row label="Auto-beregn kontraktstimer fra stillingsprosent" hint="Matcher beregning i Ansatte.">
                <Toggle
                  checked={settings.autoCalculateContractHours}
                  onChange={(v) => patch("autoCalculateContractHours", v)}
                />
              </Row>
              <Row label="Varsle ved nær kontraktgrense" hint="Prosent av kontrakt som utløser «nær grense».">
                <div className="flex items-center gap-2">
                  <SoftInput
                    type="number"
                    min={50}
                    max={100}
                    className="max-w-[100px]"
                    value={String(Math.round(settings.nearContractThreshold * 100))}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : Math.round(settings.nearContractThreshold * 100);
                      patch("nearContractThreshold", pct / 100);
                    }}
                  />
                  <span className="text-[13px] font-semibold text-slate-600">%</span>
                </div>
              </Row>
              <Row label="Varsle ved over kontrakt">
                <Toggle checked={settings.warnOverContract} onChange={(v) => patch("warnOverContract", v)} />
              </Row>
              <Row label="Standard pause trekkes fra" hint="Når på, trekkes pausen fra planlagte timer.">
                <Toggle checked={settings.defaultPauseDeducted} onChange={(v) => patch("defaultPauseDeducted", v)} />
              </Row>
              <Row label="Standard pause (minutter)">
                <SoftInput
                  type="number"
                  min={0}
                  max={120}
                  value={String(settings.defaultPauseMinutes)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    patch("defaultPauseMinutes", Number.isFinite(n) ? Math.max(0, n) : settings.defaultPauseMinutes);
                  }}
                />
              </Row>
            </SectionCard>

            <SectionCard title="Overtid / mertid" description="Visning og varsler knyttet til merarbeid.">
              <Row label="Vis mertidsvarsel for deltidsansatte">
                <Toggle checked={settings.showMerTimeWarningPartTime} onChange={(v) => patch("showMerTimeWarningPartTime", v)} />
              </Row>
              <Row label="Marker vakter over kontrakt">
                <Toggle checked={settings.markOverContractShifts} onChange={(v) => patch("markOverContractShifts", v)} />
              </Row>
              <Row label="Varsle før publisering hvis ansatte er over kontrakt">
                <Toggle checked={settings.warnBeforePublishOverContract} onChange={(v) => patch("warnBeforePublishOverContract", v)} />
              </Row>
              <div className="rounded-2xl bg-amber-50/80 px-4 py-3 text-[12.5px] font-medium leading-relaxed text-amber-950 ring-1 ring-amber-100">
                Shiftly gir varsler basert på registrert stillingsprosent og planlagte timer. Juridiske vurderinger må avklares med
                arbeidsgiver/rådgiver.
              </div>
            </SectionCard>

            <SectionCard title="Standardvakter" description="Maler som kan velges ved opprettelse av vakter.">
              <div className="space-y-3">
                {settings.shiftTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col gap-3 rounded-[22px] bg-[#F6F8FC] p-4 ring-1 ring-slate-900/[0.04] sm:flex-row sm:flex-wrap sm:items-end"
                  >
                    <div className="min-w-[140px] flex-1">
                      <div className="text-[11px] font-semibold text-slate-500">Navn</div>
                      <SoftInput
                        className="mt-1 max-w-none"
                        value={t.name}
                        onChange={(e) => updateTemplate(t.id, { name: e.target.value })}
                      />
                    </div>
                    <div className="min-w-[128px] flex-1 sm:max-w-[160px]">
                      <TimePickerField
                        label="Start"
                        value={t.startTime}
                        onChange={(v) => updateTemplate(t.id, { startTime: v })}
                        allowEmpty={false}
                        inputClassName="mt-1 px-3 py-2 text-[13px]"
                      />
                    </div>
                    <div className="min-w-[128px] flex-1 sm:max-w-[160px]">
                      <TimePickerField
                        label="Slutt"
                        value={t.endTime}
                        onChange={(v) => updateTemplate(t.id, { endTime: v })}
                        allowEmpty={false}
                        inputClassName="mt-1 px-3 py-2 text-[13px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTemplate(t.id)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-[12.5px] font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 hover:bg-rose-50"
                      aria-label={`Slett mal ${t.name}`}
                    >
                      <Trash2 className="size-4" />
                      Slett
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTemplate}
                className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(124,58,237,0.3)] hover:bg-violet-500"
              >
                <Plus className="size-[18px]" />
                Legg til mal
              </button>
            </SectionCard>

            <SectionCard title="Tilgjengelighet og fravær">
              <Row label="Tillat ansatte å registrere tilgjengelighet">
                <Toggle checked={settings.allowEmployeeAvailability} onChange={(v) => patch("allowEmployeeAvailability", v)} />
              </Row>
              <Row label="Krev ledergodkjenning for fravær">
                <Toggle checked={settings.requireManagerAbsenceApproval} onChange={(v) => patch("requireManagerAbsenceApproval", v)} />
              </Row>
              <div>
                <div className="text-[13.5px] font-semibold text-slate-800">Fraværstyper</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {settings.absenceTypes.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] font-semibold text-slate-800 ring-1 ring-slate-900/[0.06]"
                    >
                      {a}
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-600"
                        onClick={() => removeAbsenceType(a)}
                        aria-label={`Fjern ${a}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <SoftInput
                    className="max-w-[220px]"
                    placeholder="Ny fraværstype"
                    value={newAbsence}
                    onChange={(e) => setNewAbsence(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAbsenceType()}
                  />
                  <button
                    type="button"
                    onClick={addAbsenceType}
                    className="rounded-2xl bg-white/90 px-4 py-2 text-[13px] font-semibold text-violet-700 ring-1 ring-violet-100 hover:bg-violet-50"
                  >
                    Legg til
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Bytte av vakter">
              <Row label="Tillat vaktbytte mellom ansatte">
                <Toggle checked={settings.allowShiftSwap} onChange={(v) => patch("allowShiftSwap", v)} />
              </Row>
              <Row label="Krev ledergodkjenning">
                <Toggle checked={settings.requireShiftSwapApproval} onChange={(v) => patch("requireShiftSwapApproval", v)} />
              </Row>
              <Row label="Ikke tillat bytte hvis det gir over kontrakt">
                <Toggle checked={settings.blockSwapIfOverContract} onChange={(v) => patch("blockSwapIfOverContract", v)} />
              </Row>
              <Row label="Ikke tillat bytte ved utilgjengelighet">
                <Toggle checked={settings.blockSwapIfUnavailable} onChange={(v) => patch("blockSwapIfUnavailable", v)} />
              </Row>
            </SectionCard>

            <SectionCard title="Varsler">
              <Row label="Push-varsel ved ny vakt">
                <Toggle checked={settings.notifyNewShift} onChange={(v) => patch("notifyNewShift", v)} />
              </Row>
              <Row label="Push-varsel ved endret vakt">
                <Toggle checked={settings.notifyChangedShift} onChange={(v) => patch("notifyChangedShift", v)} />
              </Row>
              <Row label="Varsel ved manglende bemanning">
                <Toggle checked={settings.notifyUnderstaffing} onChange={(v) => patch("notifyUnderstaffing", v)} />
              </Row>
              <Row label="Varsel ved utilgjengelig ansatt satt opp">
                <Toggle checked={settings.notifyUnavailableConflict} onChange={(v) => patch("notifyUnavailableConflict", v)} />
              </Row>
              <Row label="Varsel ved nær kontraktgrense">
                <Toggle checked={settings.notifyNearContract} onChange={(v) => patch("notifyNearContract", v)} />
              </Row>
              <Row label="Varsel ved over kontrakt">
                <Toggle checked={settings.notifyOverContract} onChange={(v) => patch("notifyOverContract", v)} />
              </Row>
            </SectionCard>

            <SectionCard title="Butikk og bemanning">
              <Row label="Minimum bemanning per åpen dag">
                <SoftInput
                  type="number"
                  min={0}
                  max={50}
                  value={String(settings.minStaffPerOpenDay)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    patch("minStaffPerOpenDay", Number.isFinite(n) ? Math.max(0, n) : settings.minStaffPerOpenDay);
                  }}
                />
              </Row>
              <Row label="Ekstra bemanning lørdag">
                <Toggle checked={settings.extraSaturdayStaffing} onChange={(v) => patch("extraSaturdayStaffing", v)} />
              </Row>
              <Row label="Tillat ansatte å jobbe på flere butikker">
                <Toggle checked={settings.allowMultiStoreWork} onChange={(v) => patch("allowMultiStoreWork", v)} />
              </Row>
              <Row label="Vis butikkvelger i planlegging">
                <Toggle checked={settings.showStorePickerInPlanning} onChange={(v) => patch("showStorePickerInPlanning", v)} />
              </Row>
            </SectionCard>

            <SectionCard title="Publisering">
              <Row label="Krev bekreftelse før ukeplan publiseres">
                <Toggle checked={settings.confirmBeforePublishWeek} onChange={(v) => patch("confirmBeforePublishWeek", v)} />
              </Row>
              <Row label="Send ukeplan til ansatte ved publisering">
                <Toggle checked={settings.sendWeekPlanOnPublish} onChange={(v) => patch("sendWeekPlanOnPublish", v)} />
              </Row>
              <Row label="Vis upubliserte vakter som ubekreftet">
                <Toggle checked={settings.showUnpublishedAsUnconfirmed} onChange={(v) => patch("showUnpublishedAsUnconfirmed", v)} />
              </Row>
            </SectionCard>

            <SectionCard title="Eksport">
              <Row label="Standard eksportformat">
                <SoftSelect
                  value={settings.defaultExportFormat}
                  onChange={(e) => patch("defaultExportFormat", e.target.value as ExportFormat)}
                >
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </SoftSelect>
              </Row>
              <Row label="Vis stillingsprosent i eksport">
                <Toggle checked={settings.exportShowPositionPercent} onChange={(v) => patch("exportShowPositionPercent", v)} />
              </Row>
              <Row label="Vis kontraktstimer i eksport">
                <Toggle checked={settings.exportShowContractHours} onChange={(v) => patch("exportShowContractHours", v)} />
              </Row>
              <Row label="Vis varsler i eksport">
                <Toggle checked={settings.exportIncludeAlerts} onChange={(v) => patch("exportIncludeAlerts", v)} />
              </Row>
            </SectionCard>
          </div>

          <div className="mt-12 flex flex-col gap-3 rounded-[28px] bg-white/85 px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={async () => {
                await resetSettings();
                setToast({ message: "Innstillinger tilbakestilt.", tone: "neutral" });
              }}
              className="w-full rounded-2xl bg-white/90 px-4 py-2.5 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.08] hover:bg-slate-50 sm:w-auto"
            >
              Tilbakestill
            </button>
            <button
              type="button"
              disabled={settingsLoading}
              onClick={async () => {
                await updateSettings(settings);
                setToast({ message: "Innstillinger lagret.", tone: "neutral" });
              }}
              className="w-full rounded-2xl bg-violet-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(124,58,237,0.35)] hover:bg-violet-500 sm:w-auto"
            >
              Lagre innstillinger
            </button>
          </div>
        </main>
      </div>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed bottom-6 left-1/2 z-50 w-[min(100vw-1.25rem,16rem)] -translate-x-1/2 rounded-xl px-2.5 py-1.5 text-[11px] font-medium leading-snug shadow-sm backdrop-blur-sm",
            toast.tone === "negative"
              ? "border border-rose-200/65 bg-rose-50/88 text-rose-900/95 shadow-[0_3px_10px_rgba(190,18,60,0.06)]"
              : "border border-slate-200/55 bg-white/82 text-slate-700 shadow-[0_3px_12px_rgba(15,23,42,0.05)]",
          )}
        >
          {toast.message}
        </div>
      ) : null}

      <AlertsPanel
        open={isAlertsOpen}
        anchorRect={alertsAnchorRect}
        alerts={activeAlerts}
        onClose={() => setIsAlertsOpen(false)}
      />
    </div>
  );
}
