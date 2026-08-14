"use client";
// Carrusel Zonas: cicla Global → Santiago → Regiones. Regiones no va como una lista
// que se desplaza sola sino partido en Norte / Sur (ver RegionesMitades).
//
// Cada mitad de Regiones dura lo mismo que Global o Santiago, así que Regiones se
// queda el doble: una mitad por turno y recién ahí avanza el ciclo. Los dos relojes
// arrancan juntos —el componente se monta al entrar a la zona— y por eso el cambio
// de zona cae justo cuando se terminó de mostrar la segunda mitad.
import { useEffect, useState } from "react";
import ZoneView from "@/components/ZoneView";
import RegionesMitades from "@/components/RegionesMitades";
import { MITADES } from "@/lib/mitades";
import FullscreenToggle from "@/components/FullscreenToggle";
import { useSnap } from "@/components/SnapshotContext";
import type { ZonaNombre } from "@/lib/types";

const ZONAS: ZonaNombre[] = ["Global", "Santiago", "Regiones"];
const ICONO: Record<ZonaNombre, string> = { Global: "🌐", Santiago: "🏙️", Regiones: "🗺️" };
const INTERVALO_MS = 20_000;

export default function CarruselZonasPage() {
  const { snap } = useSnap();
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const zona = ZONAS[idx];

  useEffect(() => {
    if (!auto) return;
    const ms = zona === "Regiones" ? INTERVALO_MS * MITADES.length : INTERVALO_MS;
    const id = setTimeout(() => setIdx((i) => (i + 1) % ZONAS.length), ms);
    return () => clearTimeout(id);
  }, [auto, idx, zona]);

  if (!snap) return <p className="muted">Cargando…</p>;

  return (
    <>
      <div className="toolbar" style={{ justifyContent: "center" }}>
        <button className="icon-btn" onClick={() => setIdx((i) => (i - 1 + ZONAS.length) % ZONAS.length)}>◀</button>
        <div style={{ display: "flex", gap: 6 }}>
          {ZONAS.map((z, i) => (
            <button key={z} className={`chip-btn${i === idx ? " active" : ""}`} onClick={() => setIdx(i)}>{ICONO[z]} {z}</button>
          ))}
        </div>
        <button className="icon-btn" onClick={() => setIdx((i) => (i + 1) % ZONAS.length)}>▶</button>
        <label className="sw"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto</label>
        <FullscreenToggle />
      </div>
      {zona === "Regiones"
        ? <RegionesMitades zona={snap.zonas.Regiones} mitadMs={INTERVALO_MS} pausado={!auto} />
        : <ZoneView zona={snap.zonas[zona]} esGlobal={zona === "Global"} />}
    </>
  );
}
