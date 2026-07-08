"use client";
// Configuración de centro de acopio del App Monitor, editable desde Parámetros y
// resuelta en el frontend (NO en el snapshot ni en el Lambda). Vive en dos tablas
// Supabase que la app lee directo (anon) y escribe con la sesión iniciada:
//   · monitor_zona_map    → mapeo prefijo de TRIPULACIÓN → centro de acopio
//   · monitor_centro_color → color de recuadro de ruta por centro
// El snapshot trae la tripulación cruda de cada chofer; acá se resuelve
// tripulación → centro (por prefijo) → color. Cambiar el mapeo o los colores se
// ve al instante, sin redeploy del Lambda.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSnap } from "./SnapshotContext";
import { createClient } from "@/lib/supabase/client";

// Color propuesto para un centro que todavía no tiene uno asignado (valor inicial
// del selector en Parámetros). No pinta la card hasta que se guarda.
export const COLOR_CENTRO_DEFAULT = "#2a78d6";

// Prefijo de una tripulación: en MAYÚSCULAS y sin el número final ("NCH 4" → "NCH",
// "La Serena 1" → "LA SERENA", "Arica" → "ARICA"). Es la clave del mapeo.
export function prefijoDe(tripulacion: string): string {
  return tripulacion.toUpperCase().trim().replace(/[\s\-_]*\d+\s*$/, "").trim();
}

export interface ZonaMapRow {
  prefijo: string;   // prefijo de la tripulación en MAYÚSCULAS (ej. "NCH")
  centro: string;    // centro de acopio resultante (ej. "Nuevo Chillán")
  orden: number;     // prioridad de match (menor = se evalúa primero)
}

// Estilo del recuadro tenue de la ruta a partir del color del centro. `undefined`
// (centro sin color) → sin recuadro: se conserva el estilo plano de la ruta.
export function estiloRuta(color: string | undefined | null): React.CSSProperties | undefined {
  if (!color) return undefined;
  return {
    display: "inline-block",           // envuelve solo el texto (el hero-route es block)
    border: `1.5px solid ${color}`,
    background: `color-mix(in srgb, ${color} 28%, transparent)`,
    color,
    padding: "2px 9px",
    borderRadius: 999,
    opacity: 1,                        // color a full (el hero-route trae opacity .8)
  };
}

interface Ctx {
  colores: Record<string, string>;             // centro → color hex
  zonaMap: ZonaMapRow[];                        // ordenado por `orden` asc
  loading: boolean;
  error: string | null;
  centroDe: (tripulacion: string | null | undefined) => string | undefined;   // tripulación → centro
  colorDe: (centro: string | null | undefined) => string | undefined;         // centro → color
  setColor: (centro: string, color: string) => Promise<void>;
  quitarColor: (centro: string) => Promise<void>;
  setMapeo: (row: ZonaMapRow) => Promise<void>;   // upsert por prefijo
  quitarMapeo: (prefijo: string) => Promise<void>;
}

const noop = async () => {};
const CentroColoresCtx = createContext<Ctx>({
  colores: {}, zonaMap: [], loading: false, error: null,
  centroDe: () => undefined, colorDe: () => undefined,
  setColor: noop, quitarColor: noop, setMapeo: noop, quitarMapeo: noop,
});

