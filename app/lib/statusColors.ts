import type { ShiftStatus } from "@/app/lib/types";

export type StatusPalette = {
  pillBg: string;
  pillText: string;
  pillSubtext: string;
  dotClass: string;
};

export function getStatusPalette(status: ShiftStatus): StatusPalette {
  switch (status) {
    case "near_limit":
      return {
        pillBg: "bg-[#FFF0C9]",
        pillText: "text-slate-900",
        pillSubtext: "text-slate-700",
        dotClass: "bg-amber-400",
      };
    case "over_limit":
      return {
        pillBg: "bg-[#FFD6DC]",
        pillText: "text-slate-900",
        pillSubtext: "text-slate-700",
        dotClass: "bg-rose-500",
      };
    case "unconfirmed":
      return {
        pillBg: "bg-[#EEF1F6]",
        pillText: "text-slate-700",
        pillSubtext: "text-slate-500",
        dotClass: "bg-slate-300",
      };
    case "normal":
    default:
      // Chosen as the single "within contract" color: soft green (matches progress + legend).
      return {
        pillBg: "bg-[#DFF7E8]",
        pillText: "text-slate-900",
        pillSubtext: "text-slate-700",
        dotClass: "bg-emerald-400",
      };
  }
}

