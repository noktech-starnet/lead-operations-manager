import type { UserRole } from "../types";
export const roleNames: Record<UserRole, string> = {
  admin: "Administrador",
  distribucion: "Distribución",
  conciliacion: "Conciliación",
};
export function canWrite(roles: UserRole[], collection: string) {
  return (
    roles.includes("admin") ||
    (roles.includes("distribucion") &&
      [
        "leads",
        "batches",
        "deliveries",
        "clients",
        "distributions",
        "weeklyReports",
        "mappings",
        "auditLogs",
      ].includes(collection)) ||
    (roles.includes("conciliacion") &&
      ["reconciliations", "auditLogs"].includes(collection))
  );
}
