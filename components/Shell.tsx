"use client";
// Cáscara profesional: barra superior con marca + navegación horizontal +
// indicador de última actualización, refresh y menú de usuario (tema, zoom, logout). La
// navegación vive arriba (no en un sidebar) para no robar ancho al dashboard.
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import AppMonitorLogo from "@/assets/AppMonitorLogo.png";
import { SnapshotProvider, useSnap } from "./SnapshotContext";
import { CentroColoresProvider } from "./CentroColores";
import { DiaProvider, useDia } from "./DiaContext";
import ChipGps from "./ChipGps";
import SelectorDia from "./SelectorDia";
import MenuUsuario from "./MenuUsuario";
import { ZoomProvider, useZoom } from "./Zoom";

const VISTAS: [string, string, string][] = [
  ["Global", "/global", "🌐"],
  ["Santiago", "/santiago", "🏙️"],
  ["Regiones", "/regiones", "🗺️"],
  ["Mapa", "/mapa", "📍"],
  ["Recolecciones", "/recolecciones", "✅"],
  // Rendimiento no es pestaña propia: es una sección de Estadísticas.
  ["Estadisticas", "/estadisticas", "📊"],
  ["Carrusel", "/carrusel", "🎠"],
  ["Carrusel Zonas", "/carrusel-zonas", "🔄"],
  // Parámetros no va en la nav: vive en el menú de usuario (MenuUsuario).
];

function TopBar() {
  const pathname = usePathname();
  const { snap, error, loading, refetch } = useSnap();
  const { dia } = useDia();

  const hora = snap?.hora_ciclo
    ? new Date(snap.hora_ciclo).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";
  const hayFalla = !!snap?.falla || (!!error && !snap);
  return (
    <header className="topbar">
      <Link href="/global" className="brand" aria-label="App Monitor — inicio">
        <Image src={AppMonitorLogo} alt="Rendering Monitor" width={78} height={32} className="brand-img" priority />
      </Link>
      <nav className="topnav">
        {VISTAS.map(([label, href, ic]) => (
          <Link key={href} href={href} className={`nav-item${pathname === href ? " active" : ""}`}>
            <span className="ic">{ic}</span> {label}
          </Link>
        ))}
      </nav>
      <SelectorDia />
      {/* Mirando un día del historial no hay nada en vivo: ni GPS al minuto ni
          recálculo. El chip del snapshot pasa a decir de qué cierre son los datos. */}
      {dia ? (
        <span className="chip chip-historial" title={error ?? "Último snapshot que se guardó ese día"}>
          {error && !snap ? "sin datos" : `Cierre ${hora}`}
        </span>
      ) : (
        <>
          <span className={`chip${hayFalla ? " warn" : ""}`} title={snap?.falla ?? error ?? undefined}>
            <span className="dot" /> {error && !snap ? "sin datos" : hora}
          </span>
          <ChipGps />
          <button className={`icon-btn${loading ? " loading" : ""}`} onClick={refetch} disabled={loading} title="Forzar recálculo: trae datos frescos del Lambda (~30s)" aria-label="Forzar recálculo">
            <span className="spin">↺</span>
          </button>
        </>
      )}
      <MenuUsuario />
    </header>
  );
}

// Solo renderiza las vistas cuando hay datos reales. Sin datos muestra estado
// de carga o el error (no hay demo).
function Content({ children }: { children: React.ReactNode }) {
  const { snap, error, loading, refetch } = useSnap();
  const { dia, setDia } = useDia();
  if (snap) return <div className="content">{children}</div>;
  return (
    <div className="content">
      <div className="estado">
        {error ? (
          <>
            <div className="estado-ic">📭</div>
            <div className="estado-tit">No hay datos para mostrar</div>
            <p className="muted">{error}</p>
            {/* Un día del historial sin snapshot no se arregla reintentando. */}
            {dia ? (
              <button className="icon-btn" style={{ width: "auto", padding: "0 14px", marginTop: 6 }} onClick={() => setDia(null)}>
                Volver a hoy
              </button>
            ) : (
              <button className="icon-btn" style={{ width: "auto", padding: "0 14px", marginTop: 6 }} onClick={refetch}>
                {loading ? "Cargando…" : "Reintentar"}
              </button>
            )}
          </>
        ) : (
          <p className="muted">Cargando…</p>
        )}
      </div>
    </div>
  );
}

// Mientras llegan el snapshot y el zoom del usuario se muestra solo "Cargando…",
// sin barra: si no, la barra aparece a un tamaño y salta al otro cuando llega el
// zoom. Con error sí va la barra (para poder reintentar o cerrar sesión).
function Marco({ children }: { children: React.ReactNode }) {
  const { snap, error } = useSnap();
  const { listo } = useZoom();
  if (!listo || (!snap && !error)) {
    return <div className="estado estado-pantalla"><p className="muted">Cargando…</p></div>;
  }
  return (
    <div className="app">
      <TopBar />
      <Content>{children}</Content>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <DiaProvider>
      <SnapshotProvider>
        <CentroColoresProvider>
          <ZoomProvider>
            <Marco>{children}</Marco>
          </ZoomProvider>
        </CentroColoresProvider>
      </SnapshotProvider>
    </DiaProvider>
  );
}
