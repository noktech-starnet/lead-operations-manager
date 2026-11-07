import React, { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { useAuth } from "./AuthGate";
import type { UserRole } from "../../types";
import { roleNames } from "../../services/access";
type Member = {
  user_id: string;
  roles: UserRole[];
  active: boolean;
  profiles: { email: string; display_name: string };
};
type Invitation = { email: string; roles: UserRole[] };
export function TeamAccess() {
  const { workspace, profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<UserRole[]>(["distribucion"]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const [m, i] = await Promise.all([
      supabase
        .from("memberships")
        .select("user_id,roles,active,profiles(email,display_name)")
        .eq("workspace_id", workspace),
      supabase
        .from("invitations")
        .select("email,roles")
        .eq("workspace_id", workspace),
    ]);
    if (m.error || i.error) throw m.error || i.error;
    setMembers(m.data as unknown as Member[]);
    setInvites(i.data as Invitation[]);
  };
  useEffect(() => {
    void load().catch(() => setMessage("No se pudo cargar el equipo."));
  }, [workspace]);
  if (!profile.roles.includes("admin")) return null;
  const act = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await fn();
      if (error) throw error;
      await load();
      setMessage("Acceso actualizado.");
    } catch {
      setMessage(
        "No se pudo actualizar el acceso. Comprueba tu conexión y vuelve a intentar.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5">
      <div>
        <h3 className="font-bold text-slate-100">Acceso del equipo</h3>
        <p className="text-xs text-slate-400 mt-1">
          Autoriza un correo y asigna sus funciones. La persona debe crear su
          cuenta y confirmar el correo. Esta autorización no envía un mensaje.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!roles.length) return;
          void act(() =>
            supabase
              .from("invitations")
              .upsert(
                {
                  workspace_id: workspace,
                  email: email.trim().toLowerCase(),
                  roles,
                },
                { onConflict: "workspace_id,email" },
              ),
          );
        }}
        className="flex flex-wrap gap-3 items-end"
      >
        <label className="text-xs text-slate-300">
          Correo autorizado
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700"
          />
        </label>
        <div className="flex gap-3 pb-2">
          {Object.entries(roleNames).map(([role, label]) => (
            <label key={role} className="text-xs text-slate-300 flex gap-1">
              <input
                type="checkbox"
                checked={roles.includes(role as UserRole)}
                onChange={(e) =>
                  setRoles(
                    e.target.checked
                      ? [...roles, role as UserRole]
                      : roles.filter((r) => r !== role),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
        <button
          disabled={busy || !roles.length}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold disabled:opacity-50"
        >
          Autorizar correo
        </button>
      </form>
      {message && (
        <p role="status" className="text-sm text-indigo-300">
          {message}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-2">Cuenta</th>
              <th>Roles</th>
              <th>Estado</th>
              <th>Acceso</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr className="border-t border-slate-800" key={m.user_id}>
                <td className="py-3">{m.profiles.email}</td>
                <td>{m.roles.map((r) => roleNames[r]).join(", ")}</td>
                <td>{m.active ? "Activo" : "Suspendido"}</td>
                <td>
                  {m.user_id === profile.id ? (
                    "Tu cuenta"
                  ) : (
                    <button
                      disabled={busy}
                      className="text-indigo-300 underline"
                      onClick={() =>
                        void act(() =>
                          supabase
                            .from("memberships")
                            .update({ active: !m.active })
                            .eq("workspace_id", workspace)
                            .eq("user_id", m.user_id),
                        )
                      }
                    >
                      {m.active ? "Suspender" : "Reactivar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2">
        <h4 className="text-xs text-slate-400">Correos autorizados</h4>
        {invites.map((i) => (
          <div className="flex gap-3 text-xs" key={i.email}>
            <span>
              {i.email} — {i.roles.map((r) => roleNames[r]).join(", ")}
            </span>
            {i.email !== profile.email && (
              <button
                disabled={busy}
                className="text-rose-300 underline"
                onClick={() =>
                  void act(() =>
                    supabase
                      .from("invitations")
                      .delete()
                      .eq("workspace_id", workspace)
                      .eq("email", i.email),
                  )
                }
              >
                Retirar autorización futura
              </button>
            )}
          </div>
        ))}
        <p className="text-[11px] text-slate-500">
          Para retirar acceso a una cuenta activa, usa Suspender. Puedes
          actualizar sus roles autorizando nuevamente su correo.
        </p>
      </div>
    </section>
  );
}
