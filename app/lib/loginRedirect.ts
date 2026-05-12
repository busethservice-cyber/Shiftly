/** Internal path only — default /oversikt; blocks protocol-relative and absolute URLs. */
export function safeInternalNext(raw: string | null | undefined): string {
  const fallback = "/oversikt";
  if (raw == null || typeof raw !== "string") return fallback;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return fallback;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
  if (decoded.includes("://")) return fallback;
  return decoded.length > 0 ? decoded : fallback;
}
