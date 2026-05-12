"use client";

import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

const PROFILE_GRADIENTS = [
  "from-violet-200 to-indigo-200",
  "from-amber-200 to-rose-200",
  "from-sky-200 to-cyan-200",
  "from-emerald-200 to-teal-200",
  "from-fuchsia-200 to-violet-200",
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickProfileGradient(seed: string): string {
  return PROFILE_GRADIENTS[hashString(seed) % PROFILE_GRADIENTS.length] ?? PROFILE_GRADIENTS[0];
}

/** Prefer auth metadata, else humanize e-mail local-part (before @). */
export function displayNameFromAuthUser(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full = meta?.full_name ?? meta?.name;
  if (typeof full === "string" && full.trim()) return full.trim().slice(0, 120);

  const email = user.email?.trim() ?? "";
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "Admin";

  return local
    .replace(/[._+\-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 120);
}

export type CurrentUserProfile = {
  displayName: string;
  roleKey: "admin" | "employee";
  roleLabel: "Administrator" | "Ansatt";
  gradient: string;
};

/**
 * Sidebar / header: linked employee row when present, else e-mail–based name + Administrator.
 */
export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = getSupabaseClient();
  const { data: emp, error } = await supabase
    .from("employees")
    .select("name, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch employee profile for current user.", error);
  }

  const gradient = pickProfileGradient(user.id);

  if (emp?.name) {
    const roleKey = emp.role === "admin" ? "admin" : "employee";
    return {
      displayName: emp.name,
      roleKey,
      roleLabel: roleKey === "admin" ? "Administrator" : "Ansatt",
      gradient,
    };
  }

  return {
    displayName: displayNameFromAuthUser(user),
    roleKey: "admin",
    roleLabel: "Administrator",
    gradient,
  };
}

export async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function getCurrentOrganizationId() {
  // Simplified: 1 user = 1 organization
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function getUserRole(): Promise<"admin" | "employee"> {
  // Simplified: role comes from an employee row linked to this user.
  const user = await getCurrentUser();
  if (!user) return "employee";

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("Failed to fetch user role.", error);
    return "employee";
  }
  return data?.role === "admin" ? "admin" : "employee";
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // First-login bootstrap: create org row keyed by user.id
  const user = data.user;
  if (user) {
    const { error: orgError } = await supabase
      .from("organizations")
      .upsert([{ id: user.id, name: (user.email ?? "Organisasjon").slice(0, 120) }], { onConflict: "id" });
    if (orgError) {
      // Don't block login if org bootstrap fails.
      console.error("Failed to ensure organization row on login.", orgError);
    }

    // First logged-in user = admin (create employee row if missing)
    const { data: existing, error: existingError } = await supabase
      .from("employees")
      .select("id")
      .eq("organization_id", user.id)
      .limit(1);
    if (existingError) {
      console.error("Failed to check existing employees on login.", existingError);
    } else if ((existing ?? []).length === 0) {
      const seedName = displayNameFromAuthUser(user);
      const { error: seedError } = await supabase.from("employees").insert([
        {
          organization_id: user.id,
          store_id: null,
          user_id: user.id,
          role: "admin",
          name: seedName,
          position_percent: 100,
          contract_hours: 37.5,
          is_active: true,
        },
      ]);
      if (seedError) console.error("Failed to seed admin employee on first login.", seedError);
    }

    // Invite acceptance (simplified): if there's an employee whose name equals user email and no user_id, link it.
    const userEmail = (user.email ?? "").trim().toLowerCase();
    if (userEmail) {
      const { data: match, error: matchError } = await supabase
        .from("employees")
        .select("id")
        .eq("organization_id", user.id)
        .eq("is_active", true)
        .ilike("name", userEmail)
        .is("user_id", null)
        .maybeSingle();
      if (matchError) {
        console.error("Failed to check invite match on login.", matchError);
      } else if (match?.id) {
        const { error: linkError } = await supabase.from("employees").update({ user_id: user.id }).eq("id", match.id);
        if (linkError) console.error("Failed to link invited employee on login.", linkError);
      }
    }
  }

  return data;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

