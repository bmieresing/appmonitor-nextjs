"use client";
// Reproducción del día: la MISMA grilla de la vista Mapas —un panel por ruta— pero
// con un reloj común que la recorre. A medida que avanza, los locales de cada
// panel se van encendiendo en el orden en que la tripulación los registró, unidos
// por la línea del recorrido.
//
// Que sean todos los paneles a la vez y no una ruta seleccionada es el punto: así
// se ve la flota entera moviéndose junta, quién arrancó antes y quién quedó atrás
// a la misma hora. La unidad sigue siendo la ruta —cada panel con su zoom— porque
// un encuadre regional apila los locales en el mismo píxel.
import React, { useCallback, useMemo, useRef, useState } from "react";
import MapaRecorrido from "./MapaRecorrido";
import MapaModal, { BotonAgrandar } from "./MapaModal";
import TimelineRutas from "./TimelineRutas";
import ControlesReproduccion from "./ControlesReproduccion";
import { useReproduccion } from "./useReproduccion";
import { estiloRuta } from "./CentroColores";
import { useTheme } from "./ThemeProvider";
import { semaforo } from "@/lib/theme";
import { miles } from "@/lib/format";
import { hhmm, posicion, type FilaTiempo, type Ventana } from "@/lib/tiempo";
import { finTraza, inicioMovimiento, trazaDe } from "@/lib/gps";
import type { Gps } from "@/lib/types";

// Fuera del componente: un `{}` por defecto en los props sería un objeto nuevo en
// cada render y recalcularía el inicio en cada tick del reloj.
const SIN_GPS: Gps = {};

