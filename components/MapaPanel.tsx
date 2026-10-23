"use client";
// Un panel de la grilla de la vista Mapa: la ruta de un chofer, en dos estados.
//
//   · Estático   — todos sus locales a la vez, con el recorrido GPS del día y el
//                  camión en su último reporte (MapaLocales).
//   · Recorrido  — la ruta como video (MapaRecorrido): los locales se encienden en
//                  el orden en que se registraron y el camión avanza con el reloj.
//
// El reloj puede ser PROPIO (el ▶ del encabezado: solo esta ruta, desde que sale
// su camión hasta su último reporte) o el del TRAMO (ReproduccionRutas: todas las
// rutas a la vez, sincronizadas). Mientras corre el del tramo, el panel lo sigue y
// sus controles propios se esconden.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapaLocales from "./MapaLocales";
import MapaRecorrido from "./MapaRecorrido";
import MapaModal, { BotonAgrandar } from "./MapaModal";
import TimelineRutas from "./TimelineRutas";
import ControlesReproduccion from "./ControlesReproduccion";
import { useReproduccion, type Reproduccion } from "./useReproduccion";
import { estiloRuta } from "./CentroColores";
import { useTheme } from "./ThemeProvider";
import { estadoColor, semaforo } from "@/lib/theme";
import { miles } from "@/lib/format";
import { hhmm, type FilaTiempo, type Ventana } from "@/lib/tiempo";
import { tieneCoords, type Panel, type PuntoMapa } from "@/lib/mapa";
import { finTraza, inicioMovimiento } from "@/lib/gps";
import type { TrazaGps } from "@/lib/types";

/** Desde dónde hasta dónde se reproduce una ruta: de la salida de su camión (o su
 *  primera visita, lo que pase antes) a lo último que pasó — su última visita o
 *  su último reporte GPS. null si no hay nada que reproducir. */
export function jornadaDe(fila: FilaTiempo, traza: TrazaGps | null): { inicio: number; fin: number } | null {
  const salida = inicioMovimiento(traza?.puntos);
  const inicio = Math.min(fila.primera ?? Infinity, salida ?? Infinity);
  const fin = Math.max(fila.ultima ?? -1, finTraza(traza?.puntos) ?? -1);
  return Number.isFinite(inicio) && fin >= 0 ? { inicio, fin } : null;
}

