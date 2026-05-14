/**
 * Resolve app role from all active employee rows for a user.
 * If a user is linked to both admin and employee rows, admin wins.
 * Empty list → treat as admin (org owner / bootstrap before first row sync).
 */
export function effectiveRoleFromEmployeeRows(
  rows: ReadonlyArray<{ role: string | null }> | null | undefined,
): "admin" | "employee" {
  const list = rows ?? [];
  if (list.some((r) => r.role === "admin")) return "admin";
  if (list.some((r) => r.role === "employee")) return "employee";
  return "admin";
}
