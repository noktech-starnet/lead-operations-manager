import React, { useEffect, useSyncExternalStore, useState } from "react";
import { cloudStore } from "../../services/cloudStore";
import { storageService } from "../../services/storageService";
export function SyncStatus() {
  const state = useSyncExternalStore(
    cloudStore.subscribe,
    () => cloudStore.state,
  );
  const [discarding, setDiscarding] = useState(false);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (
        cloudStore.state.status === "saving" ||
        cloudStore.state.status === "error"
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  if (state.status === "idle") return null;
  return (
    <>
      <div
        role={state.status === "error" ? "alert" : "status"}
        className={
          "px-6 py-1.5 text-xs border-b " +
          (state.status === "error"
            ? "bg-rose-950 text-rose-200 border-rose-800"
            : "bg-slate-900 text-slate-400 border-slate-800")
        }
      >
        {state.message}
        {state.status === "error" && (
          <span className="ml-3 inline-flex gap-3">
            <button
              onClick={() => void cloudStore.flush().catch(() => {})}
              className="underline font-bold"
            >
              Reintentar guardado
            </button>
            <button
              disabled={discarding}
              onClick={async () => {
                if (
                  !confirm(
                    "Se descartarán los cambios sin guardar de esta pantalla y se cargarán los datos de Supabase. ¿Continuar?",
                  )
                )
                  return;
                setDiscarding(true);
                try {
                  await storageService.discardAndRefresh();
                  window.location.reload();
                } catch {
                } finally {
                  setDiscarding(false);
                }
              }}
              className="underline"
            >
              Descartar cambios y recargar
            </button>
          </span>
        )}
      </div>
      {state.status === "saving" && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/30 flex items-end justify-center pb-8 cursor-wait"
          aria-label="Guardado en curso"
        >
          <div className="rounded-xl bg-slate-900 border border-indigo-500 px-5 py-3 text-sm text-indigo-200 shadow-xl">
            Guardando en Supabase…
          </div>
        </div>
      )}
      {state.status === "error" && (
        <div className="fixed inset-x-0 bottom-0 z-[100] bg-rose-950 border-t border-rose-700 p-4 text-sm text-rose-200">
          <p>{state.message}</p>
          <button
            className="underline mr-4"
            onClick={() => void cloudStore.flush().catch(() => {})}
          >
            Reintentar guardado
          </button>
          <span>
            Revisa el estado de guardado en la parte superior antes de
            continuar.
          </span>
        </div>
      )}
    </>
  );
}
