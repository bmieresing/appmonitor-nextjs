"use client";
// Línea de tiempo de la vista Mapa: una fila por ruta, un punto por visita,
// ubicado en la hora en que la app del chofer la registró.
//
// El mapa responde DÓNDE está cada local; esto responde CUÁNDO se pasó por él —
// que es lo que permite ver de un vistazo quién arrancó tarde, quién viene
// encadenando locales y quién lleva una hora sin registrar nada.
//
// DOM y CSS, no canvas: el mismo criterio del resto del dashboard (ver
// app/rendimiento/page.tsx). Los puntos son pocos por fila y así los nombres y
// las horas quedan nítidos a cualquier zoom, con el tooltip `has-tip` que ya usan
// los tanques.
import React from "react";
import { estiloRuta } from "@/components/CentroColores";
import { useTheme } from "@/components/ThemeProvider";
import { estadoColor, semaforo } from "@/lib/theme";
import { miles } from "@/lib/format";
import { duracion, hhmm, posicion, GAP_MIN, type FilaTiempo, type Ventana } from "@/lib/tiempo";

export default function TimelineRutas({
  filas,
  ventana,
  colorCentro,
  sinEtiqueta = false,
  cursor = null,
  onSaltar,
}: {
  filas: FilaTiempo[];
  ventana: Ventana;
  colorCentro: (centro: string | null | undefined) => string | undefined;
  /** Oculta la columna con el nombre de la ruta y le da ese ancho al track. Lo usa
   *  el carrusel, donde el chofer ya está en el hero y repetirlo solo roba espacio. */
  sinEtiqueta?: boolean;
  /** Minuto del reloj de la reproducción. Con esto la línea de tiempo pasa de ser
   *  una lectura estática a la barra del video: marca dónde va y atenúa lo que
   *  todavía no ocurrió. */
  cursor?: number | null;
  /** Click sobre el track ⇒ saltar a esa hora. Solo con reproducción activa. */
  onSaltar?: (minuto: number) => void;
}) {
  const { tokens: t } = useTheme();

  const clickTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSaltar) return;
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onSaltar(Math.round(ventana.desde + frac * (ventana.hasta - ventana.desde)));
  };

  return (
    <div className={`card card-pad tl${sinEtiqueta ? " tl-solo" : ""}`}>
      {/* Eje de horas, arriba y compartido por todas las filas. Las guías verticales
          se repiten dentro de cada track para que un punto se pueda leer contra su
          hora sin recorrer la pantalla hasta el encabezado. */}
      <div className="tl-eje">
        {!sinEtiqueta && <div className="tl-eje-lbl" />}
        <div className="tl-eje-track">
          {ventana.horas.map((h) => (
            <span key={h} className="tl-eje-h tnum" style={{ left: `${posicion(h, ventana)}%` }}>
              {hhmm(h)}
            </span>
          ))}
        </div>
      </div>

      <div className="tl-filas">
        {filas.map((f) => {
          const { ruta } = f;
          const marcarGap = f.gapMax >= GAP_MIN && f.gapMaxDesde !== null;
          return (
            <div key={ruta.id} className="tl-fila">
              {!sinEtiqueta && (
                <div className="tl-lbl">
                  <div className="tl-lbl-tit" title={ruta.titulo}>{ruta.titulo}</div>
                  {ruta.subtitulo && (
                    <div className="tl-lbl-ruta" style={estiloRuta(colorCentro(ruta.centro))} title={ruta.centro}>
                      {ruta.subtitulo}
                    </div>
                  )}
                </div>
              )}

              <div className={`tl-track${onSaltar ? " tl-track-click" : ""}`} onClick={clickTrack}
                title={onSaltar ? "Click para saltar a esa hora" : undefined}>
                {ventana.horas.map((h) => (
                  <span key={h} className="tl-guia" style={{ left: `${posicion(h, ventana)}%` }} />
                ))}

                {/* Tramo recorrido: de la primera visita a la última. Da la lectura
                    inmediata de "a qué hora arrancó y hasta dónde llegó". */}
                {f.primera !== null && f.ultima !== null && f.ultima > f.primera && (
                  <span
                    className="tl-recorrido"
                    style={{
                      left: `${posicion(f.primera, ventana)}%`,
                      width: `${posicion(f.ultima, ventana) - posicion(f.primera, ventana)}%`,
                    }}
                  />
                )}

                {/* El hueco más largo, si pasa el umbral: es la anomalía que se
                    busca en esta vista (traslado largo, colación, o la app sin uso). */}
                {marcarGap && (
                  <span
                    className="tl-gap has-tip"
                    data-tip={`Sin registrar ${duracion(f.gapMax)}\n${hhmm(f.gapMaxDesde!)} → ${hhmm(f.gapMaxDesde! + f.gapMax)}`}
                    style={{
                      left: `${posicion(f.gapMaxDesde!, ventana)}%`,
                      width: `${posicion(f.gapMaxDesde! + f.gapMax, ventana) - posicion(f.gapMaxDesde!, ventana)}%`,
                    }}
                  />
                )}

                {f.eventos.map((ev, i) => (
                  <span
                    key={`${ev.punto.id_local}-${i}`}
                    className={`tl-pt has-tip${ev.punto.prioridad === "Alta" ? " alta" : ""}${ev.punto.emergencia ? " emerg" : ""}`}
                    style={{
                      left: `${posicion(ev.min, ventana)}%`,
                      background: estadoColor(ev.punto.estado, t),
                      // Con reproducción activa, lo que aún no ocurrió se atenúa.
                      opacity: cursor !== null && ev.min > cursor ? 0.26 : 1,
                    }}
                    data-tip={
                      `${hhmm(ev.min)} · ${ev.punto.local}\n`
                      + `${ev.punto.estado}${ev.punto.razon ? ` — ${ev.punto.razon}` : ""}\n`
                      + `${miles(ev.punto.litros)} L · prioridad ${ev.punto.prioridad}`
                      + (ev.punto.emergencia ? "\n⚠ Emergencia" : "")
                      + (ev.gapPrevio > 0 ? `\n${duracion(ev.gapPrevio)} desde la anterior` : "")
                    }
                  />
                ))}

                {cursor !== null && (
                  <span className="rep-cursor" style={{ left: `${posicion(cursor, ventana)}%` }} />
                )}
              </div>

              <div className="tl-kpis">
                <b className="tnum" style={{ color: semaforo(ruta.pct, t) }}>{ruta.pct}%</b>
                <span className="tl-kpis-det tnum">
                  {f.primera !== null ? `${hhmm(f.primera)}–${hhmm(f.ultima!)}` : "sin registrar"}
                  {f.sinHora > 0 && ` · faltan ${miles(f.sinHora)}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tl-pie">
        <span className="tl-pie-item">
          <span className="tl-gap-muestra" /> hueco de {GAP_MIN} min o más sin registrar
        </span>
        <span className="tl-pie-item">
          <span className="tl-pt alta" style={{ background: t.textSecondary }} /> prioridad Alta
        </span>
        <span className="tl-pie-item">
          <span className="tl-pt emerg" style={{ background: t.textSecondary }} /> emergencia
        </span>
        <span className="tl-pie-nota">
          La hora es la del registro en la app del chofer, no la de llegada al local.
        </span>
      </div>
    </div>
  );
}
