"use client";
// Hook de datos con dos caminos:
//  · cargar()  → lee el snapshot materializado de Supabase (rápido). Corre en el
//    poll automático cada 60 s.
//  · refetch() → FUERZA un recálculo: invoca la RPC force_refresh() de Supabase
//    (mismo net.http_post que el cron; el write-back lo hace el trigger). Como
//    pg_net es asíncrono, el snapshot llega ~30 s después, así que tras disparar
//    pulimos la tabla hasta ver un generated_at más nuevo. Lo usa "Actualizar".
// Ya NO pega al Lambda directo: la URL/api-key del Lambda viven solo en Supabase.
// Mantiene el último snapshot bueno mientras recarga (no parpadea) y nunca pisa
// un snapshot más nuevo con uno más viejo (gana el de generated_at más reciente),
// así el poll no revierte un recálculo recién forzado.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const INTERVALO_MS = 60_000;
const PULL_MS = 3_000;       // cada cuánto pulimos la tabla tras forzar
const PULL_TIMEOUT_MS = 50_000; // el Lambda tarda ~30s; damos margen

function ganaElNuevo(nuevo: Snapshot, actual: Snapshot | null): boolean {
  if (!actual) return true;
  const a = Date.parse(nuevo.generated_at ?? "");
  const b = Date.parse(actual.generated_at ?? "");
  if (Number.isNaN(a) || Number.isNaN(b)) return true;
  return a >= b;
}

export function useSnapshot() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const vivo = useRef(true);
  const snapRef = useRef<Snapshot | null>(null);

  const aplicar = useCallback((nuevo: Snapshot) => {
    if (!vivo.current) return;
    if (ganaElNuevo(nuevo, snapRef.current)) {
      snapRef.current = nuevo;
      setSnap(nuevo);
    }
    setError(null);
  }, []);

  // Poll silencioso: lee la tabla materializada (no mueve el spinner).
  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/snapshot", { cache: "no-store" });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
      aplicar(body as Snapshot);
    } catch (e) {
      if (vivo.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, [aplicar]);

  // Botón: dispara la RPC y pule la tabla hasta que aparezca un snapshot más
  // nuevo que el que teníamos (o se agote el tiempo). El spinner queda prendido
  // toda esa ventana. Si se agota, no marca error: el poll de 60 s lo levanta.
  const refetch = useCallback(async () => {
    setLoading(true);
    const previo = Date.parse(snapRef.current?.generated_at ?? "");
    try {
      const { error: rpcError } = await createClient().rpc("force_refresh");
      if (rpcError) throw new Error(rpcError.message);

      const limite = Date.now() + PULL_TIMEOUT_MS;
      while (vivo.current && Date.now() < limite) {
        await new Promise((r) => setTimeout(r, PULL_MS));
        try {
          const r = await fetch("/api/snapshot", { cache: "no-store" });
          const body = await r.json().catch(() => null);
          if (r.ok && body) {
            const g = Date.parse((body as Snapshot).generated_at ?? "");
            if (Number.isNaN(previo) || (!Number.isNaN(g) && g > previo)) {
              aplicar(body as Snapshot);
              return;
            }
          }
        } catch {
          // reintento en la próxima vuelta del pull
        }
      }
    } catch (e) {
      if (vivo.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (vivo.current) setLoading(false);
    }
  }, [aplicar]);

  useEffect(() => {
    vivo.current = true;
    cargar();
    const id = setInterval(cargar, INTERVALO_MS);
    return () => { vivo.current = false; clearInterval(id); };
  }, [cargar]);

  return { snap, error, loading, refetch };
}
