"use client";
// Cáscara profesional: barra superior con marca + navegación horizontal +
// indicador de última actualización, refresh y menú de usuario (tema, zoom, logout). La
// navegación vive arriba (no en un sidebar) para no robar ancho al dashboard.
import React, { useEffect, useRef, useState } from "react";
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
import AvisosAlarma from "./AvisosAlarma";
import { ZoomProvider, useZoom } from "./Zoom";

type Vista = [string, string, string];

const VISTAS: Vista[] = [
  ["Global", "/global", "🌐"],
  ["Santiago", "/santiago", "🏙️"],
  ["Regiones", "/regiones", "🗺️"],
  ["Mapa", "/mapa", "📍"],
  ["Recolecciones", "/recolecciones", "✅"],
  ["Carrusel", "/carrusel", "🎠"],
  ["Carrusel Zonas", "/carrusel-zonas", "🔄"],
  // Parámetros no va en la nav: vive en el menú de usuario (MenuUsuario).
];

// Lo que se consulta o revisa, no lo que se mira en vivo: un desplegable al final
// de la nav, para que la barra no baje a una segunda fila.
const REPORTES: Vista[] = [
  // Rendimiento no es pestaña propia: es una sección de Estadísticas.
  ["Estadísticas", "/estadisticas", "📊"],
  ["Alertas", "/alertas", "🚨"],
  ["Flota", "/flota", "🚚"],
];

/** Desplegable de la nav. El menú va con posición fija, calculada desde el botón:
 *  la nav tiene scroll horizontal y recortaría uno anclado adentro. Se cierra con
 *  clic afuera, con Escape, al elegir una vista o si la página scrollea. */
function NavGrupo({ label, icono, vistas }: { label: string; icono: string; vistas: Vista[] }) {
  const pathname = usePathname();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const activo = vistas.some(([, href]) => href === pathname);
  const actual = vistas.find(([, href]) => href === pathname);

  useEffect(() => {
    if (!pos) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !pop.current?.contains(t)) setPos(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const cerrar = () => setPos(null);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", cerrar);
    window.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [pos]);

  const alternar = () => {
    if (pos) { setPos(null); return; }
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
  };

  return (
    <>
      <button ref={btn} className={`nav-item nav-grupo${activo ? " active" : ""}`} onClick={alternar}
        aria-haspopup="menu" aria-expanded={!!pos}>
        <span className="ic">{actual ? actual[2] : icono}</span> {actual ? `${label} · ${actual[0]}` : label}
        <span className="nav-grupo-chev">▾</span>
      </button>
      {pos && (
        <div ref={pop} className="menu-usr-pop nav-grupo-pop" role="menu" style={{ top: pos.top, left: pos.left }}>
          {vistas.map(([l, href, ic]) => (
            <Link key={href} href={href} role="menuitem" onClick={() => setPos(null)}
              className={`menu-usr-item${pathname === href ? " active" : ""}`}>
              <span className="ic">{ic}</span> {l}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

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
        <NavGrupo label="Reportes" icono="📑" vistas={REPORTES} />
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
      {/* Fuera de .content: en /pantalla no le toca el zoom de la página. */}
      <AvisosAlarma />
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