export function CentroColoresProvider({ children }: { children: React.ReactNode }) {
  const { snap } = useSnap();
  const [colores, setColores] = useState<Record<string, string>>({});
  const [zonaMap, setZonaMap] = useState<ZonaMapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const sb = createClient();
      const [colRes, mapRes] = await Promise.all([
        sb.from("monitor_centro_color").select("centro,color"),
        sb.from("monitor_zona_map").select("prefijo,centro,orden").order("orden", { ascending: true }),
      ]);
      if (colRes.error) throw new Error(colRes.error.message);
      if (mapRes.error) throw new Error(mapRes.error.message);
      setColores(Object.fromEntries((colRes.data ?? []).map((r) => [r.centro as string, r.color as string])));
      setZonaMap((mapRes.data ?? []) as ZonaMapRow[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Auto-descubrimiento: los prefijos de las tripulaciones presentes HOY (del
  // snapshot) que todavía no están en el mapeo se agregan solos al final. Así el
  // día que aparece una tripulación nueva, su centro queda listo para asignarle
  // nombre/color en Parámetros — sin sembrar nada a mano. Best-effort y silencioso:
  // en un kiosco sin sesión la escritura falla por RLS y no molesta (no hay ring).
  useEffect(() => {
    if (loading || !snap) return;
    const prefijosHoy = new Set<string>();
    const add = (trip?: string | null) => { if (trip) { const p = prefijoDe(trip); if (p) prefijosHoy.add(p); } };
    Object.values(snap.zonas).forEach((z) => z.cards.forEach((c) => add(c.tripulacion)));
    snap.carrusel.forEach((c) => add(c.tripulacion));

    const existentes = new Set(zonaMap.map((m) => m.prefijo.toUpperCase()));
    const faltantes = [...prefijosHoy].filter((p) => !existentes.has(p));
    if (faltantes.length === 0) return;

    let orden = zonaMap.reduce((m, r) => Math.max(m, r.orden), 0);
    // centro = el prefijo como placeholder (el operador lo renombra en Parámetros).
    const nuevos: ZonaMapRow[] = faltantes.map((p) => ({ prefijo: p, centro: p, orden: ++orden }));
    setZonaMap((rows) => [...rows, ...nuevos].sort((a, b) => a.orden - b.orden)); // optimista: corta el reintento
    createClient()
      .from("monitor_zona_map")
      .upsert(nuevos.map((n) => ({ ...n, updated_at: new Date().toISOString() })), { onConflict: "prefijo", ignoreDuplicates: true })
      .then(({ error }) => { if (error) { /* silencioso: sin sesión no persiste */ } });
  }, [snap, zonaMap, loading]);

  // tripulación → centro: primer prefijo (por `orden`) del que la tripulación es prefijo.
  const centroDe = useCallback(
    (tripulacion: string | null | undefined) => {
      if (!tripulacion) return undefined;
      const t = tripulacion.toUpperCase().trim();
      return zonaMap.find((m) => t.startsWith(m.prefijo.toUpperCase()))?.centro;
    },
    [zonaMap],
  );

  const colorDe = useCallback(
    (centro: string | null | undefined) => (centro ? colores[centro] : undefined),
    [colores],
  );

  const setColor = useCallback(async (centro: string, color: string) => {
    setColores((m) => ({ ...m, [centro]: color }));   // optimista: pinta al instante
    const { error } = await createClient()
      .from("monitor_centro_color")
      .upsert({ centro, color, updated_at: new Date().toISOString() }, { onConflict: "centro" });
    if (error) { setError(error.message); await cargar(); }
  }, [cargar]);

  const quitarColor = useCallback(async (centro: string) => {
    setColores((m) => { const n = { ...m }; delete n[centro]; return n; });
    const { error } = await createClient().from("monitor_centro_color").delete().eq("centro", centro);
    if (error) { setError(error.message); await cargar(); }
  }, [cargar]);

  const setMapeo = useCallback(async (row: ZonaMapRow) => {
    const prefijo = row.prefijo.toUpperCase().trim();
    const limpio: ZonaMapRow = { prefijo, centro: row.centro.trim(), orden: row.orden };
    setZonaMap((rows) => {
      const otros = rows.filter((r) => r.prefijo !== prefijo);
      return [...otros, limpio].sort((a, b) => a.orden - b.orden);
    });
    const { error } = await createClient()
      .from("monitor_zona_map")
      .upsert({ ...limpio, updated_at: new Date().toISOString() }, { onConflict: "prefijo" });
    if (error) { setError(error.message); await cargar(); }
  }, [cargar]);

  const quitarMapeo = useCallback(async (prefijo: string) => {
    setZonaMap((rows) => rows.filter((r) => r.prefijo !== prefijo));
    const { error } = await createClient().from("monitor_zona_map").delete().eq("prefijo", prefijo);
    if (error) { setError(error.message); await cargar(); }
  }, [cargar]);

  return (
    <CentroColoresCtx.Provider value={{
      colores, zonaMap, loading, error,
      centroDe, colorDe, setColor, quitarColor, setMapeo, quitarMapeo,
    }}>
      {children}
    </CentroColoresCtx.Provider>
  );
}

export function useCentroColores() {
  return useContext(CentroColoresCtx);
}
