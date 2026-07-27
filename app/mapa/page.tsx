"use client";
// Vista Mapa: un mapa por chofer con su ruta del día. El resto del dashboard
// responde CUÁNTO falta; esta responde DÓNDE.
//
// La unidad es la ruta, no el territorio. Un mapa regional (o nacional) apila
// cientos de locales en el mismo píxel y termina siendo una mancha; la ruta de un
// chofer entra completa en un panel chico, con el zoom justo y los puntos
// separados. Y es la unidad con la que se opera: cada panel es el trabajo de una
// persona, con su propio avance.
//
// Los puntos salen del detalle por local que ya trae el snapshot (lib/mapa.ts):
// no viajan datos nuevos, solo las coordenadas.
import React, { useEffect, useMemo, useState } from "react";
import MapaLocales, { PinLeyenda } from "@/components/MapaLocales";
import FullscreenToggle from "@/components/FullscreenToggle";
import { useSnap } from "@/components/SnapshotContext";
import { useCentroColores, estiloRuta } from "@/components/CentroColores";
import { useTheme } from "@/components/ThemeProvider";
import {
  puntosDeSnapshot, panelesPorChofer, tramosPorCentro, TRAMOS,
  type PuntoMapa, type Tramo,
} from "@/lib/mapa";
import { estadoColor, semaforo, ESTADOS } from "@/lib/theme";
import { miles } from "@/lib/format";

const FALTA = "__falta__";           // opción "todo lo que no está realizado"

export default function MapaPage() {
  const { snap } = useSnap();
  const { tokens: t } = useTheme();
  const { centroDe, colorDe: colorCentro, zonaMap } = useCentroColores();

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

  const visibles = useMemo(() => datos.puntos.filter(pasa), [datos.puntos, pasa]);
  const sinUbicVisibles = useMemo(() => datos.sinUbicacion.filter(pasa), [datos.sinUbicacion, pasa]);
  const todosPaneles = useMemo(
    () => panelesPorChofer(visibles, centroDe, ordenCentro, tramos),
    [visibles, centroDe, ordenCentro, tramos],
  );
  const paneles = useMemo(() => todosPaneles.filter((p) => p.tramo === tab), [todosPaneles, tab]);

  // Encuadre: cada cambio de filtro o de tab acerca a lo que quedó visible.
  const filtroKey = `${tab}|${estado}|${soloAlta}|${soloEmerg}`;
  const [fit, setFit] = useState("init");
  useEffect(() => { setFit(filtroKey); }, [filtroKey]);

  // El pin se pinta por estado. El centro ya se lee en el recuadro de la ruta de
  // cada panel, así que colorear los puntos por centro solo duplicaba esa info y
  // le quitaba al mapa la única pregunta que responde bien: qué falta.
  const pintar = useMemo(() => (p: PuntoMapa) => estadoColor(p.estado, t), [t]);

  if (!snap) return <p className="muted">Cargando…</p>;
  if (datos.total === 0) return <p className="muted">Sin locales asignados para hoy.</p>;
  if (datos.sinSoporte) {
    return (
      <div className="estado">
        <div className="estado-ic">🗺️</div>
        <div className="estado-tit">El snapshot todavía no trae coordenadas</div>
        <p className="muted">
          Este snapshot lo generó una versión del publisher anterior al mapa. Usá ↺ (Forzar recálculo)
          para pedir uno nuevo; si sigue igual, falta desplegar el Lambda.
        </p>
      </div>
    );
  }

  return (
    <div className="mapa-page">
      <div className="toolbar mapa-toolbar">
        <select className="col-filtro" value={estado} onChange={(e) => setEstado(e.target.value)} title="Estado del local">
          <option value="">Todos los estados</option>
          <option value={FALTA}>Lo que falta (no realizado)</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        <label className="sw"><input type="checkbox" checked={soloAlta} onChange={(e) => setSoloAlta(e.target.checked)} /> Solo prioridad Alta</label>
        <label className="sw"><input type="checkbox" checked={soloEmerg} onChange={(e) => setSoloEmerg(e.target.checked)} /> Solo emergencias</label>

        <button className="icon-btn" style={{ width: "auto", padding: "0 12px" }}
          onClick={() => setFit(`fit-${Date.now()}`)} title="Volver a encuadrar los mapas">
          ⤢ Reencuadrar
        </button>
        <FullscreenToggle />
      </div>

      {/* Tabs por tramo del país: la partición sale del `orden` de monitor_zona_map
          (norte→sur), tomando Logística Santiago como eje. */}
      <div className="mapa-tabs">
        {TRAMOS.map((tr) => {
          const ps = todosPaneles.filter((p) => p.tramo === tr.id);
          const locales = ps.reduce((s, p) => s + p.puntos.length, 0);
          const hechos = ps.reduce((s, p) => s + p.realizados, 0);
          const pct = locales > 0 ? Math.round((hechos / locales) * 100) : 0;
          return (
            <button key={tr.id} className={`mapa-tab${tab === tr.id ? " active" : ""}`} onClick={() => setTab(tr.id)}>
              <span className="mapa-tab-tit">{tr.titulo}</span>
              <span className="mapa-tab-sub">{ps.length} {ps.length === 1 ? "ruta" : "rutas"} · {tr.detalle}</span>
              <span className="mapa-tab-kpi">
                <b className="tnum" style={{ color: locales ? semaforo(pct, t) : "var(--muted)" }}>{pct}%</b>
                <span className="tnum">{miles(hechos)}/{miles(locales)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mapa-resumen">
        <span className="chip"><b className="tnum">{miles(paneles.length)}</b>&nbsp;rutas en {tab}</span>
        {sinUbicVisibles.length > 0 && (
          <button className={`chip warn chip-accion${verSinUbic ? " active" : ""}`} onClick={() => setVerSinUbic((v) => !v)}
            title="Locales de la ruta sin latitud/longitud: no se pueden dibujar">
            📍 {miles(sinUbicVisibles.length)} sin ubicación {verSinUbic ? "▲" : "▼"}
          </button>
        )}
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
        </div>
      </div>

      {verSinUbic && sinUbicVisibles.length > 0 && (
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

      {paneles.length === 0 ? (
        <p className="muted">Ninguna ruta de {tab} coincide con los filtros.</p>
      ) : (
        <div className="mapa-paneles">
          {paneles.map((pan) => (
            <div key={pan.id} className="card mapa-panel">
              <div className="mapa-panel-head">
                <div className="mapa-panel-id">
                  <div className="mapa-panel-tit" title={pan.titulo}>{pan.titulo}</div>
                  {pan.subtitulo && (
                    <div className="mapa-panel-ruta" style={estiloRuta(colorCentro(pan.centro))} title={pan.centro}>
                      {pan.subtitulo}
                    </div>
                  )}
                </div>
                <div className="mapa-panel-kpis">
                  <b className="tnum" style={{ color: semaforo(pan.pct, t) }}>{pan.pct}%</b>
                  <span className="mapa-panel-det tnum">{miles(pan.realizados)}/{miles(pan.puntos.length)} · {miles(pan.litros)} L</span>
                </div>
              </div>
              <MapaLocales
                puntos={pan.puntos} colorDe={pintar} alto="100%"
                fitKey={`${pan.id}|${fit}`} scrollZoom={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
