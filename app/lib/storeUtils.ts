import type { RetailStore } from "@/app/lib/types";

export function activeStores(stores: RetailStore[]): RetailStore[] {
  return stores.filter((s) => s.status === "active");
}
