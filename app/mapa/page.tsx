"use client";
// Vista Mapa: la ruta del día de cada chofer, en dos lecturas.
//
// El resto del dashboard responde CUÁNTO falta; esta responde DÓNDE y CUÁNDO:
//   · Mapas           — un mapa por ruta, con sus locales pintados por estado. Cada
//                       mapa tiene su ▶ para reproducir el recorrido de esa ruta, y
//                       "Reproducir todo el tramo" los mueve todos con un reloj común.
//   · Línea de tiempo — una fila por ruta, un punto por visita en su hora.
//
// La unidad es la ruta, no el territorio. Un mapa regional (o nacional) apila
// cientos de locales en el mismo píxel y termina siendo una mancha; la ruta de un
// chofer entra completa en un panel chico, con el zoom justo y los puntos
// separados. Y es la unidad con la que se opera: cada panel es el trabajo de una
// persona, con su propio avance. Los dos modos comparten filtros y tabs.
//
// Todo sale del detalle por local que ya trae el snapshot (lib/mapa.ts): no viajan
// datos nuevos más allá de las coordenadas y la hora de cada visita.
import React, { useEffect, useMemo, useState } from "react";
import { AlarmaLeyenda, PinLeyenda } from "@/components/MapaLocales";
import FullscreenToggle from "@/components/FullscreenToggle";
import TimelineRutas from "@/components/TimelineRutas";
import ReproduccionRutas from "@/components/ReproduccionRutas";
import { useSnap } from "@/components/SnapshotContext";
import { useGps } from "@/components/useGps";
import { jornadaDe } from "@/components/MapaPanel";
import { normalizarPatente, trazaDe } from "@/lib/gps";
import { useCentroColores } from "@/components/CentroColores";
import { useTheme } from "@/components/ThemeProvider";
import {
  puntosDeSnapshot, panelesPorChofer, panelesSoloGps, tieneCoords, tramosPorCentro, TRAMOS,
  type PuntoMapa, type Tramo,
} from "@/lib/mapa";
import { filasTiempo, ventanaDe, aMinutos, sinSoporteHora } from "@/lib/tiempo";
import { estadoColor, semaforo, ESTADOS } from "@/lib/theme";
import { miles } from "@/lib/format";

const FALTA = "__falta__";           // opción "todo lo que no está realizado"

type Modo = "mapas" | "tiempo";

const MODOS: { id: Modo; label: string; icono: string; title: string }[] = [
  { id: "mapas", label: "Mapas", icono: "🗺️", title: "Un mapa por ruta; ▶ reproduce su recorrido" },
  { id: "tiempo", label: "Línea de tiempo", icono: "⏱️", title: "Cuándo se registró cada visita, ruta por ruta" },
];

