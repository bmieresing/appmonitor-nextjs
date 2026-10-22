"use client";
// Pantalla de la tele de la oficina: la abre Monitor Android (android-tv/), que le
// suma las cámaras al costado. Es el Carrusel Zonas en kiosco fijo:
//  - entra sin sesión desde la IP de la oficina (OFFICE_IPS en middleware.ts);
//  - sin barra superior ni botones de salir o recalcular (force_refresh() exige sesión);
//  - ningún enlace sale de la página (chofer → /carrusel, centro → /regiones);
//  - ajustes de tamaño propios en globals.css (body.pantalla): la tele dibuja a
//    1280×720 y la página ocupa el 70%, así que sin ellos los KPI pasan a 2 filas.
import { useEffect } from "react";
import CarruselZonas from "@/components/CarruselZonas";
import ChipGps from "@/components/ChipGps";
import { useSnap } from "@/components/SnapshotContext";

export default function PantallaPage() {
  const { snap, error } = useSnap();

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
        </>
      }
    />
  );
}
