import { supabase } from "./supabase";

export const collections = {
  lom_leads_v1: "leads",
  lom_batches_v1: "batches",
  lom_deliveries_v1: "deliveries",
  lom_cities_v1: "cities",
  lom_goals_v1: "goals",
  lom_audit_v1: "auditLogs",
  lom_mappings_v1: "mappings",
  lom_settings_v1: "settings",
  lom_clients_v1: "clients",
  lom_distributions_v1: "distributions",
  lom_weekly_reports_v1: "weeklyReports",
  lom_reconciliations_v1: "reconciliations",
} as const;
type Row = {
  collection: string;
  id: string;
  data: Record<string, unknown>;
  version: number;
  sort_order: number;
};
type Change = {
  collection: string;
  id: string;
  data?: Record<string, unknown>;
  version: number;
  position: number;
  operation: string;
};
export type SyncState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};
const singleton = new Set(["settings", "mappings"]);
const clone = <T>(value: T): T => structuredClone(value);

class CloudStore {
  private values = new Map<string, string>();
  private baseline = new Map<string, Row>();
  private workspace: string | null = null;
  private generation = 0;
  private running: Promise<void> | null = null;
  private attempt: {
    id: string;
    changes: Change[];
    rows: Map<string, Row>;
  } | null = null;
  private listeners = new Set<() => void>();
  state: SyncState = { status: "idle", message: "" };
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.values.get(key) === value) return;
    this.values.set(key, value);
    if (key in collections && this.workspace) {
      this.setState("saving", "Guardando en Supabase…");
      queueMicrotask(() => {
        void this.flush().catch(() => {});
      });
    }
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private setState(status: SyncState["status"], message: string) {
    this.state = { status, message };
    this.listeners.forEach((fn) => fn());
  }
  reset() {
    this.generation++;
    this.workspace = null;
    this.values.clear();
    this.baseline.clear();
    this.attempt = null;
    this.running = null;
    this.setState("idle", "");
  }
  async open(workspace: string) {
    this.reset();
    this.workspace = workspace;
    await this.reload();
  }
  async reload() {
    if (!this.workspace) return;
    const generation = this.generation;
    const rows: Row[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase
        .from("app_records")
        .select("collection,id,data,version,sort_order")
        .eq("workspace_id", this.workspace)
        .order("collection")
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      rows.push(...(data as Row[]));
      if (data.length < 500) break;
    }
    if (generation !== this.generation) return;
    this.baseline = new Map(
      rows.map((row) => [row.collection + "\0" + row.id, clone(row)]),
    );
    this.values.clear();
    for (const [key, collection] of Object.entries(collections)) {
      const group = rows
        .filter((row) => row.collection === collection)
        .sort(
          (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
        );
      if (group.length)
        this.values.set(
          key,
          JSON.stringify(
            singleton.has(collection)
              ? group[0].data
              : group.map((row) => row.data),
          ),
        );
    }
    this.attempt = null;
    this.setState("saved", "Datos guardados");
  }
  private snapshot() {
    const rows = new Map<string, Row>();
    for (const [key, collection] of Object.entries(collections)) {
      const raw = this.values.get(key);
      if (!raw) continue;
      const value = JSON.parse(raw);
      const records = singleton.has(collection) ? [value] : value;
      if (!Array.isArray(records))
        throw new Error("Formato de datos inválido: " + collection);
      const ids = new Set<string>();
      records.forEach((data: Record<string, unknown>, sort_order: number) => {
        const id = singleton.has(collection)
          ? "default"
          : String(data.id ?? "");
        if (!id || ids.has(id))
          throw new Error(
            "Registro sin identificador o duplicado en " + collection,
          );
        ids.add(id);
        const k = collection + "\0" + id;
        rows.set(k, {
          collection,
          id,
          data: clone(data),
          sort_order,
          version: this.baseline.get(k)?.version ?? 0,
        });
      });
    }
    return rows;
  }
  async flush(): Promise<void> {
    if (this.running) return this.running;
    if (!this.workspace) return;
    const generation = this.generation;
    this.running = (async () => {
      await Promise.resolve();
      try {
        do {
          if (!this.attempt) {
            const rows = this.snapshot();
            const changes: Change[] = [];
            for (const [key, row] of rows) {
              const old = this.baseline.get(key);
              // Reordering immutable audit notes is cosmetic; never rewrite them.
              if (
                !old ||
                JSON.stringify(old.data) !== JSON.stringify(row.data) ||
                (row.collection !== "auditLogs" &&
                  old.sort_order !== row.sort_order)
              )
                changes.push({
                  ...row,
                  position: row.sort_order,
                  operation: "upsert",
                });
            }
            for (const [key, row] of this.baseline)
              if (!rows.has(key) && row.collection !== "auditLogs")
                changes.push({
                  ...row,
                  position: row.sort_order,
                  operation: "delete",
                });
            if (!changes.length) {
              this.setState("saved", "Datos guardados");
              break;
            }
            this.attempt = { id: crypto.randomUUID(), changes, rows };
          }
          const attempt = this.attempt;
          this.setState("saving", "Guardando en Supabase…");
          const { error } = await supabase.rpc("commit_changes", {
            p_workspace: this.workspace,
            p_changes: attempt.changes,
            p_request: attempt.id,
          });
          if (generation !== this.generation) return;
          if (error) throw error;
          for (const change of attempt.changes) {
            const k = change.collection + "\0" + change.id;
            if (change.operation === "delete") this.baseline.delete(k);
            else
              this.baseline.set(k, {
                ...attempt.rows.get(k)!,
                version: change.version + 1,
              });
          }
          this.attempt = null;
        } while (generation === this.generation);
      } catch (error) {
        if (generation === this.generation) {
          const message = (error as Error).message || "Sin conexión";
          this.setState(
            "error",
            message.includes("CONFLICT")
              ? "Otra persona modificó estos datos. Recarga y repite tu cambio."
              : "No se pudo confirmar el guardado. Tus cambios siguen en esta pantalla. Reintenta antes de salir.",
          );
        }
        throw error;
      } finally {
        if (generation === this.generation) this.running = null;
      }
    })();
    return this.running;
  }
  hasData() {
    return this.baseline.size > 0;
  }
}
export const cloudStore = new CloudStore();