export default function MapaPanel({ fila, traza, ventana, colorCentro, fitKey, repTramo }: {
  fila: FilaTiempo<Panel>;
  traza: TrazaGps | null;
  /** Eje común del tramo: el de la línea de tiempo en la ventana grande. */
  ventana: Ventana;
  colorCentro: (centro: string | null | undefined) => string | undefined;
  /** Cambia ⇒ el mapa estático se reencuadra (filtros, tab, botón Reencuadrar). */
  fitKey: string;
  /** Reloj del tramo cuando está reproduciéndose todo junto; null si no. */
  repTramo: Reproduccion | null;
}) {
  const { tokens: t } = useTheme();
  const ruta = fila.ruta;
  const [propio, setPropio] = useState(false);
  const [grande, setGrande] = useState(false);

  const jornada = useMemo(() => jornadaDe(fila, traza), [fila, traza]);
  const repPropio = useReproduccion(jornada?.inicio ?? 0, jornada?.fin ?? -1, propio && !repTramo);

  // Al arrancar el reloj del tramo, cada panel suelta el suyo: al terminar vuelven
  // todos a estático, no a una reproducción propia que nadie pidió de nuevo.
  const enTramo = !!repTramo;
  useEffect(() => { if (enTramo) setPropio(false); }, [enTramo]);

  const rep = repTramo ?? (propio ? repPropio : null);
  const minuto = rep ? rep.minuto : null;   // null = estático

  const pintar = useMemo(() => (p: PuntoMapa) => estadoColor(p.estado, t), [t]);
  const conCoords = useMemo(() => ruta.puntos.filter(tieneCoords), [ruta.puntos]);
  const pendientes = useMemo(() => ruta.puntos.filter((p) => !p.hora), [ruta.puntos]);
  const filas = useMemo(() => [fila], [fila]);

  // KPI del encabezado: los del día en estático; en recorrido, los del instante.
  const hechas = minuto === null ? null : fila.eventos.filter((e) => e.min <= minuto);
  const arrancada = minuto === null || (fila.primera !== null && fila.primera <= minuto);
  const total = ruta.puntos.length;
  const pct = hechas ? (total > 0 ? Math.round((hechas.length / total) * 100) : 0) : ruta.pct;
  const detalle = hechas
    ? arrancada
      ? `${miles(hechas.length)}/${miles(total)} · ${miles(hechas.reduce((s, e) => s + (e.punto.litros || 0), 0))} L`
      : fila.primera !== null ? `arranca ${hhmm(fila.primera)}` : "sin registrar"
    : `${miles(ruta.realizados)}/${miles(total)} · ${miles(ruta.litros)} L`;

  const mapa = (enModal: boolean) => minuto === null
    ? <MapaLocales puntos={conCoords} colorDe={pintar} alto="100%" traza={traza} patente={ruta.patente}
        fitKey={enModal ? `modal|${ruta.id}` : `${ruta.id}|${fitKey}`} scrollZoom={enModal} />
    : <MapaRecorrido rutaId={enModal ? `modal|${ruta.id}` : ruta.id} eventos={fila.eventos} pendientes={pendientes}
        minuto={minuto} alto="100%" traza={traza?.puntos} patente={ruta.patente} scrollZoom={enModal} />;

  // Play propio: solo si hay algo que reproducir y no corre el del tramo. Va en el
  // encabezado del panel y en el de la ventana grande.
  const botonPlay = jornada && !repTramo && (
    <button className={`icon-btn mapa-agrandar${propio ? " active" : ""}`}
      onClick={() => setPropio((v) => !v)}
      title={propio ? "Volver al mapa del día" : "Reproducir el recorrido de esta ruta"}
      aria-label={propio ? "Volver al mapa del día" : "Reproducir el recorrido"}>
      {propio ? "⏹" : "▶"}
    </button>
  );

  const conteo = rep && (
    <span className="chip">
      <b className="tnum">{miles(fila.eventos.filter((e) => e.min <= rep.minuto).length)}</b>&nbsp;de {miles(fila.eventos.length)} visitas
    </span>
  );

  return (
    <div className={`card mapa-panel${propio && !repTramo ? " mapa-panel-play" : ""}`}>
      <div className="mapa-panel-head">
        <div className="mapa-panel-id">
          <div className="mapa-panel-tit" title={ruta.titulo}>{ruta.titulo}</div>
          {ruta.subtitulo && (
            <div className="mapa-panel-ruta" style={estiloRuta(colorCentro(ruta.centro))} title={ruta.centro}>
              {ruta.subtitulo}
            </div>
          )}
        </div>
        <div className="mapa-panel-acciones">
          <div className="mapa-panel-kpis">
            <b className="tnum" style={{ color: arrancada ? semaforo(pct, t) : "var(--muted)" }}>{pct}%</b>
            <span className="mapa-panel-det tnum">{detalle}</span>
          </div>
          {botonPlay}
          <BotonAgrandar onClick={() => setGrande(true)} />
        </div>
      </div>

      {mapa(false)}

      {propio && !repTramo && jornada && (
        <div className="mapa-panel-rep">
          <ControlesReproduccion rep={repPropio} compacto />
          <BarraJornada rep={repPropio} inicio={jornada.inicio} fin={jornada.fin} />
        </div>
      )}

      {/* En grande, en el estado en que esté el panel y con el mismo reloj. */}
      {grande && (
        <MapaModal
          titulo={ruta.titulo}
          subtitulo={ruta.subtitulo && (
            <div className="mapa-panel-ruta" style={estiloRuta(colorCentro(ruta.centro))}>{ruta.subtitulo}</div>
          )}
          onClose={() => setGrande(false)}
          acciones={botonPlay}
          pie={rep ? (
            <>
              <ControlesReproduccion rep={rep}>{conteo}</ControlesReproduccion>
              {/* La línea de tiempo de esta ruta como barra del video. */}
              <TimelineRutas filas={filas} ventana={ventana} colorCentro={colorCentro} sinEtiqueta
                cursor={rep.minuto} onSaltar={rep.irA} />
            </>
          ) : undefined}
        >
          {mapa(true)}
        </MapaModal>
      )}
    </div>
  );
}

// Barra de tiempo de UNA ruta, de su salida a su último reporte: avance, cursor y
// click para saltar. Es la versión chica de la del tramo (mismas clases). La usa
// también el Carrusel cuando la ruta todavía no tiene visitas con las que armar su
// línea de tiempo, pero el camión ya salió.
export function BarraJornada({ rep, inicio, fin }: { rep: Reproduccion; inicio: number; fin: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const ancho = Math.max(1, fin - inicio);
  const pos = (m: number) => Math.max(0, Math.min(100, ((m - inicio) / ancho) * 100));
  const { irA } = rep;
  const saltar = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    irA(Math.round(inicio + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * ancho));
  }, [irA, inicio, ancho]);
  return (
    <div className="mapa-panel-barra">
      <span className="tnum">{hhmm(inicio)}</span>
      <div className="rep-track" ref={ref} onClick={saltar} title="Click para saltar a esa hora">
        <span className="tl-recorrido" style={{ left: 0, width: "100%" }} />
        <span className="rep-avance" style={{ left: 0, width: `${pos(rep.minuto)}%` }} />
        <span className="rep-cursor" style={{ left: `${pos(rep.minuto)}%` }} />
      </div>
      <span className="tnum">{hhmm(fin)}</span>
    </div>
  );
}
