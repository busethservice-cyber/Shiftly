"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMockData } from "@/app/lib/runtimeConfig";
import { getCurrentOrganizationId } from "@/app/lib/auth";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import type { ShiftlySettings } from "@/app/lib/settings";
import { createDefaultSettings, normalizeSettings } from "@/app/lib/settings";

type SettingsContextValue = {
  settings: ShiftlySettings;
  updateSettings: (next: ShiftlySettings) => Promise<void>;
  resetSettings: () => Promise<void>;
  settingsLoading: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const LS_KEY = "shiftly:settings";

function readLocalSettings(): ShiftlySettings | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return normalizeSettings(JSON.parse(raw) as Partial<ShiftlySettings>);
  } catch {
    return null;
  }
}

function writeLocalSettings(next: ShiftlySettings) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ShiftlySettings>(() => createDefaultSettings());
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (useMockData) {
          const local = readLocalSettings();
          if (!cancelled) setSettings(local ?? createDefaultSettings());
          return;
        }

        const orgId = await getCurrentOrganizationId();
        if (!orgId) {
          if (!cancelled) setSettings(createDefaultSettings());
          return;
        }

        const supabase = getSupabaseClient();
        const { data, error } = await supabase.from("settings").select("*").eq("organization_id", orgId).maybeSingle();
        if (error) throw error;

        const raw =
          data && typeof (data as any).data === "object" && (data as any).data
            ? ((data as any).data as Partial<ShiftlySettings>)
            : (data as any);

        if (!cancelled) setSettings(normalizeSettings(raw));
      } catch {
        if (!cancelled) setSettings(createDefaultSettings());
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSupabase = useCallback(async (orgId: string, next: ShiftlySettings) => {
    const supabase = getSupabaseClient();

    // Prefer a jsonb 'data' column if present; fall back to flat columns.
    const attempt1 = await supabase.from("settings").upsert({ organization_id: orgId, data: next } as any);
    if (!attempt1.error) return;

    const attempt2 = await supabase.from("settings").upsert({ organization_id: orgId, ...next } as any);
    if (attempt2.error) throw attempt2.error;
  }, []);

  const updateSettings = useCallback(
    async (next: ShiftlySettings) => {
      const normalized = normalizeSettings(next);
      setSettings(normalized);

      if (useMockData) {
        writeLocalSettings(normalized);
        return;
      }

      const orgId = await getCurrentOrganizationId();
      if (!orgId) return;
      await persistSupabase(orgId, normalized);
    },
    [persistSupabase],
  );

  const resetSettings = useCallback(async () => {
    await updateSettings(createDefaultSettings());
  }, [updateSettings]);

  const value = useMemo(
    () => ({ settings, updateSettings, resetSettings, settingsLoading }),
    [resetSettings, settings, settingsLoading, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

