// Estadísticas de asignación: qué le tocó hoy a cada chofer —cuántos locales y
// cuántos de prioridad Alta— y cuántos litros se esperan de esa asignación.
//
// Sale del mismo `carrusel[]` del snapshot que alimenta el resto del dashboard: no
// hay datos nuevos ni una consulta aparte. La granularidad por local está en
// `detalle[]` (una fila por local de la ruta, con su prioridad); los `sub_*` son el
// plan B para snapshots viejos, que traían los totales solo dentro de esos textos.

import { esperadoDeSub, totalDeSub } from "@/lib/cards";
import type { CarruselChofer } from "@/lib/types";

export interface FilaAsignacion {
  chofer: string;
  ruta: string | null;
  centro?: string;
  locales: number;      // locales asignados hoy
  altas: number;        // de esos, los de prioridad Alta
  pctAltas: number;     // altas sobre el total asignado
  esperado: number;     // litros esperados (promedio histórico del chofer)
  litros: number;       // litros recolectados hasta ahora
  pctLit: number;       // avance de litros sobre lo esperado (el % del balde 💧)
  promLocal: number;    // litros esperados por local asignado
  promAlta: number;     // litros esperados por local de prioridad Alta
  // La tarjeta de origen: la tabla muestra al lado el estado actual del chofer con
  // los mismos baldes de las cards, y esos porcentajes ya vienen calculados acá. Se
  // pasa la tarjeta entera y no una copia de sus nueve campos, que se desincronizaría.
  tarjeta: CarruselChofer;
}

/** Prioridad Alta tal como la escribe LocalesRuta ("Alta", "ALTA", "alta 1"…). */
function esAlta(prioridad: string): boolean {
  return prioridad.trim().toUpperCase().startsWith("ALTA");
}

export function asignacionPorChofer(
  carrusel: CarruselChofer[],
  centroDe: (tripulacion: string | null | undefined) => string | undefined,
): FilaAsignacion[] {
  return carrusel.map((c) => {
    const det = c.detalle ?? [];
    const locales = det.length > 0 ? det.length : totalDeSub(c.sub_loc);
    const altas = det.length > 0 ? det.filter((d) => esAlta(d.prioridad)).length : totalDeSub(c.sub_alta);
    const esperado = esperadoDeSub(c.sub_lit);
    return {
      chofer: c.chofer,
      ruta: c.ruta,
      centro: centroDe(c.tripulacion),
      locales,
      altas,
      pctAltas: locales > 0 ? Math.round((altas / locales) * 100) : 0,
      esperado,
      litros: c.litros_tot,
      pctLit: c.pct_lit,
      promLocal: locales > 0 ? esperado / locales : 0,
      promAlta: altas > 0 ? esperado / altas : 0,
      tarjeta: c,
    };
  });
}

export interface TotalesAsignacion {
  choferes: number;
  locales: number;
  altas: number;
  pctAltas: number;
  esperado: number;
  promLocal: number;
  promAlta: number;
}

/**
 * Totales de lo filtrado. Los promedios se calculan sobre los totales y NO como
 * promedio de los promedios de cada chofer: un chofer con 3 locales pesaría lo mismo
 * que uno con 40 y el número dejaría de ser "cuántos litros se esperan por local".
 */
export function totalesAsignacion(filas: FilaAsignacion[]): TotalesAsignacion {
  const locales = filas.reduce((a, f) => a + f.locales, 0);
  const altas = filas.reduce((a, f) => a + f.altas, 0);
  const esperado = filas.reduce((a, f) => a + f.esperado, 0);
  return {
    choferes: filas.length,
    locales,
    altas,
    pctAltas: locales > 0 ? Math.round((altas / locales) * 100) : 0,
    esperado,
    promLocal: locales > 0 ? esperado / locales : 0,
    promAlta: altas > 0 ? esperado / altas : 0,
  };
}
