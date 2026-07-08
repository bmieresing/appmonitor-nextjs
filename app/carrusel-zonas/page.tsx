"use client";
// Carrusel Zonas: cicla Global → Santiago → Regiones cada 20 s.
import { useEffect, useState } from "react";
import ZoneView from "@/components/ZoneView";
import { duracionScrollMs } from "@/components/AutoScrollCards";
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
  const nReg = snap?.zonas.Regiones.cards.length ?? 0;

  // Regiones se muestra como feed auto-desplazable: se queda el tiempo de una
  // pasada completa (para verlos a todos) antes de avanzar; el resto, 20 s fijos.
  // Depende solo de nReg (no del objeto snap) para que un refresh no reinicie el ciclo.
  useEffect(() => {
    if (!auto) return;
    const ms = zona === "Regiones" ? duracionScrollMs(nReg) : INTERVALO_MS;
    const id = setTimeout(() => setIdx((i) => (i + 1) % ZONAS.length), ms);
    return () => clearTimeout(id);
  }, [auto, idx, zona, nReg]);

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
      <ZoneView zona={snap.zonas[zona]} esGlobal={zona === "Global"} scrollCards={zona === "Regiones"} />
    </>
  );
}
