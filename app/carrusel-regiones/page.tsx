"use client";
// Feed vertical de Regiones a pantalla completa: una sola columna con TODOS los
// choferes que se desplaza sola hacia abajo en loop. Reusa AutoScrollCards (el
// mismo componente que usa el Carrusel Zonas para Regiones).
import { useState } from "react";
import AutoScrollCards from "@/components/AutoScrollCards";
import FullscreenToggle from "@/components/FullscreenToggle";
import { useSnap } from "@/components/SnapshotContext";

export default function CarruselRegionesPage() {
  const { snap } = useSnap();
  const [pausado, setPausado] = useState(false);

  if (!snap) return <p className="muted">Cargando…</p>;
  const cards = snap.zonas.Regiones.cards;

  return (
    <>
      <div className="toolbar" style={{ justifyContent: "center" }}>
        <div className="section-title" style={{ margin: 0 }}>🗺️ Regiones · {cards.length} choferes</div>
        <button className={`icon-btn${pausado ? " active" : ""}`} onClick={() => setPausado((p) => !p)}
          title={pausado ? "Reanudar desplazamiento" : "Pausar desplazamiento"}
          aria-label={pausado ? "Reanudar" : "Pausar"}>{pausado ? "▶" : "⏸"}</button>
        <FullscreenToggle />
      </div>
      <AutoScrollCards cards={cards} pausado={pausado} />
    </>
  );
}
