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
//
// Los dos caminos piden con `?desde=<generated_at en memoria>`: el servidor filtra
// por esa fecha y responde `{ sin_cambios: true }` cuando no hay nada nuevo, en
// vez de mandar los ~300 KB del snapshot. Con el publisher recalculando cada 5 min
// y el poll cada 60 s, eso es cuatro de cada cinco respuestas.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const INTERVALO_MS = 60_000;
const PULL_MS = 3_000;       // cada cuánto pulimos la tabla tras forzar
const PULL_TIMEOUT_MS = 50_000; // el Lambda tarda ~30s; damos margen

// Respuesta del route cuando el snapshot de la base no es más nuevo que el que ya
// tenemos: no trae datos, solo la marca.
type Respuesta = (Snapshot & { sin_cambios?: undefined }) | { sin_cambios: true };

function esSinCambios(r: Respuesta | null): r is { sin_cambios: true } {
  return !!r && (r as { sin_cambios?: boolean }).sin_cambios === true;
}

// ¿Vale la pena reemplazar el snapshot que ya está en memoria? Solo si el que
// llegó es ESTRICTAMENTE más nuevo.
//
// El filtro por `?desde` ya descarta en el servidor casi todo lo que no cambió,
// pero esta guarda se queda igual: cubre la carrera entre el poll y un refetch
// forzado (los dos pueden traer snapshot a la vez) y el primer fetch, que va sin
// fecha. Mismo dato = mismo objeto = no se recalcula ningún useMemo aguas abajo,
// que es lo que evita que se rehagan los marcadores de los mapas y las series de
// los gráficos —y que se cierre el popup que el operador tuviera abierto—.
function esMasNuevo(nuevo: Snapshot, actual: Snapshot | null): boolean {
  if (!actual) return true;
  const a = Date.parse(nuevo.generated_at ?? "");
  const b = Date.parse(actual.generated_at ?? "");
  // Sin fecha comparable no hay forma de saber cuál es más nuevo: gana el último
  // que llegó, que es el comportamiento seguro.
  if (Number.isNaN(a) || Number.isNaN(b)) return true;
  return a > b;
}

export function useSnapshot() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const vivo = useRef(true);
  const snapRef = useRef<Snapshot | null>(null);

  const aplicar = useCallback((nuevo: Snapshot) => {
    if (!vivo.current) return;
    if (esMasNuevo(nuevo, snapRef.current)) {
      snapRef.current = nuevo;
      setSnap(nuevo);
    }
    setError(null);
  }, []);

  // Una lectura del route, condicionada a lo que ya tenemos en memoria. Devuelve
  // el snapshot si llegó uno nuevo, o null si no cambió nada.
  const pedir = useCallback(async (desde?: string | null): Promise<Snapshot | null> => {
    const qs = desde ? `?desde=${encodeURIComponent(desde)}` : "";
    const r = await fetch(`/api/snapshot${qs}`, { cache: "no-store" });
    const body = (await r.json().catch(() => null)) as Respuesta | { error?: string } | null;
    if (!r.ok) throw new Error((body as { error?: string })?.error || `HTTP ${r.status}`);
    if (esSinCambios(body as Respuesta)) return null;
    return body as Snapshot;
  }, []);

  // Poll silencioso: lee la tabla materializada (no mueve el spinner).
  const cargar = useCallback(async () => {
    try {
      const nuevo = await pedir(snapRef.current?.generated_at);
      if (nuevo) aplicar(nuevo);
      else if (vivo.current) setError(null);   // sin cambios es una respuesta sana
    } catch (e) {
      if (vivo.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, [aplicar, pedir]);

  // Botón: dispara la RPC y pule la tabla hasta que aparezca un snapshot más
  // nuevo que el que teníamos (o se agote el tiempo). El spinner queda prendido
  // toda esa ventana. Si se agota, no marca error: el poll de 60 s lo levanta.
  //
  // El "más nuevo que el que teníamos" lo resuelve el mismo `?desde` del poll: si
  // el pull recibe algo, por construcción ya es posterior al snapshot previo.
  const refetch = useCallback(async () => {
    setLoading(true);
    const previo = snapRef.current?.generated_at ?? null;
    try {
      const { error: rpcError } = await createClient().rpc("force_refresh");
      if (rpcError) throw new Error(rpcError.message);

      const limite = Date.now() + PULL_TIMEOUT_MS;
      while (vivo.current && Date.now() < limite) {
        await new Promise((r) => setTimeout(r, PULL_MS));
        try {
          const nuevo = await pedir(previo);
          if (nuevo) {
            aplicar(nuevo);
            return;
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
  }, [aplicar, pedir]);

  useEffect(() => {
    vivo.current = true;
    cargar();
    const id = setInterval(cargar, INTERVALO_MS);
    return () => { vivo.current = false; clearInterval(id); };
  }, [cargar]);

  return { snap, error, loading, refetch };
}
