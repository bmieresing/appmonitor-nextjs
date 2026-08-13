"use client";
// Carrusel por chofer: pills + auto-avance, hero con métricas, donut de
// desglose (ECharts) y tablas/barras. Look profesional, tema-aware.
import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "./ReactECharts";
import MapaLocales from "./MapaLocales";
import MapaRecorrido from "./MapaRecorrido";
import FullscreenToggle from "./FullscreenToggle";
import TimelineRutas from "./TimelineRutas";
import ControlesReproduccion from "./ControlesReproduccion";
import { useReproduccion } from "./useReproduccion";
import Tank from "./Tank";
import AvisoDesbalance from "./AvisoDesbalance";
import { useTheme } from "./ThemeProvider";
import { useCentroColores, estiloRuta } from "./CentroColores";
import { breakdownDonutOption } from "@/lib/charts";
import { miles } from "@/lib/format";
import { avisoDeCarrusel } from "@/lib/cards";
import { estadoColor, prioridadColor, productColor, semaforo, semaforoOnDark } from "@/lib/theme";
import { tieneCoords, type PuntoMapa } from "@/lib/mapa";
import { aMinutos, filasTiempo, ventanaDe, type FilaTiempo, type RutaTiempo, type Ventana } from "@/lib/tiempo";
import type { CarruselChofer, DetalleLocal, Zona } from "@/lib/types";

// Nombre de la pestaña consolidada. Es también el `chofer` de la tarjeta sintética,
// así que sirve de clave para distinguirla del resto.
const GLOBAL = "Global";

/**
 * Tarjeta sintética con toda la flota, para la pestaña Global del carrusel.
 *
 * Los tanques del hero salen de `zonas.Global.kpis` —lo que ya calculó el
 * publisher para la vista Global— y no de sumar las tarjetas acá: son los mismos
 * números y tener dos maneras de obtenerlos es tener dos verdades. Lo que sí se
 * agrega en el front es lo que no existe consolidado en el snapshot: razones,
 * locales, productos y el detalle por local, que son concatenaciones directas.
 */
function armarGlobal(carrusel: CarruselChofer[], zona: Zona | undefined): CarruselChofer | null {
  if (carrusel.length === 0 || !zona?.kpis) return null;
  const k = zona.kpis;

  // El detalle global lleva el chofer en cada fila: en esta vista la tabla suma esa
  // columna, y sin ella un local no se puede atribuir a nadie.
  const detalle = carrusel.flatMap((c) => (c.detalle ?? []).map((d) => ({ ...d, chofer: c.chofer })));

  const razones = new Map<string, number>();
  for (const c of carrusel) for (const r of c.razones ?? []) razones.set(r.NombreRazon, (razones.get(r.NombreRazon) ?? 0) + r.N);

  const productos = new Map<string, { Producto: string; Visitas: number; Litros: number }>();
  for (const c of carrusel) for (const p of c.productos ?? []) {
    const acc = productos.get(p.Producto) ?? { Producto: p.Producto, Visitas: 0, Litros: 0 };
    acc.Visitas += p.Visitas;
    acc.Litros += p.Litros;
    productos.set(p.Producto, acc);
  }

  const emergTotal = carrusel.reduce((s, c) => s + (c.emerg_total || 0), 0);
  const emergOk = detalle.filter((d) => d.emergencia && d.estado === "Realizado").length;
  const pct = (r: number, t: number) => (t > 0 ? Math.round((r / t) * 100) : 0);

  return {
    chofer: GLOBAL,
    ruta: null,
    tripulacion: null,
    litros_tot: k.litros,
    exitosas: k.exitosas,
    fallidas: k.fallidas,
    pend_alta: carrusel.reduce((s, c) => s + (c.pend_alta || 0), 0),
    pend_normal: carrusel.reduce((s, c) => s + (c.pend_normal || 0), 0),
    pct_lit: k.pct_lit,
    sub_lit: `${miles(k.litros)} / ${miles(k.esperado)} L`,
    pct_loc: k.pct_loc,
    sub_loc: `${miles(k.exitosos_loc)}/${miles(k.total_loc)}`,
    no_alc_pct_loc: pct(k.no_alc_loc, k.total_loc),
    no_alc_loc: k.no_alc_loc,
    no_alc_alta: k.no_alc_alta,
    pct_alta: k.pct_alta,
    sub_alta: k.total_alta > 0 ? `${miles(k.exitosos_alta)}/${miles(k.total_alta)}` : "—",
    no_alc_pct_alta: pct(k.no_alc_alta, k.total_alta),
    tiene_alta: k.total_alta > 0,
    emerg_total: emergTotal,
    pct_emerg: pct(emergOk, emergTotal),
    sub_emerg: emergTotal > 0 ? `${miles(emergOk)}/${miles(emergTotal)}` : "—",
    cerrado: k.n_rutas > 0 && k.cerradas === k.n_rutas,
    razones: [...razones].map(([NombreRazon, N]) => ({ NombreRazon, N })).sort((a, b) => b.N - a.N),
    locales: carrusel.flatMap((c) => c.locales ?? []),
    productos: [...productos.values()].sort((a, b) => b.Litros - a.Litros),
    detalle: detalle as DetalleLocal[],
  };
}

