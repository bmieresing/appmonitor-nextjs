// Acceso al snapshot. Lee la fila `public.monitor_snapshot` con el cliente de
// Supabase (anon key, RLS solo-lectura) — mismo patrón que app-tareas.
// Solo datos reales: si faltan las env o no hay fila, lanza error (no hay demo).
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LecturaAlarmas, LecturaGps, LecturaOdometro, Snapshot } from "./types";

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

/**
 * Cierre de un día del historial: el último snapshot que se generó ese día (hora
 * Chile). Lo guarda el mismo trigger que pisa el de hoy (supabase/historial_schema.sql).
 */
export async function getSnapshotDia(dia: string): Promise<Snapshot> {
  const sb = getClient();
  const { data, error } = await sb
    .from("monitor_snapshot_dia")
    .select("data")
    .eq("dia", dia)
    .maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!data) throw new Error(`No hay snapshot guardado del ${dia.split("-").reverse().join("-")}.`);
  return data.data as Snapshot;
}

/**
 * Puntos GPS de un día (los trae el Lambda GPS cada minuto a monitor_gps_punto).
 * Sin `dia`, hoy; con `dia`, ese día del historial. Sin `desde`, el día completo;
 * con `desde` (el `hasta` de la lectura anterior), solo lo recibido después —
 * incluidos los rellenos que un camión manda con hora atrasada al recuperar la
 * señal. Es una RPC y no un SELECT porque la Data API corta en 1000 filas (ver
 * supabase/gps_schema.sql).
 */
export async function getGps(desde: string | null, dia: string | null = null): Promise<LecturaGps> {
  const sb = getClient();
  const valido = desde && !Number.isNaN(Date.parse(desde)) ? desde : null;
  // `dia` va solo cuando se pide: así la lectura de hoy es la misma llamada de
  // siempre y no depende de la firma nueva de la RPC.
  const { data, error } = await sb.rpc("gps_del_dia", dia ? { desde: valido, dia } : { desde: valido });
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data as LecturaGps;
}

/**
 * Alarmas de las reglas de Pegasus de un día (hoy sin `dia`), la más nueva primero,
 * y las geocercas que vigilan. Las guarda el trigger con la respuesta del Lambda GPS
 * (supabase/gps_alarma_schema.sql).
 */
export async function getAlarmas(dia: string | null = null): Promise<LecturaAlarmas> {
  const sb = getClient();
  const { data, error } = await sb.rpc("alarmas_del_dia", dia ? { dia } : {});
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data as LecturaAlarmas;
}

/**
 * Km y odómetro inicial/final de cada camión en un día (hoy sin `dia`), de
 * monitor_gps_odometro_dia: el resumen permanente que arma un trigger sobre los
 * puntos GPS (supabase/gps_odometro_dia_schema.sql). Lo usa la pestaña Flota.
 */
export async function getOdometro(dia: string | null = null): Promise<LecturaOdometro> {
  const sb = getClient();
  const { data, error } = await sb.rpc("odometro_del_dia", dia ? { dia } : {});
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data as LecturaOdometro;
}

/** Última respuesta exitosa del Lambda GPS (chip "GPS hh:mm" del encabezado). */
export async function getGpsEstado(): Promise<{ actualizado: string | null }> {
  const sb = getClient();
  const { data, error } = await sb
    .from("monitor_gps_estado")
    .select("actualizado")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return { actualizado: data?.actualizado ?? null };
}