export default function MapaPage() {
  const { snap } = useSnap();
  // GPS de los camiones: llega aparte del snapshot, con su propio poll de 60 s.
  // Las rutas cuyo camión no tiene GPS se ven igual que siempre.
  const gps = useGps();
  const { tokens: t } = useTheme();
  const { centroDe, colorDe: colorCentro, zonaMap } = useCentroColores();

  const [modo, setModo] = useState<Modo>("mapas");
  const [tab, setTab] = useState<Tramo>("Santiago");
  const [estado, setEstado] = useState("");
  const [soloAlta, setSoloAlta] = useState(false);
  const [soloEmerg, setSoloEmerg] = useState(false);
  const [verSinUbic, setVerSinUbic] = useState(false);

  const datos = useMemo(() => puntosDeSnapshot(snap), [snap]);
  const ordenCentro = useMemo(() => new Map(zonaMap.map((m) => [m.centro, m.orden] as const)), [zonaMap]);
  const tramos = useMemo(() => tramosPorCentro(zonaMap), [zonaMap]);

  // Los tabs ya reparten por tramo y cada panel es una ruta: filtrar además por
  // centro no agregaba nada que no se viera de un vistazo.
  const pasa = useMemo(() => (p: PuntoMapa) => {
    if (estado === FALTA ? p.estado === "Realizado" : estado && p.estado !== estado) return false;
    if (soloAlta && p.prioridad !== "Alta") return false;
    if (soloEmerg && !p.emergencia) return false;
    return true;
  }, [estado, soloAlta, soloEmerg]);

  const sinUbicVisibles = useMemo(() => datos.sinUbicacion.filter(pasa), [datos.sinUbicacion, pasa]);

  // Paneles: agrupados por chofer SIN exigir coordenadas. Un local sin geocodificar
  // igual tiene hora de visita y cuenta en el avance de la ruta; dejarlo afuera
  // falsearía el ritmo (lo que miden la reproducción y la línea de tiempo). El mapa
  // de cada panel dibuja solo los que tienen coordenadas.
  const visiblesTodos = useMemo(() => datos.todos.filter(pasa), [datos.todos, pasa]);
  const panelesTiempoTodos = useMemo(
    () => panelesPorChofer(visiblesTodos, centroDe, ordenCentro, tramos),
    [visiblesTodos, centroDe, ordenCentro, tramos],
  );
  const filas = useMemo(
    () => filasTiempo(panelesTiempoTodos.filter((p) => p.tramo === tab)),
    [panelesTiempoTodos, tab],
  );
  // Camiones con GPS que no son de ninguna ruta del día (un domingo, todos): un
  // panel con su recorrido y sin locales. Solo sin filtros, que son todos de locales.
  const sinFiltro = !estado && !soloAlta && !soloEmerg;
  const panelesGps = useMemo(() => {
    if (!sinFiltro) return [];
    const conRuta = new Set(datos.todos.map((p) => normalizarPatente(p.patente)).filter(Boolean));
    return panelesSoloGps(gps, conRuta);
  }, [sinFiltro, datos.todos, gps]);
  // En Mapas entra la ruta que tenga algo que dibujar: un local ubicado o el GPS de
  // su camión. Las que no, quedan en el chip "sin ubicación". La línea de tiempo
  // sigue siendo solo de rutas: un camión sin locales no tiene visitas que ubicar.
  const filasMapa = useMemo(
    () => filas.filter((f) => f.ruta.puntos.some(tieneCoords) || trazaDe(gps, f.ruta.patente))
      .concat(filasTiempo(panelesGps.filter((p) => p.tramo === tab))),
    [filas, gps, panelesGps, tab],
  );
  // La ventana horaria sale de TODOS los tramos, no solo del visible: así el eje no
  // se mueve al cambiar de tab y las horas se comparan entre tramos.
  // Entra también la jornada de cada camión con GPS (de su salida, o su primer
  // reporte si no salió, a su último reporte): la reproducción arranca y termina
  // ahí, y el cursor tiene que caer dentro del eje.
  const ventana = useMemo(() => {
    const mins = visiblesTodos.map((p) => aMinutos(p.hora)).filter((m): m is number => m !== null);
    for (const f of filasTiempo([...panelesTiempoTodos, ...panelesGps])) {
      const j = jornadaDe(f, trazaDe(gps, f.ruta.patente));
      if (j) mins.push(j.inicio, j.fin);
    }
    return ventanaDe(mins);
  }, [visiblesTodos, panelesTiempoTodos, panelesGps, gps]);

  const sinHoras = useMemo(() => sinSoporteHora(datos.todos), [datos.todos]);

  // Encuadre: cada cambio de filtro o de tab acerca a lo que quedó visible.
  const filtroKey = `${tab}|${estado}|${soloAlta}|${soloEmerg}`;
  const [fit, setFit] = useState("init");
  useEffect(() => { setFit(filtroKey); }, [filtroKey]);

  if (!snap) return <p className="muted">Cargando…</p>;
  if (datos.total === 0 && panelesGps.length === 0) {
    return <p className="muted">Sin locales asignados ni recorridos GPS para este día.</p>;
  }
  // Snapshot de un publisher viejo: le falta el campo que alimenta el modo activo.
  // Se avisa por modo, no para toda la página — un snapshot puede tener coordenadas
  // y no horas (el caso del despliegue intermedio).
  const faltaCampo = modo === "mapas" ? datos.sinSoporte : sinHoras;
  const avisoCampo = modo === "mapas"
    ? { ic: "🗺️", tit: "El snapshot todavía no trae coordenadas" }
    : { ic: "⏱️", tit: "El snapshot todavía no trae la hora de las visitas" };

  return (
    <div className="mapa-page">
      <div className="toolbar mapa-toolbar">
        {/* Modo de lectura. Los filtros y los tabs de tramo son los mismos en los
            dos: se cambia cómo se mira lo filtrado, no qué se filtra. */}
        <div className="modo-sw">
          {MODOS.map((m) => (
            <button key={m.id} className={`modo-btn${modo === m.id ? " active" : ""}`}
              onClick={() => setModo(m.id)} title={m.title}>
              <span className="modo-ic">{m.icono}</span> {m.label}
            </button>
          ))}
        </div>

        <select className="col-filtro" value={estado} onChange={(e) => setEstado(e.target.value)} title="Estado del local">
          <option value="">Todos los estados</option>
          <option value={FALTA}>Lo que falta (no realizado)</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        <label className="sw"><input type="checkbox" checked={soloAlta} onChange={(e) => setSoloAlta(e.target.checked)} /> Solo prioridad Alta</label>
        <label className="sw"><input type="checkbox" checked={soloEmerg} onChange={(e) => setSoloEmerg(e.target.checked)} /> Solo emergencias</label>

        {modo === "mapas" && (
          <button className="icon-btn" style={{ width: "auto", padding: "0 12px" }}
            onClick={() => setFit(`fit-${Date.now()}`)} title="Volver a encuadrar los mapas">
            ⤢ Reencuadrar
          </button>
        )}
        <FullscreenToggle />
      </div>

      {/* Tabs por tramo del país: la partición sale del `orden` de monitor_zona_map
          (norte→sur), tomando Logística Santiago como eje. */}
      <div className="mapa-tabs">
        {TRAMOS.map((tr) => {
          const ps = panelesTiempoTodos.filter((p) => p.tramo === tr.id);
          const locales = ps.reduce((s, p) => s + p.puntos.length, 0);
          const hechos = ps.reduce((s, p) => s + p.realizados, 0);
          const pct = locales > 0 ? Math.round((hechos / locales) * 100) : 0;
          const soloGps = panelesGps.filter((p) => p.tramo === tr.id).length;
          return (
            <button key={tr.id} className={`mapa-tab${tab === tr.id ? " active" : ""}`} onClick={() => setTab(tr.id)}>
              <span className="mapa-tab-tit">{tr.titulo}</span>
              <span className="mapa-tab-sub">
                {ps.length} {ps.length === 1 ? "ruta" : "rutas"}
                {soloGps > 0 && <> + {soloGps} 🚚 solo GPS</>} · {tr.detalle}
              </span>
              <span className="mapa-tab-kpi">
                <b className="tnum" style={{ color: locales ? semaforo(pct, t) : "var(--muted)" }}>{pct}%</b>
                <span className="tnum">{miles(hechos)}/{miles(locales)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mapa-resumen">
        <span className="chip">
          <b className="tnum">{miles(modo === "mapas" ? filasMapa.length : filas.length)}</b>
          &nbsp;rutas en {tab}
        </span>
        {modo === "mapas" && sinUbicVisibles.length > 0 && (
          <button className={`chip warn chip-accion${verSinUbic ? " active" : ""}`} onClick={() => setVerSinUbic((v) => !v)}
            title="Locales de la ruta sin latitud/longitud: no se pueden dibujar">
            📍 {miles(sinUbicVisibles.length)} sin ubicación {verSinUbic ? "▲" : "▼"}
          </button>
        )}
        {/* Una sola leyenda para los dos modos: el color siempre dice el estado,
            sea un pin del mapa, un punto de la línea de tiempo o del recorrido. */}
        <div className="mapa-leyenda">
          {ESTADOS.map((e) => (
            <span key={e} className="donut-leg-item">
              <PinLeyenda color={estadoColor(e, t)} />
              <span className="donut-leg-name">{e}</span>
            </span>
          ))}
          {/* El color dice solo el estado (o el centro); la prioridad va como
              símbolo DENTRO del pin, para no sumar una segunda escala de color. */}
          <span className="mapa-leyenda-sep" />
          <span className="donut-leg-item">
            <PinLeyenda color={t.textSecondary} simbolo="★" />
            <span className="donut-leg-name">Prioridad Alta</span>
          </span>
          <span className="donut-leg-item">
            <PinLeyenda color={t.textSecondary} simbolo="!" />
            <span className="donut-leg-name">Emergencia</span>
          </span>
          {/* Alarmas de las reglas de Pegasus (geocercas): dónde estaba el camión */}
          <span className="mapa-leyenda-sep" />
          <span className="donut-leg-item">
            <AlarmaLeyenda color={t.warning} />
            <span className="donut-leg-name">Alarma GPS</span>
          </span>
        </div>
      </div>

      {modo === "mapas" && verSinUbic && sinUbicVisibles.length > 0 && (
        <div className="card card-pad mapa-sinubic">
          <div className="section-title" style={{ margin: "0 0 8px" }}>
            Locales sin coordenadas · se geocodifican en la intranet (ficha del local)
          </div>
          <div className="tbl-wrap" style={{ maxHeight: 240 }}>
            <table className="data grid">
              <thead><tr><th>ID</th><th>Local</th><th>Comuna</th><th>Chofer</th><th>Estado</th></tr></thead>
              <tbody>
                {sinUbicVisibles.map((p, i) => (
                  <tr key={`${p.id_local}-${i}`}>
                    <td className="tnum" style={{ color: "var(--muted)" }}>{p.id_local ?? "—"}</td>
                    <td>{p.local || "—"}</td>
                    <td style={{ color: "var(--muted)" }}>{p.comuna ?? "—"}</td>
                    <td style={{ color: "var(--muted)" }}>{p.chofer}</td>
                    <td><span className="pill" style={{ background: `color-mix(in srgb, ${estadoColor(p.estado, t)} 16%, transparent)`, color: estadoColor(p.estado, t) }}>{p.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {faltaCampo ? (
        <div className="estado">
          <div className="estado-ic">{avisoCampo.ic}</div>
          <div className="estado-tit">{avisoCampo.tit}</div>
          <p className="muted">
            Este snapshot lo generó una versión del publisher anterior a esta vista. Usá ↺ (Forzar recálculo)
            para pedir uno nuevo; si sigue igual, falta desplegar el Lambda.
          </p>
        </div>
      ) : modo === "tiempo" ? (
        filas.length === 0 ? (
          <p className="muted">Ninguna ruta de {tab} coincide con los filtros.</p>
        ) : (
          <TimelineRutas filas={filas} ventana={ventana} colorCentro={colorCentro} />
        )
      ) : filasMapa.length === 0 ? (
        <p className="muted">Ninguna ruta de {tab} coincide con los filtros.</p>
      ) : (
        // La key por tab: al cambiar de tramo se corta cualquier reproducción en
        // curso, en vez de seguir con un reloj calculado para otras rutas.
        <ReproduccionRutas key={tab} filas={filasMapa} ventana={ventana} colorCentro={colorCentro}
          gps={gps} fitKey={fit} />
      )}
    </div>
  );
}
