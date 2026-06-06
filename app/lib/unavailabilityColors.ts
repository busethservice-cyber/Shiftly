import type { UnavailablePeriodReason } from "@/app/lib/types";

export type UnavailabilityKind = "ferie" | "syk" | "skole" | "fri" | "annet" | "recurring";

export type UnavailabilityChipStyle = {
  kind: UnavailabilityKind;
  wholeDay: boolean;
  container: string;
  primaryText: string;
  secondaryText: string;
};

function normalizeKind(reason: string | undefined, isRecurring: boolean): UnavailabilityKind {
  const r = String(reason ?? "").trim();
  if (r === "Ferie") return "ferie";
  if (r === "Syk") return "syk";
  if (r === "Skole") return "skole";
  if (r === "Fri") return "fri";
  if (isRecurring) return "recurring";
  return "annet";
}

const baseByKind: Record<UnavailabilityKind, { whole: string; partial: string; text: string; sub: string }> = {
  ferie: {
    whole: "border-violet-200/80 bg-violet-100/75 ring-1 ring-violet-200/60",
    partial: "border-l-[3px] border-l-violet-500 bg-violet-50/80 ring-1 ring-violet-100/70",
    text: "text-violet-900",
    sub: "text-violet-700/90",
  },
  syk: {
    whole: "border-slate-600/30 bg-slate-700/90 ring-1 ring-slate-600/40",
    partial: "border-l-[3px] border-l-slate-600 bg-slate-200/90 ring-1 ring-slate-300/60",
    text: "text-white",
    sub: "text-slate-200",
  },
  skole: {
    whole: "border-sky-200/80 bg-sky-100/75 ring-1 ring-sky-200/60",
    partial: "border-l-[3px] border-l-sky-500 bg-sky-50/85 ring-1 ring-sky-100/70",
    text: "text-sky-950",
    sub: "text-sky-800/90",
  },
  recurring: {
    whole: "border-sky-200/80 bg-sky-100/70 ring-1 ring-sky-200/55",
    partial: "border-l-[3px] border-l-sky-500 bg-sky-50/80 ring-1 ring-sky-100/65",
    text: "text-sky-950",
    sub: "text-sky-800/90",
  },
  fri: {
    whole: "border-slate-200/80 bg-slate-100/90 ring-1 ring-slate-200/60",
    partial: "border-l-[3px] border-l-slate-400 bg-slate-50/90 ring-1 ring-slate-200/55",
    text: "text-slate-800",
    sub: "text-slate-600",
  },
  annet: {
    whole: "border-slate-200/70 bg-slate-100/85 ring-1 ring-slate-200/55",
    partial: "border-l-[3px] border-l-slate-400 bg-slate-50/85 ring-1 ring-slate-200/50",
    text: "text-slate-800",
    sub: "text-slate-600",
  },
};

export function getUnavailabilityChipStyle(args: {
  reason?: UnavailablePeriodReason | string;
  wholeDay: boolean;
  isRecurring?: boolean;
}): UnavailabilityChipStyle {
  const kind = normalizeKind(args.reason, Boolean(args.isRecurring));
  const palette = baseByKind[kind];
  const wholeDay = args.wholeDay;
  return {
    kind,
    wholeDay,
    container: wholeDay ? palette.whole : palette.partial,
    primaryText: wholeDay && kind === "syk" ? palette.text : palette.text,
    secondaryText: kind === "syk" && wholeDay ? palette.sub : palette.sub,
  };
}

/** Partial-day syk uses dark text on light bg */
export function unavailabilityPrimaryTextClass(style: UnavailabilityChipStyle): string {
  if (style.kind === "syk" && !style.wholeDay) return "text-slate-800";
  if (style.kind === "syk" && style.wholeDay) return "text-white";
  return style.primaryText;
}

export function unavailabilitySecondaryTextClass(style: UnavailabilityChipStyle): string {
  if (style.kind === "syk" && !style.wholeDay) return "text-slate-600";
  if (style.kind === "syk" && style.wholeDay) return "text-slate-200";
  return style.secondaryText;
}