const NO_ALC = "no alcanzamos a pasar";
const INTERVALO_MS = 10_000;
// Mínimo de locales para que valga partir la ruta en "mayor" y "menor aporte".
// Con menos de 5+5 las dos listas comparten filas y el mismo local aparece a la
// vez como el que más y el que menos aporta; ahí conviene una sola lista ordenada.
const MIN_TOPS = 10;

// Las tres tablas de magnitud del carrusel comparten forma, así que lo que las
// separa es el color. Antes las tres iban en el mismo coral y de reojo se leían
// como la misma lista repetida.

/** Mayor aporte: la rampa secuencial verde de marca (claro→saturado), así el local
 *  que más rinde es también el más verde. Arranca en el tercer tono y no en el
 *  primero: los dos extremos claros de la rampa se pierden contra el fondo de la
 *  barra en tema claro, y el número de litros toma el mismo color. */
const PISO_SEQ = 2;
function escalaAporte(seq: string[]) {
  const tope = seq.length - 1;
  return (_r: unknown, _i: number, frac: number) =>
    seq[Math.min(tope, PISO_SEQ + Math.round(frac * (tope - PISO_SEQ)))];
}

/** Menor aporte: del rojo al ámbar a medida que se acerca al resto. No es un fallo
 *  sino bajo rendimiento, y la lista ya viene con el más bajo primero. */
function escalaFlojo(n: number, critical: string, warning: string) {
  return (_r: unknown, i: number) => {
    const paso = n > 1 ? i / (n - 1) : 0;   // 0 = el de menos litros
    return `color-mix(in srgb, ${critical} ${Math.round((1 - paso) * 100)}%, ${warning})`;
  };
}

