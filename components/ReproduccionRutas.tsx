"use client";
// Grilla de la vista Mapa: un panel por ruta (MapaPanel), cada uno con su mapa del
// día y su propio ▶ para reproducir el recorrido de esa ruta.
//
// Encima, "Reproducir todo el tramo": un reloj común que mueve TODOS los paneles a
// la vez. Que sean todos juntos es el punto de ese modo: se ve la flota entera
// moviéndose, quién arrancó antes y quién quedó atrás a la misma hora. La unidad
// sigue siendo la ruta —cada panel con su zoom— porque un encuadre regional apila
// los locales en el mismo píxel.
import React, { useCallback, useMemo, useRef, useState } from "react";
import MapaPanel, { jornadaDe } from "./MapaPanel";
import ControlesReproduccion from "./ControlesReproduccion";
import { useReproduccion } from "./useReproduccion";
import { miles } from "@/lib/format";
import { hhmm, posicion, type FilaTiempo, type Ventana } from "@/lib/tiempo";
import { trazaDe } from "@/lib/gps";
import type { Panel } from "@/lib/mapa";
import type { Gps } from "@/lib/types";

export default function ReproduccionRutas({ filas, ventana, colorCentro, gps, fitKey }: {
  filas: FilaTiempo<Panel>[];
  ventana: Ventana;
  colorCentro: (centro: string | null | undefined) => string | undefined;
  /** GPS de los camiones, por patente: la ruta que lo tenga muestra su camino real. */
  gps: Gps;
  /** Cambia ⇒ los mapas estáticos se reencuadran. */
  fitKey: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [tramo, setTramo] = useState(false);

  // El tramo se reproduce de lo primero a lo último que pasó en cualquiera de sus
  // rutas: la salida del primer camión (o la primera visita) y el último reporte o
  // visita. Antes y después no pasa nada y solo se vería el cursor en vacío.
  // Un camión que no salió ni tiene visitas (quieto) no adelanta el inicio: su
  // jornada parte en su primer reporte, de madrugada en el patio, y arrastraría el
  // tramo entero a las 00:00. Solo cuenta si ninguna ruta del tramo se movió.
  const { inicio, fin } = useMemo(() => {
    let ini = Infinity, iniQuieto = Infinity, f = -1;
    for (const fila of filas) {
      const j = jornadaDe(fila, trazaDe(gps, fila.ruta.patente));
      if (!j) continue;
      if (j.quieto) iniQuieto = Math.min(iniQuieto, j.inicio);
      else ini = Math.min(ini, j.inicio);
      f = Math.max(f, j.fin);
    }
    if (!Number.isFinite(ini)) ini = iniQuieto;
    return { inicio: Number.isFinite(ini) ? ini : ventana.hasta, fin: f };
  }, [filas, gps, ventana.hasta]);
  const totalVisitas = useMemo(() => filas.reduce((s, f) => s + f.eventos.length, 0), [filas]);

  const rep = useReproduccion(inicio, fin, tramo);
  const { minuto, irA } = rep;

  // Click sobre la barra: saltar a esa hora.
  const saltar = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    irA(Math.round(ventana.desde + frac * (ventana.hasta - ventana.desde)));
  }, [ventana, irA]);

  const ocurridas = tramo ? filas.reduce((s, f) => s + f.eventos.filter((e) => e.min <= minuto).length, 0) : 0;

  return (
    <div className="rep">
      {tramo ? (
        <>
          <ControlesReproduccion rep={rep}>
            <span className="chip">
              <b className="tnum">{miles(ocurridas)}</b>&nbsp;de {miles(totalVisitas)} visitas
            </span>
            <button className="icon-btn" style={{ width: "auto", padding: "0 12px" }} onClick={() => setTramo(false)}
              title="Dejar de reproducir: cada mapa vuelve a mostrar el día completo">
              ⏹ Volver a los mapas
            </button>
          </ControlesReproduccion>

          {/* Barra de tiempo del tramo. Clickeable: saltar a una hora es parte de
              reproducir, y es lo que se usa para volver a mirar un momento puntual. */}
          <div className="rep-tiempo">
            <div className="rep-track" ref={trackRef} onClick={saltar} title="Click para saltar a esa hora">
              {ventana.horas.map((h) => (
                <span key={h} className="tl-guia" style={{ left: `${posicion(h, ventana)}%` }} />
              ))}
              {fin > inicio && (
                <span className="tl-recorrido" style={{
                  left: `${posicion(inicio, ventana)}%`,
                  width: `${posicion(fin, ventana) - posicion(inicio, ventana)}%`,
                }} />
              )}
              <span className="rep-avance" style={{
                left: `${posicion(inicio, ventana)}%`,
                width: `${Math.max(0, posicion(Math.min(minuto, fin), ventana) - posicion(inicio, ventana))}%`,
              }} />
              <span className="rep-cursor" style={{ left: `${posicion(minuto, ventana)}%` }} />
            </div>
            <div className="rep-eje">
              {ventana.horas.map((h) => (
                <span key={h} className="tl-eje-h tnum" style={{ left: `${posicion(h, ventana)}%` }}>{hhmm(h)}</span>
              ))}
            </div>
          </div>
        </>
      ) : fin >= 0 && (
        <div className="rep-barra">
          <button className="icon-btn" style={{ width: "auto", padding: "0 14px", fontWeight: 700 }} onClick={() => setTramo(true)}
            title="Todas las rutas del tramo a la vez, con un reloj común">
            ▶ Reproducir todo el tramo
          </button>
          <span className="muted" style={{ fontSize: 12.5 }}>o el ▶ de cada mapa para ver solo esa ruta</span>
        </div>
      )}

      <div className="mapa-paneles">
        {filas.map((f) => (
          <MapaPanel key={f.ruta.id} fila={f} traza={trazaDe(gps, f.ruta.patente)} ventana={ventana}
            colorCentro={colorCentro} fitKey={fitKey} repTramo={tramo ? rep : null} />
        ))}
      </div>
    </div>
  );
}
