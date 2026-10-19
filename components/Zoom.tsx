"use client";
// Zoom propio del tablero (no el del navegador), uno para la vista normal y otro
// para pantalla completa: la misma persona suele mirar el tablero en su escritorio
// y proyectarlo en una TV, y cada uso pide un tamaño distinto. Se guardan por
// usuario en Supabase (monitor_user_pref), así cada uno lo encuentra igual en
// cualquier equipo. Sin sesión se usa el valor por defecto y no se persiste.
//
// Se escala <html> con `zoom` de CSS —que a diferencia de `transform: scale` sí
// re-diagrama: con menos zoom entran más cards por fila—, barra superior incluida.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const POR_DEFECTO = 0.9; // al 100 % del navegador se ve como el 90 % de siempre
const MIN = 0.6;
const MAX = 1.3;
const PASO = 0.05;
const GUARDAR_MS = 700; // agrupa los clics seguidos de −/+ en una sola escritura

type Zooms = { normal: number; kiosco: number };
// `listo`: ya se leyeron las preferencias (o no hay sesión). Hasta entonces el Shell
// no muestra la barra, para que no se vea saltar de tamaño cuando llega el zoom.
type Ctx = { zoom: number; setZoom: (z: number) => void; listo: boolean };
const ZoomCtx = createContext<Ctx>({ zoom: POR_DEFECTO, setZoom: () => {}, listo: false });

const acotar = (z: number) => Math.min(MAX, Math.max(MIN, Math.round(z / PASO) * PASO));

export function ZoomProvider({ children }: { children: React.ReactNode }) {
  const [zooms, setZooms] = useState<Zooms>({ normal: POR_DEFECTO, kiosco: POR_DEFECTO });
  const [kiosco, setKiosco] = useState(false);
  const [listo, setListo] = useState(false);
  const userId = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Preferencias del usuario logueado. Si fallan, queda el default: nunca se
  // bloquea la app por esto.
  useEffect(() => {
    const sb = createClient();
    (async () => {
      try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        userId.current = user.id;
        const { data } = await sb.from("monitor_user_pref")
          .select("zoom_normal,zoom_kiosco").eq("user_id", user.id).maybeSingle();
        if (data) setZooms({ normal: acotar(Number(data.zoom_normal)), kiosco: acotar(Number(data.zoom_kiosco)) });
      } catch { /* default */ } finally {
        setListo(true);
      }
    })();
  }, []);

  // El modo kiosco lo prende FullscreenToggle con la clase body.kiosk; se observa
  // la clase para no acoplar los dos componentes.
  useEffect(() => {
    const leer = () => setKiosco(document.body.classList.contains("kiosk"));
    leer();
    const mo = new MutationObserver(leer);
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  const clave: keyof Zooms = kiosco ? "kiosco" : "normal";
  const zoom = zooms[clave];

  const setZoom = useCallback((z: number) => {
    setZooms((prev) => {
      const next = { ...prev, [clave]: acotar(z) };
      if (userId.current) {
        clearTimeout(timer.current);
        const uid = userId.current;
        timer.current = setTimeout(() => {
          createClient().from("monitor_user_pref").upsert({
            user_id: uid, zoom_normal: next.normal, zoom_kiosco: next.kiosco,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" }).then(() => { /* best-effort: el zoom ya se ve */ });
        }, GUARDAR_MS);
      }
      return next;
    });
  }, [clave]);

  // Va sobre <html> y no sobre `.content`: escala la página entera, barra superior
  // incluida, y todo se re-diagrama igual que con el zoom del navegador.
  useEffect(() => {
    document.documentElement.style.zoom = String(zoom);
  }, [zoom]);
  useEffect(() => () => { document.documentElement.style.zoom = ""; }, []);

  return <ZoomCtx.Provider value={{ zoom, setZoom, listo }}>{children}</ZoomCtx.Provider>;
}

export const useZoom = () => useContext(ZoomCtx);

// Control − 90% +. Ajusta el zoom del modo que se está viendo (normal o pantalla
// completa). Clic en el porcentaje vuelve al valor por defecto.
export function ZoomControl() {
  const { zoom, setZoom } = useZoom();
  return (
    <span className="zoom-ctl" role="group" aria-label="Zoom del tablero">
      <button onClick={() => setZoom(zoom - PASO)} disabled={zoom <= MIN} title="Alejar" aria-label="Alejar">−</button>
      <button className="zoom-pct tnum" onClick={() => setZoom(POR_DEFECTO)}
        title={`Zoom del tablero (clic: volver a ${Math.round(POR_DEFECTO * 100)} %)`}>{Math.round(zoom * 100)}%</button>
      <button onClick={() => setZoom(zoom + PASO)} disabled={zoom >= MAX} title="Acercar" aria-label="Acercar">+</button>
    </span>
  );
}
