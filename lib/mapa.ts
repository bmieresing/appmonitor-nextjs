// Puntos de la vista Mapa, derivados del snapshot.
//
// El snapshot NO trae un bloque de mapa aparte: la granularidad por local ya
// existe en `carrusel[].detalle[]` (una fila por local de la ruta, con estado,
// litros, prioridad y coordenadas). Acá se concatena el detalle de todos los
// choferes y se le pega la cabecera del chofer (nombre, ruta, tripulación), que
// es justo lo que falta para filtrar y para resolver el centro/color. Así el
// mapa no duplica ni un byte en el JSON que se repolla cada 60 s.
import type { DetalleLocal, Snapshot } from "./types";

export interface PuntoMapa extends DetalleLocal {
  chofer: string;
  ruta: string | null;
  tripulacion: string | null;   // se mapea a centro/color con useCentroColores()
}

export interface DatosMapa {
  puntos: PuntoMapa[];          // solo los que tienen coordenadas válidas
  sinUbicacion: PuntoMapa[];    // el resto: existen en la ruta, no se pueden dibujar
  /** Todos, con y sin coordenadas. La línea de tiempo se ordena por hora, no por
   *  posición: un local sin geocodificar igual tiene hora de visita y dejarlo
   *  afuera falsearía el ritmo de la ruta. */
  todos: PuntoMapa[];
  total: number;
  /** El snapshot vigente es anterior al mapa (ningún local trae el campo lat). */
  sinSoporte: boolean;
}

/** Aplana `carrusel[].detalle[]` a puntos y los separa por si tienen coordenadas. */
export function puntosDeSnapshot(snap: Snapshot | null): DatosMapa {
  const vacio: DatosMapa = { puntos: [], sinUbicacion: [], todos: [], total: 0, sinSoporte: false };
  if (!snap) return vacio;

  const todos: PuntoMapa[] = [];
  for (const c of snap.carrusel ?? []) {
    for (const d of c.detalle ?? []) {
      todos.push({ ...d, chofer: c.chofer, ruta: c.ruta, tripulacion: c.tripulacion });
    }
  }
  if (todos.length === 0) return vacio;

  // Un snapshot generado por el Lambda anterior no tiene la propiedad `lat` en
  // ningún local. Distinto de tenerla en null (= local sin geocodificar): eso es
  // un dato real y el mapa lo muestra como "sin ubicación".
  const sinSoporte = todos.every((p) => p.lat === undefined);
  const puntos = todos.filter((p) => tieneCoords(p));
  const sinUbicacion = todos.filter((p) => !tieneCoords(p));
  return { puntos, sinUbicacion, todos, total: todos.length, sinSoporte };
}

export function tieneCoords(p: PuntoMapa | DetalleLocal): boolean {
  return typeof p.lat === "number" && typeof p.lng === "number";
}

// ── Tramos del país (tabs) ───────────────────────────────────────────────
// Los paneles se reparten en tres tabs para no tener 30 mapas en una sola
// pantalla. La partición sale del `orden` de monitor_zona_map, que ya está
// cargado norte→sur: los centros con orden menor al de Santiago son Norte y los
// mayores, Sur. Agregar un centro nuevo es ponerle su `orden` en Parámetros — no
// hay una segunda lista que mantener sincronizada acá.
export type Tramo = "Norte" | "Santiago" | "Sur";

export const TRAMOS: { id: Tramo; titulo: string; detalle: string }[] = [
  { id: "Norte", titulo: "Norte", detalle: "Arica → Viña del Mar" },
  { id: "Santiago", titulo: "Santiago", detalle: "Región Metropolitana" },
  { id: "Sur", titulo: "Sur", detalle: "Rancagua → Punta Arenas" },
];

/** Prefijo de tripulación que identifica al centro de Santiago en monitor_zona_map. */
const PREFIJO_STGO = "SANTIAGO";

export function tramosPorCentro(zonaMap: { prefijo: string; centro: string; orden: number }[]): Map<string, Tramo> {
  const m = new Map<string, Tramo>();
  const filaStgo = zonaMap.find((z) => z.prefijo.toUpperCase() === PREFIJO_STGO)
    ?? zonaMap.find((z) => z.centro.toLowerCase().includes("santiago"));
  if (!filaStgo) return m;   // sin Santiago mapeado no hay eje: cae todo al fallback
  for (const z of zonaMap) {
    m.set(z.centro, z.orden === filaStgo.orden ? "Santiago" : z.orden < filaStgo.orden ? "Norte" : "Sur");
  }
  return m;
}

// ── Paneles: un mapa por chofer ──────────────────────────────────────────
// La unidad del mapa es la RUTA DEL DÍA, no el territorio. Un encuadre regional
// apila cientos de locales en el mismo píxel y no se lee nada; la ruta de un
// chofer, en cambio, entra completa en un mapa chico y con el zoom justo. Además
// es la unidad con la que se opera: cada panel es el trabajo de una persona.
export interface Panel {
  id: string;
  titulo: string;              // chofer
  subtitulo: string | null;    // su ruta
  centro?: string;             // centro de acopio (para el color del recuadro)
  tramo: Tramo;                // tab en el que se muestra
  puntos: PuntoMapa[];
  realizados: number;
  litros: number;
  pct: number;
}

/**
 * Tramo de una ruta. Vía principal: el centro de acopio del chofer. Si su
 * tripulación no mapea a ningún centro (chofer nuevo, mapeo incompleto), se cae a
 * la latitud del primer local para no perder el panel: Viña y Santiago están casi
 * en la misma latitud, pero el corte de la RM alcanza como último recurso.
 */
function tramoDe(centro: string | undefined, mapa: Map<string, Tramo>, lat: number | null | undefined): Tramo {
  const t = centro ? mapa.get(centro) : undefined;
  if (t) return t;
  const y = lat ?? -33.45;
  if (y > -33.2) return "Norte";
  if (y < -34.0) return "Sur";
  return "Santiago";
}

export function panelesPorChofer(
  puntos: PuntoMapa[],
  centroDe: (trip: string | null | undefined) => string | undefined,
  ordenCentro: Map<string, number>,
  tramos: Map<string, Tramo>,
): Panel[] {
  const porChofer = new Map<string, PuntoMapa[]>();
  for (const p of puntos) {
    const lista = porChofer.get(p.chofer);
    if (lista) lista.push(p); else porChofer.set(p.chofer, [p]);
  }

  const paneles: Panel[] = [...porChofer].map(([chofer, ps]) => {
    const realizados = ps.filter((p) => p.estado === "Realizado").length;
    const centro = centroDe(ps[0]?.tripulacion);
    return {
      id: chofer, titulo: chofer,
      subtitulo: ps[0]?.ruta ?? null,
      centro,
      tramo: tramoDe(centro, tramos, ps[0]?.lat),
      puntos: ps, realizados,
      litros: ps.reduce((s, p) => s + (p.litros || 0), 0),
      pct: ps.length > 0 ? Math.round((realizados / ps.length) * 100) : 0,
    };
  });

  // Agrupados por centro en orden norte→sur (el mismo `orden` del mapeo), y
  // dentro de cada centro por nombre: los choferes de una misma zona quedan
  // juntos en la grilla.
  return paneles.sort((a, b) =>
    ((a.centro ? ordenCentro.get(a.centro) ?? 998 : 999) - (b.centro ? ordenCentro.get(b.centro) ?? 998 : 999))
    || a.titulo.localeCompare(b.titulo));
}
