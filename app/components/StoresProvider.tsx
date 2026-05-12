"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RetailStore } from "@/app/lib/types";
import { initialRetailStores } from "@/app/lib/storesData";
import { deactivateStore, getStores, upsertStore } from "@/app/lib/api";

type StoresContextValue = {
  stores: RetailStore[];
  setStores: React.Dispatch<React.SetStateAction<RetailStore[]>>;
  createOrUpdateStore: (store: RetailStore) => void;
  deleteStore: (storeId: string) => void;
  storesLoading: boolean;
};

const StoresContext = createContext<StoresContextValue | null>(null);

export function StoresProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<RetailStore[]>(() => initialRetailStores);
  const [storesLoading, setStoresLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      setStoresLoading(true);
      try {
        const data = await getStores();
        if (!alive) return;
        setStores(data);
      } catch (err) {
        console.error("Failed to load stores, falling back to mock data.", err);
        if (!alive) return;
        setStores(initialRetailStores);
      } finally {
        if (!alive) return;
        setStoresLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const createOrUpdateStore = useCallback((store: RetailStore) => {
    setStores((prev) => {
      const exists = prev.some((s) => s.id === store.id);
      return exists ? prev.map((s) => (s.id === store.id ? store : s)) : [...prev, store];
    });
    void upsertStore(store);
  }, []);

  const deleteStore = useCallback((storeId: string) => {
    // MVP-safe: we deactivate in Supabase; mock mode removes from localStorage.
    setStores((prev) => prev.filter((s) => s.id !== storeId));
    void deactivateStore(storeId);
  }, []);

  const value = useMemo(
    () => ({ stores, setStores, createOrUpdateStore, deleteStore, storesLoading }),
    [createOrUpdateStore, deleteStore, stores, storesLoading],
  );

  return <StoresContext.Provider value={value}>{children}</StoresContext.Provider>;
}

export function useStores() {
  const ctx = useContext(StoresContext);
  if (!ctx) throw new Error("useStores must be used within StoresProvider");
  return ctx;
}
