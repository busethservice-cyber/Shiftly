"use client";

import type { Employee, Shift } from "@/app/lib/types";
import { formatHours, shiftDurationHours } from "@/app/lib/hours";
import {
  employeeNameColumnWidthPx,
  formatScheduleDayCell,
  getScheduleWeekData,
  type ScheduleWeekData,
} from "@/app/lib/scheduleWeekData";

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

function formatCellHtml(text: string): string {
  if (!text) return "";
  return escapeHtml(text).replaceAll("\n", "<br/>");
}

export function buildScheduleExportModelFromWeekData(data: ScheduleWeekData): ScheduleExportModel {
  const { storeName, weekLabel, weekOffset, employees, shifts, days, totalPlannedHours } = data;

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
        return formatScheduleDayCell(e, d.dayIndex, dayShifts, weekOffset);
      });
      const rowHours = data.plannedHoursByEmployee.get(e.id) ?? 0;
      return { employeeId: e.id, employeeName: e.name, cells, totalHours: rowHours };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "nb"));

  return {
    storeName,
    weekLabel,
    exportedAt: formatExportTimestamp(),
    days: days.map((d) => ({ dayIndex: d.dayIndex, label: d.label })),
    rows,
    summary: { totalPlannedHours },
  };
}

/** Legacy wrapper — prefer buildScheduleExportModelForScope. */
export function buildScheduleExportModel(args: {
  storeName: string;
  weekLabel: string;
  weekStart: Date;
  weekOffset: number;
  employees: Employee[];
  shifts: Shift[];
  totalPlannedHours?: number;
}): ScheduleExportModel {
  const { storeName, weekLabel, weekOffset, employees, shifts } = args;

  const days = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(args.weekStart);
    d.setDate(d.getDate() + weekOffset * 7 + idx);
    const short = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][idx] ?? `D${idx}`;
    return { dayIndex: idx, label: `${short} ${d.getDate()}` };
  });

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
        return formatScheduleDayCell(e, d.dayIndex, dayShifts, weekOffset);
      });
      const rowHours = list.reduce((acc, s) => acc + shiftDurationHours(s), 0);
      return { employeeId: e.id, employeeName: e.name, cells, totalHours: rowHours };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "nb"));

  const totalPlannedHours =
    args.totalPlannedHours ?? shifts.reduce((acc, s) => acc + shiftDurationHours(s), 0);

  return {
    storeName,
    weekLabel,
    exportedAt: formatExportTimestamp(),
    days,
    rows,
    summary: { totalPlannedHours },
  };
}

export function buildScheduleExportModelForScope(args: Parameters<typeof getScheduleWeekData>[0]): ScheduleExportModel {
  return buildScheduleExportModelFromWeekData(getScheduleWeekData(args));
}

function buildExcelHtml(model: ScheduleExportModel): string {
  const nameWidth = employeeNameColumnWidthPx(model.rows.map((r) => r.employeeName));
  const dayColWidth = 84;
  const hoursColWidth = 64;
  const colCount = model.days.length + 2;

  const headerRows = `
    <tr><td colspan="${colCount}" class="meta-title"><strong>${escapeHtml(model.storeName)} – Ukeplan</strong></td></tr>
    <tr><td colspan="${colCount}" class="meta">Butikk: ${escapeHtml(model.storeName)}</td></tr>
    <tr><td colspan="${colCount}" class="meta">Uke: ${escapeHtml(model.weekLabel)}</td></tr>
    <tr><td colspan="${colCount}" class="meta">Totalt planlagte timer: ${escapeHtml(formatHours(model.summary.totalPlannedHours))} t</td></tr>
    <tr><td colspan="${colCount}" class="meta">${escapeHtml(model.exportedAt)}</td></tr>
    <tr><td colspan="${colCount}" class="spacer"></td></tr>
  `;

  const tableHead = `
    <tr class="header-row">
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
      ${r.cells.map((c) => `<td class="day-col">${formatCellHtml(c)}</td>`).join("")}
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
            <x:Print>
              <x:ValidPrinterInfo/>
              <x:HorizontalResolution>600</x:HorizontalResolution>
              <x:VerticalResolution>600</x:VerticalResolution>
            </x:Print>
            <x:FreezePanes/>
            <x:FrozenNoSplit/>
            <x:SplitHorizontal>6</x:SplitHorizontal>
            <x:TopRowBottomPane>6</x:TopRowBottomPane>
            <x:ActivePane>2</x:ActivePane>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml><![endif]-->
  <style>
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td {
      border: 1px solid #64748b;
      padding: 6px 8px;
      font-size: 11pt;
      font-family: Calibri, Arial, sans-serif;
      vertical-align: middle;
      word-wrap: break-word;
      mso-number-format: "\\@";
    }
    th { background: #e2e8f0; font-weight: 700; text-align: center; }
    .header-row th { background: #cbd5e1; }
    .name-col {
      width: ${nameWidth}px;
      min-width: ${nameWidth}px;
      text-align: left;
      white-space: nowrap;
    }
    .day-col { text-align: center; width: ${dayColWidth}px; min-width: ${dayColWidth}px; white-space: normal; }
    .hours-col { text-align: center; width: ${hoursColWidth}px; min-width: ${hoursColWidth}px; }
    .meta-title { border: none !important; font-size: 14pt; padding: 4px 0; }
    .meta { border: none !important; color: #475569; font-size: 10pt; padding: 2px 0; }
    .spacer { border: none !important; height: 8px; }
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

  const nameWidth = employeeNameColumnWidthPx(model.rows.map((r) => r.employeeName));

  const css = `
    @page { size: landscape; margin: 10mm; }
    :root { color-scheme: light; }
    body { font-family: Calibri, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 16px; color: #0f172a; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #475569; font-size: 12px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; table-layout: fixed; }
    th, td { border: 1px solid #64748b; padding: 6px 8px; font-size: 11px; vertical-align: middle; word-wrap: break-word; }
    th { background: #cbd5e1; text-align: center; font-weight: 700; }
    .name-col { width: ${nameWidth}px; text-align: left; white-space: nowrap; }
    .day-col { text-align: center; white-space: pre-line; }
    .hours-col { text-align: center; width: 64px; }
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
            ${r.cells.map((c) => `<td class="day-col">${formatCellHtml(c)}</td>`).join("")}
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
