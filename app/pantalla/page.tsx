"use client";
// Pantalla de la tele de la oficina: la abre Monitor Android (android-tv/), que le
// suma las cámaras al costado. Es el Carrusel Zonas en kiosco fijo:
//  - entra sin sesión desde la IP de la oficina (OFFICE_IPS en middleware.ts);
//  - sin barra superior ni botones de salir o recalcular (force_refresh() exige sesión);
//  - ningún enlace sale de la página (chofer → /carrusel, centro → /regiones);
//  - ajustes de tamaño propios en globals.css (body.pantalla): la tele dibuja a
//    1280×720 y la página ocupa el 70%, así que sin ellos los KPI pasan a 2 filas.
//  - zoom propio (− % +) que se ajusta con el control remoto. No usa el ZoomControl
//    del tablero porque ese guarda por usuario y acá no hay sesión: se guarda en el
//    localStorage del WebView de la tele.
import { useEffect, useState } from "react";
import CarruselZonas from "@/components/CarruselZonas";
import ChipGps from "@/components/ChipGps";
import { useSnap } from "@/components/SnapshotContext";
import { useTheme } from "@/components/ThemeProvider";

const ZOOM_POR_DEFECTO = 0.75;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.2;
const ZOOM_PASO = 0.05;
const ZOOM_CLAVE = "pantalla-zoom";

const acotar = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z / ZOOM_PASO) * ZOOM_PASO));

function leerZoom(): number {
  try {
    const z = Number(localStorage.getItem(ZOOM_CLAVE));
    return z > 0 ? acotar(z) : ZOOM_POR_DEFECTO;
  } catch {
    return ZOOM_POR_DEFECTO;
  }
}

export default function PantallaPage() {
  const { snap, error } = useSnap();
  // Claro/oscuro: acá no está el menú de usuario, que es donde vive el cambio de
  // tema. ThemeProvider ya lo guarda en localStorage, así que la tele lo recuerda.
  const { mode, toggle } = useTheme();
  const [zoom, setZoom] = useState<number | null>(null);

  // Lo lee recién en el cliente (localStorage no existe en el render del servidor)
  useEffect(() => setZoom(leerZoom()), []);

  useEffect(() => {
    if (zoom === null) return;
    // globals.css: body.pantalla .content { zoom: var(--pantalla-zoom) }
    document.body.style.setProperty("--pantalla-zoom", String(zoom));
    try { localStorage.setItem(ZOOM_CLAVE, String(zoom)); } catch { /* queda solo en memoria */ }
  }, [zoom]);
  useEffect(() => () => { document.body.style.removeProperty("--pantalla-zoom"); }, []);

  const cambiarZoom = (z: number) => setZoom(acotar(z));
  const actual = zoom ?? ZOOM_POR_DEFECTO;

  useEffect(() => {
    document.body.classList.add("kiosk", "pantalla");
    // Captura en document: corre antes que el handler de <Link>, que React escucha
    // en la raíz. Cubre también el OK del control remoto (llega como click).
    const bloquear = (e: MouseEvent) => {
      if ((e.target as Element).closest("a")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", bloquear, true);
    return () => {
      document.body.classList.remove("kiosk", "pantalla");
      document.removeEventListener("click", bloquear, true);
    };
  }, []);

  const hora = snap?.hora_ciclo
    ? new Date(snap.hora_ciclo).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";
  const hayFalla = !!snap?.falla || (!!error && !snap);

  return (
    <CarruselZonas
      controles={
        <>
          <span className={`chip${hayFalla ? " warn" : ""}`} title={snap?.falla ?? error ?? undefined}>
            <span className="dot" /> {error && !snap ? "sin datos" : hora}
          </span>
          <ChipGps />
          <span className="zoom-ctl" role="group" aria-label="Zoom de la pantalla">
            <button onClick={() => cambiarZoom(actual - ZOOM_PASO)} disabled={actual <= ZOOM_MIN} title="Alejar" aria-label="Alejar">−</button>
            <button className="zoom-pct tnum" onClick={() => cambiarZoom(ZOOM_POR_DEFECTO)}
              title={`Zoom de la pantalla (clic: volver a ${Math.round(ZOOM_POR_DEFECTO * 100)} %)`}>{Math.round(actual * 100)}%</button>
            <button onClick={() => cambiarZoom(actual + ZOOM_PASO)} disabled={actual >= ZOOM_MAX} title="Acercar" aria-label="Acercar">+</button>
          </span>
          <button className="icon-btn" onClick={toggle}
            title={mode === "light" ? "Modo oscuro" : "Modo claro"} aria-label={mode === "light" ? "Modo oscuro" : "Modo claro"}>
            {mode === "light" ? "🌙" : "☀️"}
          </button>
        </>
      }
    />
  );
}