export default function ReproduccionRutas({
  filas,
  ventana,
  colorCentro,
  gps = SIN_GPS,
}: {
  filas: FilaTiempo[];
  ventana: Ventana;
  colorCentro: (centro: string | null | undefined) => string | undefined;
  /** GPS de los camiones, por patente: la ruta que lo tenga muestra su camino real. */
  gps?: Gps;
}) {
  const { tokens: t } = useTheme();
  const trackRef = useRef<HTMLDivElement>(null);
  // Ruta abierta en grande. El reloj sigue siendo el de la grilla: la ventana
  // muestra el mismo instante y lleva los mismos controles.
  const [ampliado, setAmpliado] = useState<string | null>(null);

  // La reproducción termina en lo último que pasó en el tramo —la última visita o
  // el último reporte GPS, lo que sea más tarde—, no en el borde de la ventana:
  // después no pasa nada más y solo se vería el cursor avanzando en vacío.
  const fin = useMemo(
    () => filas.reduce((m, f) => Math.max(m, f.ultima ?? -1, finTraza(trazaDe(gps, f.ruta.patente)?.puntos) ?? -1), -1),
    [filas, gps],
  );
  // Arranca cuando se mueve el primer camión: con GPS, su salida (lib/gps.ts); sin
  // GPS, la primera visita, que es lo único que se sabe de esa ruta. Lo que ocurra
  // antes cuenta, así que se toma el mínimo de las dos señales.
  const inicio = useMemo(
    () => filas.reduce((m, f) => {
      const salida = inicioMovimiento(trazaDe(gps, f.ruta.patente)?.puntos);
      const arranque = Math.min(f.primera ?? Infinity, salida ?? Infinity);
      return Number.isFinite(arranque) ? Math.min(m, arranque) : m;
    }, ventana.hasta),
    [filas, ventana.hasta, gps],
  );
  const totalVisitas = useMemo(() => filas.reduce((s, f) => s + f.eventos.length, 0), [filas]);
  // Precalculado: el componente se re-renderiza en cada tick y esto no depende del
  // reloj. Filtrarlo inline sería rehacer el filtro de cada ruta varias veces por
  // segundo, por cada panel de la grilla.
  const pendientesDe = useMemo(
    () => new Map(filas.map((f) => [f.ruta.id, f.ruta.puntos.filter((p) => !p.hora)] as const)),
    [filas],
  );

  // Arranca cuando se mueve el primer camión del tramo (ver `inicio`): esperar en
  // vacío no aporta nada.
  const rep = useReproduccion(inicio, fin);
  const { minuto, irA } = rep;

  // Click sobre la barra: saltar a esa hora.
  const saltar = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    irA(Math.round(ventana.desde + frac * (ventana.hasta - ventana.desde)));
  }, [ventana, irA]);

  if (totalVisitas === 0) {
    return <p className="muted">Ninguna ruta de este tramo tiene visitas registradas todavía.</p>;
  }

  const ocurridas = filas.reduce((s, f) => s + f.eventos.filter((e) => e.min <= minuto).length, 0);

  return (
    <div className="rep">
      <ControlesReproduccion rep={rep}>
        <span className="chip">
          <b className="tnum">{miles(ocurridas)}</b>&nbsp;de {miles(totalVisitas)} visitas
        </span>
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

      {/* Misma grilla que Mapas: un panel por ruta, con el mismo encabezado. La
          diferencia es que los KPI son del instante que se está reproduciendo. */}
      <div className="mapa-paneles">
        {filas.map((f) => {
          const hechas = f.eventos.filter((e) => e.min <= minuto);
          const litros = hechas.reduce((s, e) => s + (e.punto.litros || 0), 0);
          const total = f.ruta.puntos.length;
          const pct = total > 0 ? Math.round((hechas.length / total) * 100) : 0;
          const arrancada = f.primera !== null && f.primera <= minuto;
          return (
            <div key={f.ruta.id} className="card mapa-panel">
              <div className="mapa-panel-head">
                <div className="mapa-panel-id">
                  <div className="mapa-panel-tit" title={f.ruta.titulo}>{f.ruta.titulo}</div>
                  {f.ruta.subtitulo && (
                    <div className="mapa-panel-ruta" style={estiloRuta(colorCentro(f.ruta.centro))} title={f.ruta.centro}>
                      {f.ruta.subtitulo}
                    </div>
                  )}
                </div>
                <div className="mapa-panel-acciones">
                  <div className="mapa-panel-kpis">
                    <b className="tnum" style={{ color: arrancada ? semaforo(pct, t) : "var(--muted)" }}>{pct}%</b>
                    <span className="mapa-panel-det tnum">
                      {arrancada
                        ? `${miles(hechas.length)}/${miles(total)} · ${miles(litros)} L`
                        : f.primera !== null ? `arranca ${hhmm(f.primera)}` : "sin registrar"}
                    </span>
                  </div>
                  <BotonAgrandar onClick={() => setAmpliado(f.ruta.id)} />
                </div>
              </div>
              <MapaRecorrido
                rutaId={f.ruta.id}
                eventos={f.eventos}
                pendientes={pendientesDe.get(f.ruta.id) ?? []}
                minuto={minuto}
                alto="100%"
                traza={trazaDe(gps, f.ruta.patente)?.puntos}
              />
            </div>
          );
        })}
      </div>

      {(() => {
        const f = filas.find((x) => x.ruta.id === ampliado);
        if (!f) return null;
        const hechas = f.eventos.filter((e) => e.min <= minuto).length;
        return (
          <MapaModal
            titulo={f.ruta.titulo}
            subtitulo={f.ruta.subtitulo && (
              <div className="mapa-panel-ruta" style={estiloRuta(colorCentro(f.ruta.centro))}>{f.ruta.subtitulo}</div>
            )}
            onClose={() => setAmpliado(null)}
            pie={(
              <>
                <ControlesReproduccion rep={rep}>
                  <span className="chip">
                    <b className="tnum">{miles(hechas)}</b>&nbsp;de {miles(f.eventos.length)} visitas
                  </span>
                </ControlesReproduccion>
                {/* La línea de tiempo de esta ruta como barra del video: cursor del
                    reloj y click para saltar a una hora. Mismo eje que la grilla. */}
                <TimelineRutas filas={[f]} ventana={ventana} colorCentro={colorCentro} sinEtiqueta
                  cursor={minuto} onSaltar={irA} />
              </>
            )}
          >
            <MapaRecorrido
              rutaId={`modal|${f.ruta.id}`}
              eventos={f.eventos}
              pendientes={pendientesDe.get(f.ruta.id) ?? []}
              minuto={minuto}
              alto="100%"
              traza={trazaDe(gps, f.ruta.patente)?.puntos}
              scrollZoom
            />
          </MapaModal>
        );
      })()}
    </div>
  );
}
