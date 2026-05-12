"use client";

import type { Employee, Shift } from "@/app/lib/types";
import { dayShort } from "@/app/lib/mockData";
import { formatHours, shiftDurationHours } from "@/app/lib/hours";

export type ScheduleExportModel = {
  storeName: string;
  weekLabel: string;
  days: Array<{ dayIndex: number; label: string }>;
  rows: Array<{
    employeeId: string;
    employeeName: string;
    cells: string[]; // per day
    totalHours: number;
  }>;
  summary: {
    totalPlannedHours: number;
    employeesOverContract: number;
    alertsCount: number;
  };
};

function isoDateForShift(weekStart: Date, shift: Pick<Shift, "week" | "day">) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + shift.week * 7 + shift.day);
  return d;
}

function escapeCsvCell(value: string) {
  const v = value ?? "";
  if (/[\";\n\r]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
  return v;
}

export function buildScheduleExportModel(args: {
  storeName: string;
  weekLabel: string;
  weekStart: Date; // baseWeekStart
  weekOffset: number;
  employees: Employee[];
  shifts: Shift[]; // already scoped to the store/site
  alertsCount: number;
}): ScheduleExportModel {
  const { storeName, weekLabel, employees, shifts, alertsCount } = args;

  const days = dayShort.map((d, idx) => ({ dayIndex: idx, label: d }));

  const byEmployee = new Map<string, Shift[]>();
  for (const s of shifts) {
    const list = byEmployee.get(s.employeeId) ?? [];
    list.push(s);
    byEmployee.set(s.employeeId, list);
  }

  const rows = employees
    .map((e) => {
      const list = (byEmployee.get(e.id) ?? []).slice();
      const cells = days.map((d) => {
        const dayShifts = list
          .filter((s) => s.day === d.dayIndex && shiftDurationHours(s) > 0)
          .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
        if (dayShifts.length === 0) return "";
        return dayShifts.map((s) => `${s.startTime}–${s.endTime}`).join(" / ");
      });
      const totalHours = list.reduce((acc, s) => acc + shiftDurationHours(s), 0);
      return { employeeId: e.id, employeeName: e.name, cells, totalHours };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const totalPlannedHours = shifts.reduce((acc, s) => acc + shiftDurationHours(s), 0);
  const employeesOverContract = employees.filter((e) => {
    const planned = (byEmployee.get(e.id) ?? []).reduce((acc, s) => acc + shiftDurationHours(s), 0);
    return planned > e.contractHours;
  }).length;

  return {
    storeName,
    weekLabel,
    days,
    rows,
    summary: {
      totalPlannedHours,
      employeesOverContract,
      alertsCount,
    },
  };
}

export function downloadScheduleCsv(model: ScheduleExportModel, filename = "shiftly-ukeplan.csv") {
  const header = ["Ansatt", ...model.days.map((d) => d.label), "Timer (uke)"];
  const lines = [
    header.map(escapeCsvCell).join(";"),
    ...model.rows.map((r) =>
      [r.employeeName, ...r.cells, formatHours(r.totalHours)].map(escapeCsvCell).join(";"),
    ),
  ];

  const meta = [
    `Butikk: ${model.storeName}`,
    `Uke: ${model.weekLabel}`,
    `Totalt planlagte timer: ${formatHours(model.summary.totalPlannedHours)} t`,
    `Ansatte over kontrakt: ${model.summary.employeesOverContract}`,
    `Varsler: ${model.summary.alertsCount}`,
  ].join("\n");

  const content = `${meta}\n\n${lines.join("\n")}\n`;
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function openSchedulePrintPreview(model: ScheduleExportModel) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;

  const css = `
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; color: #0f172a; }
    h1 { font-size: 18px; margin: 0; }
    .sub { margin-top: 6px; color: #475569; font-size: 12px; }
    .summary { margin-top: 14px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .card { border: 1px solid rgba(15,23,42,0.08); border-radius: 12px; padding: 10px; background: #f8fafc; }
    .label { font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .value { margin-top: 6px; font-size: 14px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid rgba(15,23,42,0.10); padding: 8px 10px; font-size: 12px; vertical-align: top; }
    th { background: #f1f5f9; text-align: left; }
    td:first-child, th:first-child { position: sticky; left: 0; background: white; }
    .muted { color: #64748b; }
    @media print {
      body { margin: 12mm; }
      .no-print { display: none; }
      td:first-child, th:first-child { position: static; }
    }
  `;

  const escapeHtml = (s: string) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Shiftly – Ukeplan</title>
    <style>${css}</style>
  </head>
  <body>
    <div class="no-print" style="display:flex; gap:10px; justify-content:flex-end; margin-bottom:14px;">
      <button onclick="window.print()" style="border:1px solid rgba(15,23,42,0.12); background:#fff; border-radius:12px; padding:8px 12px; font-weight:700; font-size:12px; cursor:pointer;">
        Skriv ut / Lagre som PDF
      </button>
    </div>

    <h1>${escapeHtml(model.storeName)} – Ukeplan</h1>
    <div class="sub">Uke: ${escapeHtml(model.weekLabel)}</div>

    <div class="summary">
      <div class="card">
        <div class="label">Totalt planlagt</div>
        <div class="value">${escapeHtml(formatHours(model.summary.totalPlannedHours))} t</div>
      </div>
      <div class="card">
        <div class="label">Over kontrakt</div>
        <div class="value">${escapeHtml(String(model.summary.employeesOverContract))}</div>
      </div>
      <div class="card">
        <div class="label">Varsler</div>
        <div class="value">${escapeHtml(String(model.summary.alertsCount))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Ansatt</th>
          ${model.days.map((d) => `<th>${escapeHtml(d.label)}</th>`).join("")}
          <th>Timer</th>
        </tr>
      </thead>
      <tbody>
        ${model.rows
          .map(
            (r) => `
          <tr>
            <td><strong>${escapeHtml(r.employeeName)}</strong></td>
            ${r.cells.map((c) => `<td>${c ? escapeHtml(c) : '<span class="muted">—</span>'}</td>`).join("")}
            <td><strong>${escapeHtml(formatHours(r.totalHours))}</strong></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  </body>
</html>
  `.trim();

  w.document.open();
  w.document.write(html);
  w.document.close();
};

