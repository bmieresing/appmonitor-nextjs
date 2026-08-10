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
import React, { useCallback, useMemo, useRef } from "react";
import MapaRecorrido from "./MapaRecorrido";
import ControlesReproduccion from "./ControlesReproduccion";
import { useReproduccion } from "./useReproduccion";
import { estiloRuta } from "./CentroColores";
import { useTheme } from "./ThemeProvider";
import { semaforo } from "@/lib/theme";
import { miles } from "@/lib/format";
import { hhmm, posicion, type FilaTiempo, type Ventana } from "@/lib/tiempo";

export default function ReproduccionRutas({
  filas,
  ventana,
  colorCentro,
}: {
  filas: FilaTiempo[];
  ventana: Ventana;
  colorCentro: (centro: string | null | undefined) => string | undefined;
}) {
  const { tokens: t } = useTheme();
  const trackRef = useRef<HTMLDivElement>(null);

  // La reproducción termina en la última visita registrada de todo el tramo, no en
  // el borde de la ventana: después de eso no pasa nada más y solo se ve el cursor
  // avanzando en vacío.
  const fin = useMemo(
    () => filas.reduce((m, f) => Math.max(m, f.ultima ?? -1), -1),
    [filas],
  );
  const inicio = useMemo(
    () => filas.reduce((m, f) => (f.primera !== null ? Math.min(m, f.primera) : m), ventana.hasta),
    [filas, ventana.hasta],
  );
  const totalVisitas = useMemo(() => filas.reduce((s, f) => s + f.eventos.length, 0), [filas]);
  // Precalculado: el componente se re-renderiza en cada tick y esto no depende del
  // reloj. Filtrarlo inline sería rehacer el filtro de cada ruta varias veces por
  // segundo, por cada panel de la grilla.
  const pendientesDe = useMemo(
    () => new Map(filas.map((f) => [f.ruta.id, f.ruta.puntos.filter((p) => !p.hora)] as const)),
    [filas],
  );

  // Arranca en la primera visita del tramo: esperar en vacío no aporta nada.
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
                <div className="mapa-panel-kpis">
                  <b className="tnum" style={{ color: arrancada ? semaforo(pct, t) : "var(--muted)" }}>{pct}%</b>
                  <span className="mapa-panel-det tnum">
                    {arrancada
                      ? `${miles(hechas.length)}/${miles(total)} · ${miles(litros)} L`
                      : f.primera !== null ? `arranca ${hhmm(f.primera)}` : "sin registrar"}
                  </span>
                </div>
              </div>
              <MapaRecorrido
                rutaId={f.ruta.id}
                eventos={f.eventos}
                pendientes={pendientesDe.get(f.ruta.id) ?? []}
                minuto={minuto}
                alto="100%"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
