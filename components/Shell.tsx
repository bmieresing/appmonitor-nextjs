"use client";
// Cáscara profesional: barra superior con marca + navegación horizontal +
// indicador de última actualización, refresh, toggle de tema y logout. La
// navegación vive arriba (no en un sidebar) para no robar ancho al dashboard.
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import AppMonitorLogo from "@/assets/AppMonitorLogo.png";
import { SnapshotProvider, useSnap } from "./SnapshotContext";
import { CentroColoresProvider } from "./CentroColores";
import { useTheme } from "./ThemeProvider";
import { createClient } from "@/lib/supabase/client";

const VISTAS: [string, string, string][] = [
  ["Global", "/global", "🌐"],
  ["Santiago", "/santiago", "🏙️"],
  ["Regiones", "/regiones", "🗺️"],
  ["Recolecciones", "/recolecciones", "✅"],
  ["Rendimiento", "/rendimiento", "📊"],
  ["Carrusel", "/carrusel", "🎠"],
  ["Carrusel Zonas", "/carrusel-zonas", "🔄"],
  ["Regiones Feed", "/carrusel-regiones", "📱"],
  ["Parametros", "/parametros", "⚙️"],
];

function TopBar() {
  const pathname = usePathname();
  const { snap, error, loading, refetch } = useSnap();
  const { mode, toggle } = useTheme();
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

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
      <span className={`chip${hayFalla ? " warn" : ""}`} title={snap?.falla ?? error ?? undefined}>
        <span className="dot" /> {error && !snap ? "sin datos" : hora}
      </span>
      <button className={`icon-btn${loading ? " loading" : ""}`} onClick={refetch} disabled={loading} title="Forzar recálculo: trae datos frescos del Lambda (~30s)" aria-label="Forzar recálculo">
        <span className="spin">↺</span>
      </button>
      <button className="icon-btn" onClick={toggle} title="Cambiar tema" aria-label="Cambiar tema">{mode === "light" ? "🌙" : "☀️"}</button>
      <button className="icon-btn" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">⏻</button>
    </header>
  );
}

// Solo renderiza las vistas cuando hay datos reales. Sin datos muestra estado
// de carga o el error (no hay demo).
function Content({ children }: { children: React.ReactNode }) {
  const { snap, error, loading, refetch } = useSnap();
  if (snap) return <div className="content">{children}</div>;
  return (
    <div className="content">
      <div className="estado">
        {error ? (
          <>
            <div className="estado-ic">📭</div>
            <div className="estado-tit">No hay datos para mostrar</div>
            <p className="muted">{error}</p>
            <button className="icon-btn" style={{ width: "auto", padding: "0 14px", marginTop: 6 }} onClick={refetch}>
              {loading ? "Cargando…" : "Reintentar"}
            </button>
          </>
        ) : (
          <p className="muted">Cargando…</p>
        )}
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SnapshotProvider>
      <CentroColoresProvider>
        <div className="app">
          <TopBar />
          <Content>{children}</Content>
        </div>
      </CentroColoresProvider>
    </SnapshotProvider>
  );
}
