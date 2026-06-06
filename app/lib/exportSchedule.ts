"use client";

import type { Employee, Shift } from "@/app/lib/types";
import { addDays, dayShort } from "@/app/lib/mockData";
import { formatHours, isShiftOff, shiftDurationHours } from "@/app/lib/hours";
import { getEmployeeDayUnavailableDisplay } from "@/app/lib/rules/shifts";

export type ScheduleExportModel = {
  storeName: string;
  weekLabel: string;
  exportedAt: string;
  days: Array<{ dayIndex: number; label: string }>;
  rows: Array<{
    employeeId: string;
    employeeName: string;
    cells: string[];
    totalHours: number;
  }>;
  summary: {
    totalPlannedHours: number;
  };
};

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatExportTimestamp(d = new Date()): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `Eksportert: ${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function dayHeaderLabel(dayIndex: number, weekStart: Date, weekOffset: number): string {
  const d = addDays(weekStart, weekOffset * 7 + dayIndex);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dayShort[dayIndex]} ${dd}.${mm}`;
}

function exportClockToken(t: string): string {
  const [hRaw, mRaw] = t.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t.trim();
  if (m === 0) return String(h).padStart(2, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function exportTimeRange(start: string, end: string): string {
  return `${exportClockToken(start)}-${exportClockToken(end)}`;
}

function formatExportAbsenceCell(employee: Employee, weekOffset: number, dayIndex: number): string {
  const u = getEmployeeDayUnavailableDisplay(employee, weekOffset, dayIndex);
  if (!u.showUnavailableChip) return "";

  const reason = (u.primaryReason || u.entries[0]?.reason || "").trim();
  const wholeDay = u.blocksWholeDay || Boolean(u.entries[0]?.wholeDay);

  if (reason === "Fri" && wholeDay) return "Fri";
  if (wholeDay) return reason || "Utilgjengelig";

  const entry = u.entries.find((e) => e.startTime && e.endTime) ?? u.entries[0];
  if (entry?.startTime && entry?.endTime) {
    const range = exportTimeRange(entry.startTime, entry.endTime);
    return reason ? `${reason} ${range}` : range;
  }
  return reason || "Utilgjengelig";
}

function formatExportDayCell(employee: Employee, dayIndex: number, dayShifts: Shift[], weekOffset: number): string {
  const working = dayShifts
    .filter((s) => shiftDurationHours(s) > 0)
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
  if (working.length > 0) {
    return working.map((s) => `${s.startTime}-${s.endTime}`).join(" / ");
  }

  const off = dayShifts.some((s) => isShiftOff(s));
  if (off) return "Fri";

  return formatExportAbsenceCell(employee, weekOffset, dayIndex);
}

function employeeNameColumnWidthPx(rows: ScheduleExportModel["rows"]): number {
  const longest = rows.reduce((max, r) => Math.max(max, r.employeeName.length), "Ansatt".length);
  return Math.min(320, Math.max(120, longest * 8 + 24));
}

export function buildScheduleExportModel(args: {
  storeName: string;
  weekLabel: string;
  weekStart: Date;
  weekOffset: number;
  employees: Employee[];
  shifts: Shift[];
}): ScheduleExportModel {
  const { storeName, weekLabel, weekStart, weekOffset, employees, shifts } = args;

  const days = dayShort.map((_, idx) => ({
    dayIndex: idx,
    label: dayHeaderLabel(idx, weekStart, weekOffset),
  }));

  const byEmployee = new Map<string, Shift[]>();
  for (const s of shifts) {
    const list = byEmployee.get(s.employeeId) ?? [];
    list.push(s);
    byEmployee.set(s.employeeId, list);
  }

  const rows = employees
    .map((e) => {
      const list = byEmployee.get(e.id) ?? [];
      const cells = days.map((d) => {
        const dayShifts = list.filter((s) => s.day === d.dayIndex);
        return formatExportDayCell(e, d.dayIndex, dayShifts, weekOffset);
      });
      const totalHours = list.reduce((acc, s) => acc + shiftDurationHours(s), 0);
      return { employeeId: e.id, employeeName: e.name, cells, totalHours };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "nb"));

  const totalPlannedHours = shifts.reduce((acc, s) => acc + shiftDurationHours(s), 0);

  return {
    storeName,
    weekLabel,
    exportedAt: formatExportTimestamp(),
    days,
    rows,
    summary: { totalPlannedHours },
  };
}

function buildExcelHtml(model: ScheduleExportModel): string {
  const nameWidth = employeeNameColumnWidthPx(model.rows);

  const headerRows = `
    <tr><td colspan="${model.days.length + 2}" class="meta-title"><strong>${escapeHtml(model.storeName)} – Ukeplan</strong></td></tr>
    <tr><td colspan="${model.days.length + 2}" class="meta">Butikk: ${escapeHtml(model.storeName)}</td></tr>
    <tr><td colspan="${model.days.length + 2}" class="meta">Uke: ${escapeHtml(model.weekLabel)}</td></tr>
    <tr><td colspan="${model.days.length + 2}" class="meta">Totalt planlagte timer: ${escapeHtml(formatHours(model.summary.totalPlannedHours))} t</td></tr>
    <tr><td colspan="${model.days.length + 2}" class="meta">${escapeHtml(model.exportedAt)}</td></tr>
    <tr><td colspan="${model.days.length + 2}" class="spacer"></td></tr>
  `;

  const tableHead = `
    <tr>
      <th class="name-col">Ansatt</th>
      ${model.days.map((d) => `<th class="day-col">${escapeHtml(d.label)}</th>`).join("")}
      <th class="hours-col">Timer</th>
    </tr>
  `;

  const tableBody = model.rows
    .map(
      (r) => `
    <tr>
      <td class="name-col">${escapeHtml(r.employeeName)}</td>
      ${r.cells.map((c) => `<td class="day-col">${c ? escapeHtml(c) : ""}</td>`).join("")}
      <td class="hours-col">${escapeHtml(formatHours(r.totalHours))}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Ukeplan</x:Name>
          <x:WorksheetOptions>
            <x:PageSetup>
              <x:Layout x:Orientation="Landscape"/>
              <x:Header x:Margin="0.3"/>
              <x:Footer x:Margin="0.3"/>
              <x:PageMargins x:Bottom="0.5" x:Left="0.4" x:Right="0.4" x:Top="0.5"/>
            </x:PageSetup>
            <x:FitToPage/>
            <x:FitWidth>1</x:FitWidth>
            <x:FitHeight>0</x:FitHeight>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml><![endif]-->
  <style>
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td {
      border: 1px solid #94a3b8;
      padding: 6px 8px;
      font-size: 11pt;
      font-family: Calibri, Arial, sans-serif;
      vertical-align: middle;
      word-wrap: break-word;
    }
    th { background: #f1f5f9; font-weight: 700; text-align: center; }
    .name-col {
      width: ${nameWidth}px;
      min-width: ${nameWidth}px;
      text-align: left;
      white-space: nowrap;
    }
    .day-col { text-align: center; width: 72px; }
    .hours-col { text-align: center; width: 56px; }
    .meta-title { border: none; font-size: 14pt; padding: 4px 0; }
    .meta { border: none; color: #475569; font-size: 10pt; padding: 2px 0; }
    .spacer { border: none; height: 8px; }
    @media print {
      @page { size: landscape; margin: 10mm; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <table>
    ${headerRows}
    ${tableHead}
    ${tableBody}
  </table>
</body>
</html>`;
}

export function downloadScheduleCsv(model: ScheduleExportModel, filename = "shiftly-ukeplan.xls") {
  const html = buildExcelHtml(model);
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") || filename.endsWith(".xlsx") ? filename : filename.replace(/\.csv$/i, ".xls");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function openSchedulePrintPreview(model: ScheduleExportModel) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;

  const nameWidth = employeeNameColumnWidthPx(model.rows);

  const css = `
    @page { size: landscape; margin: 10mm; }
    :root { color-scheme: light; }
    body { font-family: Calibri, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 16px; color: #0f172a; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #475569; font-size: 12px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; table-layout: fixed; }
    th, td { border: 1px solid #94a3b8; padding: 6px 8px; font-size: 11px; vertical-align: middle; word-wrap: break-word; }
    th { background: #f1f5f9; text-align: center; font-weight: 700; }
    .name-col { width: ${nameWidth}px; text-align: left; white-space: nowrap; }
    .day-col { text-align: center; }
    .hours-col { text-align: center; width: 56px; }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  `;

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
    <div class="meta">
      Butikk: ${escapeHtml(model.storeName)}<br />
      Uke: ${escapeHtml(model.weekLabel)}<br />
      Totalt planlagte timer: ${escapeHtml(formatHours(model.summary.totalPlannedHours))} t<br />
      ${escapeHtml(model.exportedAt)}
    </div>

    <table>
      <thead>
        <tr>
          <th class="name-col">Ansatt</th>
          ${model.days.map((d) => `<th class="day-col">${escapeHtml(d.label)}</th>`).join("")}
          <th class="hours-col">Timer</th>
        </tr>
      </thead>
      <tbody>
        ${model.rows
          .map(
            (r) => `
          <tr>
            <td class="name-col">${escapeHtml(r.employeeName)}</td>
            ${r.cells.map((c) => `<td class="day-col">${c ? escapeHtml(c) : ""}</td>`).join("")}
            <td class="hours-col">${escapeHtml(formatHours(r.totalHours))}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </body>
</html>`.trim();

  w.document.open();
  w.document.write(html);
  w.document.close();
}
