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
