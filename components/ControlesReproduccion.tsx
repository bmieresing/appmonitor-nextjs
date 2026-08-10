"use client";
// Transporte de la reproducción: play/pausa, volver al inicio, velocidad y reloj.
// Lo comparten la vista Mapa (barra propia, sobre la grilla de rutas) y el
// carrusel (versión compacta, en el encabezado de la card del mapa).
import React from "react";
import { hhmm } from "@/lib/tiempo";
import { VELOCIDADES, type Reproduccion } from "./useReproduccion";

export default function ControlesReproduccion({
  rep,
  compacto = false,
  children,
}: {
  rep: Reproduccion;
  /** Versión chica, para el encabezado de una card. */
  compacto?: boolean;
  /** Contenido extra entre los botones y el reloj (ej. el contador de visitas). */
  children?: React.ReactNode;
}) {
  return (
    <div className={`rep-barra${compacto ? " rep-barra-mini" : ""}`}>
      <button className="icon-btn" onClick={rep.alternar}
        title={rep.playing ? "Pausar" : rep.terminado ? "Volver a reproducir" : "Reproducir"}>
        {rep.playing ? "⏸" : rep.terminado ? "↻" : "▶"}
      </button>
      <button className="icon-btn" onClick={rep.reiniciar} title="Volver al inicio">⏮</button>

      <div className="rep-vel">
        {VELOCIDADES.map((v) => (
          <button key={v.x} className={`rep-vel-btn${rep.vel === v.x ? " active" : ""}`}
            onClick={() => rep.setVel(v.x)}>{v.label}</button>
        ))}
      </div>

      {children}

      <div className="rep-reloj tnum">{hhmm(rep.minuto)}</div>
    </div>
  );
}
