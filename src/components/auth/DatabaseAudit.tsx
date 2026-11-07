import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { useAuth } from "./AuthGate";
type Event = {
  id: string;
  actor_email: string | null;
  collection: string;
  record_id: string;
  action: string;
  occurred_at: string;
};
export function DatabaseAudit() {
  const { workspace } = useAuth();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("audit_events")
      .select("id,actor_email,collection,record_id,action,occurred_at")
      .eq("workspace_id", workspace)
      .order("occurred_at", { ascending: false })
      .order("id")
      .range(page * 50, page * 50 + 49);
    if (error) setError("No se pudo cargar la auditoría.");
    else {
      setRows(data);
      setError("");
    }
    setBusy(false);
  }, [workspace, page]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
      <div className="flex justify-between">
        <div>
          <h3 className="font-bold">Auditoría de la base de datos</h3>
          <p className="text-xs text-slate-400 mt-1">
            Registro automático y permanente. Las cuentas de la aplicación no
            pueden modificar ni borrar este historial. El historial completo
            conserva las versiones anteriores.
          </p>
        </div>
        <button
          className="text-xs text-indigo-300"
          disabled={busy}
          onClick={() => void load()}
        >
          Actualizar auditoría
        </button>
      </div>
      {error && (
        <p role="alert" className="text-rose-300 text-xs">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-slate-400">
            <tr>
              <th>Fecha</th>
              <th>Cuenta</th>
              <th>Información</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="py-2">
                  {new Date(row.occurred_at).toLocaleString("es-MX", {
                    timeZone: "America/Mexico_City",
                  })}
                </td>
                <td>{row.actor_email || "Configuración del sistema"}</td>
                <td>
                  {row.collection}: {row.record_id}
                </td>
                <td>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 text-xs">
        <button
          disabled={page === 0 || busy}
          onClick={() => setPage((p) => p - 1)}
          className="text-indigo-300 disabled:text-slate-600"
        >
          Anterior
        </button>
        <span>Página {page + 1}</span>
        <button
          disabled={rows.length < 50 || busy}
          onClick={() => setPage((p) => p + 1)}
          className="text-indigo-300 disabled:text-slate-600"
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
