import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { Layers, LogOut, ShieldCheck } from "lucide-react";
import { supabase, configurationError } from "../../services/supabase";
import { storageService } from "../../services/storageService";
import { cloudStore } from "../../services/cloudStore";
import type { UserProfile, UserRole } from "../../types";

type AuthContextValue = {
  profile: UserProfile;
  workspace: string;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Authentication required");
  return value;
};
const button =
  "px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50";
const input =
  "w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500";
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-indigo-600">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Lead Operations Manager</h1>
            <p className="text-xs text-slate-400">Acceso seguro al equipo</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<{
    profile: UserProfile;
    workspace: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(configurationError || "");
  const [mode, setMode] = useState<"login" | "signup" | "recover" | "password">(
    "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const generation = useRef(0);
  const accountRef = useRef<typeof account>(null);
  const loadAccount = useCallback(async (current: Session | null) => {
    const request = ++generation.current;
    if (!current) {
      storageService.disconnect();
      accountRef.current = null;
      setAccount(null);
      setLoading(false);
      return;
    }
    try {
      const { data: member, error: memberError } = await supabase
        .from("memberships")
        .select("workspace_id,roles,active")
        .eq("user_id", current.user.id)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (memberError) throw memberError;
      if (request !== generation.current) return;
      if (!member) {
        storageService.disconnect();
        accountRef.current = null;
        setAccount(null);
        setLoading(false);
        return;
      }
      const profile: UserProfile = {
        id: current.user.id,
        email: current.user.email || "",
        nombre: current.user.user_metadata?.name || current.user.email || "",
        roles: member.roles as UserRole[],
        currentActiveRole: member.roles[0],
      };
      const old = accountRef.current;
      if (
        old?.profile.id === profile.id &&
        old.workspace === member.workspace_id &&
        JSON.stringify(old.profile.roles) === JSON.stringify(profile.roles)
      ) {
        setLoading(false);
        return;
      }
      // Auth callbacks only schedule this work, avoiding Supabase's callback lock.
      await storageService.initialize(profile, member.workspace_id);
      if (request !== generation.current) return;
      const next = { profile, workspace: member.workspace_id };
      accountRef.current = next;
      setAccount(next);
      setError("");
    } catch (e) {
      if (request === generation.current) {
        storageService.disconnect();
        accountRef.current = null;
        setAccount(null);
        setError(
          "No se pudo cargar el acceso. Comprueba tu conexión y vuelve a intentar.",
        );
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (configurationError) {
      setLoading(false);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, current) => {
      sessionRef.current = current;
      setSession(current);
      if (event === "PASSWORD_RECOVERY") setMode("password");
      if (!current) {
        generation.current++;
        storageService.disconnect();
        accountRef.current = null;
        setAccount(null);
      }
      setTimeout(() => void loadAccount(current), 0);
    });
    const timer = setInterval(() => {
      if (sessionRef.current) void loadAccount(sessionRef.current);
    }, 30000);
    return () => {
      subscription.unsubscribe();
      clearInterval(timer);
    };
  }, [loadAccount]);
  const signOut = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await storageService.flush();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      storageService.disconnect();
      accountRef.current = null;
      setAccount(null);
      setPassword("");
      setMode("login");
    } catch {
      setError(
        "No se pudo cerrar la sesión. Comprueba la conexión y el estado de guardado.",
      );
    } finally {
      setBusy(false);
    }
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setPassword("");
        if (!data.session) {
          setMode("login");
          setMessage(
            "Revisa tu correo y confirma tu cuenta. Después podrás iniciar sesión.",
          );
        }
      } else if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: window.location.origin },
        );
        if (error) throw error;
        setMessage(
          "Si la cuenta existe, recibirás un enlace para cambiar la contraseña.",
        );
      } else if (mode === "password") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setMode("login");
        setMessage("Contraseña actualizada.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setPassword("");
      }
    } catch (e) {
      const m = (e as Error).message;
      setError(
        m.includes("Invalid login")
          ? "Correo o contraseña incorrectos."
          : m.includes("Email not confirmed")
            ? "Confirma tu correo antes de iniciar sesión."
            : m.includes("fetch")
              ? "No se pudo conectar. Comprueba tu conexión."
              : m,
      );
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <Frame>
        <p role="status" className="text-sm text-slate-300">
          Cargando tu espacio de trabajo…
        </p>
      </Frame>
    );
  if (session && account && mode !== "password")
    return (
      <AuthContext.Provider value={{ ...account, signOut }}>
        {children}
        {error && (
          <div
            role="alert"
            className="fixed bottom-4 right-4 bg-rose-950 p-4 border border-rose-700 rounded-xl"
          >
            {error}
          </div>
        )}
      </AuthContext.Provider>
    );
  if (session && mode !== "password")
    return (
      <Frame>
        <ShieldCheck className="w-8 h-8 text-indigo-400 mb-3" />
        <h2 className="font-bold text-lg">Tu cuenta está creada</h2>
        <p className="text-sm text-slate-400 mt-2 mb-5">
          Un administrador debe autorizar el acceso al equipo. Tu cuenta:{" "}
          {session.user.email}
        </p>
        {error && (
          <p role="alert" className="text-rose-300 mb-3">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button className={button} onClick={() => void loadAccount(session)}>
            Comprobar acceso
          </button>
          <button
            disabled={busy}
            className="text-sm text-slate-300"
            onClick={() => void signOut()}
          >
            Cerrar sesión
          </button>
        </div>
      </Frame>
    );
  return (
    <Frame>
      <h2 className="text-xl font-bold mb-4">
        {mode === "signup"
          ? "Crear cuenta"
          : mode === "recover"
            ? "Recuperar contraseña"
            : mode === "password"
              ? "Nueva contraseña"
              : "Iniciar sesión"}
      </h2>
      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <label className="block text-sm text-slate-300">
            Nombre
            <input
              className={input + " mt-1"}
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        {mode !== "password" && (
          <label className="block text-sm text-slate-300">
            Correo electrónico
            <input
              className={input + " mt-1"}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        {mode !== "recover" && (
          <label className="block text-sm text-slate-300">
            Contraseña
            <input
              className={input + " mt-1"}
              type="password"
                aria-label="Contraseña"
              required
              minLength={mode === "login" ? 1 : 12}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode !== "login" && (
              <span className="text-xs text-slate-400">
                Usa al menos 12 caracteres.
              </span>
            )}
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-emerald-300">
            {message}
          </p>
        )}
        <button
          className={button + " w-full"}
          disabled={busy || !!configurationError}
        >
          {busy
            ? "Procesando…"
            : mode === "signup"
              ? "Crear cuenta"
              : mode === "recover"
                ? "Enviar enlace"
                : mode === "password"
                  ? "Guardar contraseña"
                  : "Entrar"}
        </button>
      </form>
      <div className="mt-5 flex flex-wrap gap-4 text-xs text-indigo-300">
        {mode !== "signup" && (
          <button
            onClick={() => {
              setMode("signup");
              setMessage("");
              setError("");
              setPassword("");
            }}
          >
            Crear cuenta
          </button>
        )}
        {mode !== "login" && (
          <button
            onClick={() => {
              setMode("login");
              setMessage("");
              setError("");
              setPassword("");
            }}
          >
            Volver a iniciar sesión
          </button>
        )}
        {mode === "login" && (
          <button
            onClick={() => {
              setMode("recover");
              setError("");
              setMessage("");
              setPassword("");
            }}
          >
            Olvidé mi contraseña
          </button>
        )}
      </div>
    </Frame>
  );
}