// Tabla de magnitud (estilo original): encabezados de columna + una columna con
// barra fina proporcional al máximo de la lista. `valueKey` es la columna barra.
// `colorDe` decide el color de cada barra: las tres tablas del carrusel comparten
// la forma pero no la escala de color, que es lo que las distingue de un vistazo.
function BarTable({ cols, rows, valueKey, colorDe }: {
  cols: { key: string; label: string; num?: boolean }[];
  rows: Record<string, string | number>[];
  valueKey: string;
  colorDe?: (fila: Record<string, string | number>, i: number, frac: number) => string;
}) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  return (
    <table className="data bartable">
      <thead>
        <tr>{cols.map((col) => <th key={col.key} style={{ textAlign: col.num && col.key !== valueKey ? "right" : "left" }}>{col.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {cols.map((col) => {
              if (col.key === valueKey) {
                const v = Number(r[valueKey]) || 0;
                const frac = v / max;
                const color = colorDe?.(r, i, frac);
                return (
                  <td key={col.key} className="bar-td">
                    <div className="dbar-cell">
                      <div className="dbar-track">
                        <i style={{ width: `${Math.max(4, Math.round(frac * 100))}%`, background: color }} />
                      </div>
                      <span className="dbar-val" style={{ color }}>{miles(v)} L</span>
                    </div>
                  </td>
                );
              }
              return <td key={col.key} style={{ textAlign: col.num ? "right" : "left" }}>{r[col.key]}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Datos temporales de la ruta del chofer que se está mostrando. Se calculan una
// vez y los comparten el mapa (que puede reproducirlos) y la línea de tiempo de
// abajo (que hace de barra del video), por eso viven acá arriba y no dentro de
// cada componente.
interface RutaDelDia {
  ruta: RutaTiempo;
  fila: FilaTiempo;
  ventana: Ventana;
  hayHoras: boolean;   // el snapshot trae `hora` y la ruta tiene al menos una visita
}

/** Tarjeta del carrusel → ruta de la línea de tiempo. En Global la tarjeta ya viene
 *  consolidada, así que sale una sola ruta con todas las visitas del día. */
function rutaDe(c: CarruselChofer | null, centroDe: (t: string | null | undefined) => string | undefined): RutaTiempo {
  const puntos: PuntoMapa[] = (c?.detalle ?? []).map((d) => ({ ...d, chofer: c!.chofer, ruta: c!.ruta, tripulacion: c!.tripulacion }));
  const hechos = puntos.filter((p) => p.estado === "Realizado").length;
  return {
    id: c?.chofer ?? "",
    titulo: c?.chofer ?? "",
    subtitulo: c?.ruta ?? null,
    centro: centroDe(c?.tripulacion),
    pct: puntos.length > 0 ? Math.round((hechos / puntos.length) * 100) : 0,
    puntos,
  };
}

function useRutaDelDia(c: CarruselChofer | null, centroDe: (t: string | null | undefined) => string | undefined): RutaDelDia {
  return useMemo(() => {
    const ruta = rutaDe(c, centroDe);
    const puntos = ruta.puntos;
    const fila = filasTiempo([ruta])[0];
    // La ventana es la jornada de este chofer, no la de la flota: acá el eje es su
    // día (en la vista Mapa se comparte entre tramos para que no salte al cambiar
    // de tab).
    const mins = puntos.map((p) => aMinutos(p.hora)).filter((m): m is number => m !== null);
    return {
      ruta,
      fila,
      ventana: ventanaDe(mins),
      hayHoras: puntos.some((p) => p.hora !== undefined) && fila.eventos.length > 0,
    };
  }, [c, centroDe]);
}

// Mapa de la ruta del chofer actual, con dos modos: estático (todos los locales a
// la vez) y reproducción (el recorrido hora por hora, igual que en la vista Mapa).
// Los puntos salen del mismo `detalle` que alimenta la tabla de abajo, así que las
// vistas muestran exactamente los mismos locales.
function MapaRuta({ c, rd, repro, minuto, onRepro }: {
  c: CarruselChofer;
  rd: RutaDelDia;
  repro: boolean;
  minuto: number;
  onRepro: (v: boolean) => void;
}) {
  const { tokens: t } = useTheme();
  const puntos = rd.ruta.puntos;
  const pintar = useMemo(() => (p: PuntoMapa) => estadoColor(p.estado, t), [t]);
  const conCoords = useMemo(() => puntos.filter(tieneCoords), [puntos]);
  const pendientes = useMemo(() => puntos.filter((p) => !p.hora), [puntos]);
  // Snapshot anterior al mapa: ningún local trae el campo. Distinto de traerlo en
  // null, que es un local real sin geocodificar.
  if (puntos.length === 0 || puntos.every((p) => p.lat === undefined)) return null;

  const sinUbic = puntos.length - conCoords.length;
  return (
    <div className="card card-pad">
      <div className="mapa-ruta-head">
        <div className="section-title" style={{ margin: 0 }}>
          {repro ? "▶ Recorrido de la ruta" : "🗺️ Ruta en el mapa"}
          <span style={{ color: "var(--muted)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
            {" · "}{conCoords.length} de {puntos.length} locales ubicados
            {sinUbic > 0 && ` · ${sinUbic} sin coordenadas`}
          </span>
        </div>
        {/* El toggle solo aparece si hay horas que reproducir. */}
        {rd.hayHoras && (
          <div className="modo-sw modo-sw-mini">
            <button className={`modo-btn${!repro ? " active" : ""}`} onClick={() => onRepro(false)} title="Todos los locales a la vez">Mapa</button>
            <button className={`modo-btn${repro ? " active" : ""}`} onClick={() => onRepro(true)} title="Reproducir el recorrido hora por hora">▶ Recorrido</button>
          </div>
        )}
      </div>
      {conCoords.length === 0
        ? <p className="muted">Ningún local de esta ruta tiene coordenadas cargadas.</p>
        : repro
          ? <MapaRecorrido rutaId={c.chofer} eventos={rd.fila.eventos} pendientes={pendientes} minuto={minuto} alto={430} />
          : <MapaLocales puntos={conCoords} colorDe={pintar} alto={430} fitKey={c.chofer} scrollZoom={false} />}
    </div>
  );
}

// Línea de tiempo de la ruta del chofer que se está mostrando: el mismo componente
// de la vista Mapa, con una sola fila y sin la columna del nombre (ya está en el
// hero), a todo el ancho. Responde "cómo se repartió el día" — a qué hora arrancó,
// dónde hubo huecos, hasta cuándo llegó — que en la tabla de detalle no se ve.
//
// Con el recorrido en reproducción pasa a ser además la barra del video: lleva el
// cursor del reloj, atenúa lo que todavía no ocurrió y se puede clickear para
// saltar a una hora. Los controles están arriba, en la card del mapa.
function TimelineChofer({ rd, titulo, cursor, onSaltar }: {
  rd: RutaDelDia;
  titulo: string;
  cursor: number | null;
  onSaltar?: (minuto: number) => void;
}) {
  const { colorDe } = useCentroColores();
  const filas = useMemo(() => [rd.fila], [rd.fila]);

  if (!rd.hayHoras) return null;

  // El título va DENTRO de la card (como el del mapa), no flotando encima de ella.
  const encabezado = (
    <div className="section-title" style={{ margin: "0 0 10px" }}>
      ⏱️ {titulo}
      <span style={{ color: "var(--muted)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
        {" · "}hora en que se registró cada visita
        {cursor !== null && " · click para saltar a esa hora"}
      </span>
    </div>
  );

  return (
    <div className="carrusel-tl">
      <TimelineRutas filas={filas} ventana={rd.ventana} colorCentro={colorDe} sinEtiqueta
        cursor={cursor} onSaltar={onSaltar} encabezado={encabezado} />
    </div>
  );
}

function segmentos(c: CarruselChofer, t: { good: string; critical: string; serious: string; warning: string; muted: string; categorical: string[] }) {
  const reds = [t.critical, t.serious, t.warning, "#7b241c", "#d35400"];
  const segs = [{ name: "Exitosas", value: c.exitosas, color: t.good }];
  let oi = 0;
  for (const r of c.razones ?? []) {
    const esNoAlc = r.NombreRazon.trim().toLowerCase() === NO_ALC;
    segs.push({ name: r.NombreRazon, value: r.N, color: esNoAlc ? t.critical : reds[(oi++ % (reds.length - 1)) + 1] });
  }
  segs.push({ name: "Pend. Alta", value: c.pend_alta, color: "#6b7280" });
  segs.push({ name: "Pend. Baja/Media", value: c.pend_normal, color: t.muted });
  return segs;
}

// Desglose de visitas (donut + leyenda + mini-KPIs). Componente aparte por lo
// mismo que MapaRuta: el filtrado y el orden de la tabla de detalle viven en el
// componente padre, y armar la opción de ECharts ahí adentro la hacía objeto
// nuevo en cada tecleo — y ReactECharts reconstruye el gráfico entero (setOption
// con notMerge) cada vez que la opción cambia de identidad. Acá el memo depende
// solo del chofer y del tema, que es de lo único que depende el gráfico.
function DonutDesglose({ c }: { c: CarruselChofer }) {
  const { tokens: t } = useTheme();
  const segs = useMemo(() => segmentos(c, t), [c, t]);
  const option = useMemo(() => breakdownDonutOption(segs, t), [segs, t]);
  const cajas = useMemo<[string, number, string][]>(() => [
    [t.good, c.exitosas, "Exitosas"],
    [t.critical, c.fallidas, "Fallidas"],
    ["#6b7280", c.pend_alta, "Pend. Alta"],
    [t.muted, c.pend_normal, "Pend. Normal"],
  ], [c, t]);

  return (
    <div className="card card-pad">
      <div className="section-title" style={{ margin: "0 0 6px" }}>Desglose de visitas</div>
      <ReactECharts option={option} height={300} />
      {/* Leyenda en HTML (nombre + valor por segmento): texto nítido al zoom,
          el canvas solo dibuja el aro. */}
      {/* Los nombres van enteros; la leyenda baja de fila si no entran. */}
      <div className="donut-legend">
        {segs.filter((s) => s.value > 0).map((s) => (
          <span key={s.name} className="donut-leg-item" title={`${s.name}: ${miles(s.value)}`}>
            <span className="donut-leg-dot" style={{ background: s.color }} />
            <span className="donut-leg-name">{s.name}</span>
            <span className="donut-leg-val tnum">{miles(s.value)}</span>
          </span>
        ))}
      </div>
      <div className="mini-kpis">
        {cajas.map(([color, val, lbl]) => (
          <div key={lbl} className="mini-kpi" style={{ background: color }}>
            <div className="v tnum">{val}</div>
            <div className="l">{lbl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CarruselView({ carrusel, global, initialChofer }: {
  carrusel: CarruselChofer[];
  global?: Zona;
  initialChofer?: string;
}) {
  const { tokens: t } = useTheme();
  const { centroDe, colorDe } = useCentroColores();
  // Las pestañas son un chofer cada una + Global al final: la lista se lee como la
  // nómina de choferes y la consolidación la cierra, como el total de una tabla.
  // El carrusel entra por el primer chofer, no por Global — la vista arranca donde
  // arranca la lista.
  const tarjetaGlobal = useMemo(() => armarGlobal(carrusel, global), [carrusel, global]);
  const slides = useMemo(
    () => (tarjetaGlobal ? [...carrusel, tarjetaGlobal] : carrusel),
    [tarjetaGlobal, carrusel],
  );
  const choferes = useMemo(() => slides.map((c) => c.chofer), [slides]);
  const startIdx = Math.max(0, initialChofer ? choferes.indexOf(initialChofer) : 0);
  const [idx, setIdx] = useState(startIdx);
  const [auto, setAuto] = useState(false);
  // Lista de choferes plegable: en un monitor con 25 rutas las pills se comen dos
  // o tres líneas de alto que el hero y el mapa aprovechan mejor.
  const [verPills, setVerPills] = useState(true);
  // Orden y filtros por columna del detalle (client-side; el detalle ya viene en
  // el snapshot). sortCol="" = orden natural del publisher (Alta + litros desc).
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  // Modo recorrido del mapa de la ruta. Vive acá y no en MapaRuta porque el reloj
  // lo comparten el mapa y la línea de tiempo de más abajo.
  const [repro, setRepro] = useState(false);

  useEffect(() => {
    if (!auto || choferes.length === 0) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % choferes.length), INTERVALO_MS);
    return () => clearInterval(id);
  }, [auto, choferes.length]);

  // Hooks antes de cualquier return: `c` puede ser null si no hay datos.
  const c = slides.length > 0 ? slides[Math.min(idx, slides.length - 1)] : null;
  const esGlobal = c?.chofer === GLOBAL;
  const rd = useRutaDelDia(c, centroDe);
  const rep = useReproduccion(rd.fila.primera ?? 0, rd.fila.ultima ?? -1, repro && rd.hayHoras);

  if (!c) return <p className="muted">Sin datos de recolecciones para hoy.</p>;
  const locOrden = (c.locales ?? []).slice().sort((a, b) => b.Litros - a.Litros); // desc
  const masLitros = locOrden.slice(0, 5);
  const menosLitros = locOrden.slice(-5).reverse();   // el de menos litros, primero
  const listaUnica = locOrden.length < MIN_TOPS;      // ruta corta: una sola lista

  // Detalle: columnas (con su tipo de filtro), filtrado y orden por columna.
  const detalle = c.detalle ?? [];
  const estadosPresentes = ["Realizado", "No alcanzado", "Fallido", "Pendiente"].filter((e) => detalle.some((d) => d.estado === e));
  // Prioridades reales presentes en la ruta (LocalesRuta), ordenadas Alta→Media→Baja→Normal→otras.
  const ordenPrio = ["Alta", "Media", "Baja", "Normal"];
  const prioridadesPresentes = [...new Set(detalle.map((d) => d.prioridad))]
    .sort((a, b) => ((ordenPrio.indexOf(a) + 1 || 99) - (ordenPrio.indexOf(b) + 1 || 99)) || a.localeCompare(b));
  const hayEmergencias = detalle.some((d) => d.emergencia);
  const cols: { key: string; label: string; num?: boolean; filtro: "text" | "select" | "none"; ops?: string[] }[] = [
    { key: "id_local", label: "ID", num: true, filtro: "text" },
    { key: "local", label: "Local", filtro: "text" },
    // Solo en Global: con las rutas mezcladas, un local sin chofer no se puede atribuir.
    ...(esGlobal ? [{ key: "chofer", label: "Chofer", filtro: "text" as const }] : []),
    { key: "prioridad", label: "Prioridad", filtro: "select", ops: prioridadesPresentes },
    { key: "emergencia", label: "Emergencia", filtro: hayEmergencias ? "select" : "none", ops: ["Sí", "No"] },
    { key: "estado", label: "Estado", filtro: "select", ops: estadosPresentes },
    { key: "razon", label: "Razón", filtro: "text" },
    { key: "litros", label: "Litros", num: true, filtro: "none" },
  ];
  const celda = (d: (typeof detalle)[number], key: string) =>
    key === "id_local" ? String(d.id_local ?? "")
      : key === "emergencia" ? (d.emergencia ? "Sí" : "No")
        : String((d as Record<string, unknown>)[key] ?? "");
  let detFilt = detalle.filter((d) => cols.every((col) => {
    const v = filtros[col.key];
    if (!v) return true;
    const cell = celda(d, col.key);
    return col.filtro === "select" ? cell === v : cell.toLowerCase().includes(v.toLowerCase());
  }));
  if (sortCol) {
    const col = cols.find((c2) => c2.key === sortCol);
    detFilt = [...detFilt].sort((a, b) => {
      if (col?.num) {
        const av = Number((a as Record<string, unknown>)[sortCol] ?? -Infinity);
        const bv = Number((b as Record<string, unknown>)[sortCol] ?? -Infinity);
        return (av - bv) * sortDir;
      }
      return celda(a, sortCol).localeCompare(celda(b, sortCol)) * sortDir;
    });
  }
  const ordenarPor = (key: string) => {
    if (sortCol !== key) { setSortCol(key); setSortDir(1); }        // 1er click: asc
    else if (sortDir === 1) setSortDir(-1);                         // 2do: desc
    else { setSortCol(""); setSortDir(1); }                         // 3er: orden natural
  };

  // Morado de emergencia: manda sobre la prioridad, acá y en el mapa.
  const morado = prioridadColor("", true, t);

  return (
    <div>
      <div className="toolbar">
        <button className="icon-btn" onClick={() => setIdx((i) => (i - 1 + choferes.length) % choferes.length)}>◀</button>
        <button className="icon-btn" onClick={() => setIdx((i) => (i + 1) % choferes.length)}>▶</button>
        <label className="sw"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-avance</label>
        <FullscreenToggle />
      </div>

      <div className="pills-head">
        <button className="pills-toggle" onClick={() => setVerPills((v) => !v)} aria-expanded={verPills}>
          <span className="pills-caret">{verPills ? "▾" : "▸"}</span>
          Choferes <span className="tnum">{miles(carrusel.length)}</span>
        </button>
        {!verPills && <span className="pills-actual">{esGlobal ? "🌐 " : ""}{c.chofer}</span>}
      </div>

      {/* El fondo de cada pill es su avance de litros sobre lo esperado (el mismo
          % del balde 💧): la lista deja de ser solo un selector y se lee como el
          ranking del día sin tener que entrar chofer por chofer. */}
      {verPills && (
        <div className="pills pills-choferes">
          {slides.map((ch, i) => {
            const p = Math.max(0, Math.min(100, ch.pct_lit ?? 0));
            const col = semaforo(ch.pct_lit ?? 0, t);
            return (
              <button key={ch.chofer}
                className={`chip-btn${i === idx ? " active" : ""}${ch.chofer === GLOBAL ? " chip-btn-global" : ""}`}
                onClick={() => setIdx(i)}
                title={`${ch.chofer} · ${ch.sub_lit ?? "sin litros"} (${ch.pct_lit ?? 0}% de lo esperado)`}
                style={{ "--pct": `${p}%`, "--pct-col": col } as React.CSSProperties}>
                <span className="chip-fill" />
                {/* El mismo triángulo de las cards de chofer: quién necesita atención
                    se ve en la lista, sin entrar pestaña por pestaña. */}
                <AvisoDesbalance {...avisoDeCarrusel(ch)} size={13} />
                <span className="chip-txt">{ch.chofer === GLOBAL ? "🌐 " : ch.cerrado ? "🔒 " : ""}{ch.chofer}</span>
                <span className="chip-pct tnum">{ch.pct_lit ?? 0}%</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="hero">
        <div>
          <div className="hero-eyebrow">{esGlobal ? `Toda la flota · ${miles(carrusel.length)} rutas` : "Chofer"}</div>
          <div className="hero-name">
            {/* Sobre el degradado oscuro el triángulo va en su versión clara. */}
            <AvisoDesbalance {...avisoDeCarrusel(c)} size={26} onDark />
            {esGlobal ? "🌐 " : c.cerrado ? "🔒 " : ""}{c.chofer}
          </div>
          {c.ruta && (() => {
            const centro = centroDe(c.tripulacion);
            return (
              <div className="hero-route" style={estiloRuta(colorDe(centro), true)} title={centro ?? c.tripulacion ?? undefined}>
                🗺️ {c.ruta}
              </div>
            );
          })()}
        </div>
        <div className="hero-metrics">
          {/* Cada balde toma el color de su propio %, igual que en las tarjetas de
              chofer: antes iban con un color fijo por métrica y un 30% se veía igual
              de verde que un 95%. Tonos claros porque el hero es oscuro. */}
          <Tank icon="💧" label="Litros" pct={c.pct_lit} color={semaforoOnDark(c.pct_lit)} sub={c.sub_lit} onDark inlineSub />
          <Tank icon="🏪" label="Locales" pct={c.pct_loc} color={semaforoOnDark(c.pct_loc)} sub={c.sub_loc} noAlcPct={c.no_alc_pct_loc ?? 0} noAlcN={c.no_alc_loc} onDark inlineSub />
          {c.tiene_alta && <Tank icon="⭐" label="Alta" pct={c.pct_alta} color={semaforoOnDark(c.pct_alta)} sub={c.sub_alta} noAlcPct={c.no_alc_pct_alta ?? 0} noAlcN={c.no_alc_alta} onDark inlineSub />}
          {c.emerg_total > 0 && <Tank icon="🚨" label="Emergencias" pct={c.pct_emerg} color={semaforoOnDark(c.pct_emerg)} sub={c.sub_emerg} onDark inlineSub />}
        </div>
      </div>

      <div className="grid-2">
        {/* Columna izquierda: el desglose y, debajo, los productos. Son las dos
            lecturas del MISMO total de la ruta —cómo terminó cada visita y en qué
            se tradujo—, así que se leen juntas; y de paso la columna deja de tener
            una sola card estirada al alto de la fila. */}
        <div className="carrusel-col">
          <DonutDesglose c={c} />
          <div className="card card-pad">
            <div className="section-title" style={{ margin: "0 0 10px" }}>🧴 Por producto <span className="sec-sub">— litros y visitas</span></div>
            {(c.productos ?? []).length === 0 ? <p className="muted">Sin datos</p>
              : <BarTable cols={[{ key: "Producto", label: "Producto" }, { key: "Visitas", label: "Visitas", num: true }, { key: "Litros", label: "Litros", num: true }]}
                  rows={c.productos} valueKey="Litros" colorDe={(r) => productColor(String(r.Producto))} />}
          </div>
        </div>

        <div className="carrusel-lists">
          {/* Rutas cortas (menos de 10 locales): una sola lista con todos, de mayor
              a menor. Partirla en dos tops repetiría los mismos locales en las dos
              cards y dejaría al mismo local como el que más y el que menos aporta. */}
          <div className="lists-col">
            {listaUnica ? (
              <div className="card card-pad">
                <div className="section-title" style={{ margin: "0 0 10px" }}>🏪 Locales</div>
                {locOrden.length === 0 ? <p className="muted">Sin datos</p>
                  : <BarTable cols={[{ key: "Local", label: "Local" }, { key: "Litros", label: "Litros", num: true }]}
                      rows={locOrden} valueKey="Litros" colorDe={escalaAporte(t.seq)} />}
              </div>
            ) : (
              <>
                <div className="card card-pad">
                  <div className="section-title" style={{ margin: "0 0 10px" }}>🏆 Mayor aporte <span className="sec-sub">— los 5 locales con más litros</span></div>
                  <BarTable cols={[{ key: "Local", label: "Local" }, { key: "Litros", label: "Litros", num: true }]}
                    rows={masLitros} valueKey="Litros" colorDe={escalaAporte(t.seq)} />
                </div>
                <div className="card card-pad">
                  <div className="section-title" style={{ margin: "0 0 10px" }}>🔻 Menor aporte <span className="sec-sub">— los 5 locales con menos litros</span></div>
                  <BarTable cols={[{ key: "Local", label: "Local" }, { key: "Litros", label: "Litros", num: true }]}
                    rows={menosLitros} valueKey="Litros" colorDe={escalaFlojo(menosLitros.length, t.critical, t.warning)} />
                </div>
              </>
            )}
          </div>
          {/* Columna del mapa: los dos rankings quedan apilados a la izquierda y la
              ruta se ve en paralelo, sin tener que bajar hasta el pie de la vista.
              Se lleva el doble de ancho que los rankings — es lo único de la vista
              que gana con cada píxel. */}
          <div className="lists-col lists-col-mapa">
            <MapaRuta c={c} rd={rd} repro={repro && rd.hayHoras} minuto={rep.minuto} onRepro={setRepro} />
            {repro && rd.hayHoras && (
              <ControlesReproduccion rep={rep} compacto>
                <span className="chip">
                  <b className="tnum">{miles(rd.fila.eventos.filter((e) => e.min <= rep.minuto).length)}</b>
                  &nbsp;de {miles(rd.fila.eventos.length)}
                </span>
              </ControlesReproduccion>
            )}

            {/* La línea de tiempo cierra la columna del mapa, justo debajo y a su
                mismo ancho: son las dos lecturas de la misma ruta —dónde y cuándo—,
                y una arriba de la otra el eje horario se lee contra el recorrido en
                vez de contra los rankings de al lado. */}
            <TimelineChofer rd={rd} titulo={esGlobal ? "Línea de tiempo del día" : "Línea de tiempo de la ruta"}
              cursor={repro && rd.hayHoras ? rep.minuto : null}
              onSaltar={repro && rd.hayHoras ? rep.irA : undefined} />
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="section-title" style={{ margin: "0 0 10px" }}>
          📋 Detalle de recolecciones {detalle.length > 0 && <span style={{ color: "var(--muted)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· {detFilt.length === detalle.length ? `${detalle.length} locales` : `${detFilt.length} de ${detalle.length}`}</span>}
        </div>
        {detalle.length === 0 ? <p className="muted">Sin datos de la ruta.</p> : (
          <div className="tbl-wrap">
            <table className="data grid">
              <thead>
                <tr>
                  {cols.map((col) => (
                    <th key={col.key} onClick={() => ordenarPor(col.key)} style={{ cursor: "pointer", textAlign: col.num ? "right" : "left", whiteSpace: "nowrap" }} title="Ordenar">
                      {col.label}
                      <span style={{ marginLeft: 4, opacity: sortCol === col.key ? 1 : 0.3, fontSize: 10 }}>{sortCol === col.key ? (sortDir === 1 ? "▲" : "▼") : "↕"}</span>
                    </th>
                  ))}
                </tr>
                <tr className="filtro-row">
                  {cols.map((col) => (
                    <th key={col.key}>
                      {col.filtro === "text" && (
                        <input className="col-filtro" value={filtros[col.key] ?? ""} placeholder="Filtrar…"
                          onChange={(e) => setFiltros((f) => ({ ...f, [col.key]: e.target.value }))} />
                      )}
                      {col.filtro === "select" && (
                        <select className="col-filtro" value={filtros[col.key] ?? ""}
                          onChange={(e) => setFiltros((f) => ({ ...f, [col.key]: e.target.value }))}>
                          <option value="">Todos</option>
                          {col.ops!.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detFilt.length === 0 ? (
                  <tr><td colSpan={cols.length} className="muted" style={{ textAlign: "center", padding: 18 }}>Ningún local coincide con los filtros.</td></tr>
                ) : detFilt.map((d, i) => {
                  const ec = estadoColor(d.estado, t);
                  return (
                    <tr key={i}>
                      <td className="tnum" style={{ color: "var(--muted)", textAlign: "right" }}>{d.id_local ?? "—"}</td>
                      <td>
                        {d.local || "—"}
                        {d.productos.length > 0 && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                            {d.productos.map((p) => `${p.producto} ${miles(p.litros)} L`).join(" · ")}
                          </div>
                        )}
                      </td>
                      {esGlobal && (
                        <td style={{ color: "var(--muted)" }}>{String((d as Record<string, unknown>).chofer ?? "—")}</td>
                      )}
                      <td>
                        {/* Mismo código de color que el borde de los puntos del
                            mapa: alta roja · media naranja · baja/normal azul. */}
                        {(() => {
                          const pc = prioridadColor(d.prioridad, false, t);
                          if (d.prioridad === "—") return <span style={{ color: "var(--muted)" }}>—</span>;
                          return (
                            <span className="pill" style={{ background: `color-mix(in srgb, ${pc} 16%, transparent)`, color: pc }}>
                              {d.prioridad === "Alta" ? "⭐ " : ""}{d.prioridad}
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        {d.emergencia
                          ? <span className="pill" style={{ background: `color-mix(in srgb, ${morado} 16%, transparent)`, color: morado }}>🚨 Sí</span>
                          : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td><span className="pill" style={{ background: `color-mix(in srgb, ${ec} 16%, transparent)`, color: ec }}>{d.estado}</span></td>
                      <td style={{ color: "var(--muted)" }}>{d.razon ?? "—"}</td>
                      <td className="tnum" style={{ textAlign: "right", fontWeight: 700 }}>{d.litros > 0 ? `${miles(d.litros)} L` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
