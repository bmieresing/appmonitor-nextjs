// Acceso al snapshot. Lee la fila `public.monitor_snapshot` con el cliente de
// Supabase (anon key, RLS solo-lectura) — mismo patrón que app-tareas.
// Solo datos reales: si faltan las env o no hay fila, lanza error (no hay demo).
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Snapshot } from "./types";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export async function getSnapshot(): Promise<Snapshot> {
  const sb = getClient();
  const { data, error } = await sb
    .from("monitor_snapshot")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!data) throw new Error("Todavía no hay snapshot en la base. Corré el publisher.");
  return data.data as Snapshot;
}

/**
 * El snapshot SOLO si es más nuevo que `desde`; `null` si no cambió.
 *
 * El publisher recalcula cada 5 min y la app polea cada 60 s: cuatro de cada cinco
 * respuestas traen exactamente el mismo snapshot. El `.gt()` mueve esa comparación
 * al servidor —Postgres filtra por la columna `generated_at`, que está fuera del
 * JSONB— así que cuando no hay nada nuevo no viaja el `data`, que son ~300 KB. Es
 * un solo round-trip igual que antes: no se pregunta primero y se pide después.
 *
 * Sin `desde` (el primer fetch de la pestaña) trae el snapshot completo siempre.
 */
export async function getSnapshotSiCambio(desde: string | null): Promise<Snapshot | null> {
  const sb = getClient();
  let q = sb.from("monitor_snapshot").select("data").eq("id", 1);
  // Fecha ilegible del cliente: se ignora el filtro y se manda el snapshot entero,
  // que es el comportamiento seguro (peor caso, una transferencia de más).
  if (desde && !Number.isNaN(Date.parse(desde))) q = q.gt("generated_at", desde);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data ? (data.data as Snapshot) : null;
}
