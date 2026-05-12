"use client";

import { cn } from "@/app/lib/cn";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMockData } from "@/app/lib/runtimeConfig";
import { getCurrentUserProfile, getUserRole, signOut } from "@/app/lib/auth";
import { useAlerts } from "@/app/components/AlertsProvider";
import {
  BarChart3,
  Bell,
  CalendarDays,
  LayoutDashboard,
  Settings,
  Store,
  Users,
} from "lucide-react";

function initialsFromDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "…") return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0];
    const b = parts[1]![0];
    return `${a ?? ""}${b ?? ""}`.toUpperCase() || "?";
  }
  const one = parts[0] ?? trimmed;
  if (one.length >= 2) return `${one[0]!}${one[1]!}`.toUpperCase();
  return (one[0] ?? "?").toUpperCase();
}

function Avatar({ name, gradient }: { name: string; gradient: string }) {
  const initials = initialsFromDisplayName(name);

  return (
    <div
      className={cn(
        "grid size-9 place-items-center rounded-full bg-gradient-to-br text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-white/60",
        gradient,
      )}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  );
}

const navItems = [
  { label: "Oversikt", href: "/oversikt", icon: LayoutDashboard },
  { label: "Planlegg", href: "/", icon: CalendarDays },
  { label: "Ansatte", href: "/ansatte", icon: Users },
  { label: "Butikker", href: "/butikker", icon: Store },
  { label: "Varsler", href: "/varsler", icon: Bell },
  { label: "Rapporter", href: "/rapporter", icon: BarChart3 },
  { label: "Innstillinger", href: "/innstillinger", icon: Settings },
  { label: "Mine vakter", href: "/ansattportal", icon: CalendarDays },
];

export function Sidebar({
  onOpenAlerts,
}: {
  onOpenAlerts: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { alertCount, alertsHydrated } = useAlerts();
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<"admin" | "employee">("admin");
  const [profileCard, setProfileCard] = useState<{ displayName: string; roleLabel: string; gradient: string } | null>(
    null,
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (useMockData) {
      setProfileCard({
        displayName: "Demonstrasjon",
        roleLabel: "Administrator",
        gradient: "from-slate-200 to-slate-100",
      });
      return;
    }
    let alive = true;
    getUserRole()
      .then((r) => {
        if (!alive) return;
        setRole(r);
      })
      .catch((err) => {
        console.error("Failed to load role for sidebar.", err);
      });
    getCurrentUserProfile()
      .then((p) => {
        if (!alive || !p) return;
        setProfileCard({ displayName: p.displayName, roleLabel: p.roleLabel, gradient: p.gradient });
      })
      .catch((err) => {
        console.error("Failed to load user profile for sidebar.", err);
      });
    return () => {
      alive = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    if (useMockData) return navItems;
    if (role === "admin") return navItems;
    return navItems.filter((i) => i.href === "/ansattportal");
  }, [role]);

  return (
    <aside className="w-[268px] shrink-0">
      <div className="flex h-[calc(100vh-48px)] flex-col rounded-[28px] bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
        <div className="flex items-center gap-3 px-2 py-2.5">
          <div className="grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-400 shadow-sm">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <div className="text-[15px] font-semibold tracking-tight text-slate-900">Shiftly</div>
        </div>

        <nav className="mt-4 space-y-1 px-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isAlerts = item.label === "Varsler";
            const isLink = item.href !== "#";
            const active = isLink && pathname === item.href;

            const className = cn(
              "group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50",
              active && "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
            );

            const content = (
              <>
                <Icon
                  className={cn(
                    "size-[18px] text-slate-500 transition-colors group-hover:text-slate-600",
                    active && "text-violet-600",
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {isAlerts && mounted && alertsHydrated && alertCount > 0 ? (
                  <span className="grid min-w-6 place-items-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
                    {alertCount}
                  </span>
                ) : null}
              </>
            );

            if (isLink) {
              return (
                <Link key={item.label} href={item.href} className={className}>
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={item.label}
                type="button"
                className={className}
                onClick={() => {
                  if (isAlerts) onOpenAlerts();
                }}
              >
                {content}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-1">
          <div className="rounded-3xl bg-white p-3 shadow-[0_16px_32px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
            <div className="flex items-center gap-3">
              <Avatar
                name={profileCard?.displayName ?? "…"}
                gradient={profileCard?.gradient ?? "from-slate-200 to-slate-100"}
              />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-slate-900">
                  {profileCard?.displayName ?? "Laster…"}
                </div>
                <div className="truncate text-[12px] text-slate-500">{profileCard?.roleLabel ?? "…"}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                try {
                  await signOut();
                } catch (err) {
                  console.error("Failed to sign out.", err);
                }
                router.replace("/login");
              }}
              className="mt-3 w-full rounded-2xl bg-white/70 px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
            >
              Logg ut
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

