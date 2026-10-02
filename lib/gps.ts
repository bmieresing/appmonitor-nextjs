// GPS de los camiones (Pegasus) en la vista Mapa y el Carrusel: aritmética de las
// trazas y el ícono del camión. Lo comparten MapaLocales (recorrido completo +
// posición actual) y MapaRecorrido (recorrido hasta el reloj de la reproducción).
//
// Las trazas llegan por useGps(), indexadas por patente NORMALIZADA; cada punto es
// un reporte crudo del dispositivo: [minutos desde 00:00 hora Chile, lat, lon],
// ordenados por la hora del GPS (ver types.ts).
import type { Gps, PuntoGps, TrazaGps } from "./types";
import { hhmm, duracion } from "./tiempo";

/** Minutos sin reportar a partir de los cuales la posición deja de ser "actual" y
 *  el camión se dibuja atenuado. Tiene que pasar la hora: un camión DETENIDO
 *  reporta una vez por hora (traza del VLSK54: 00:50, 01:50, 02:53…), y con menos
 *  se vería desactualizado un camión que solo está estacionado. */
export const VIGENCIA_MIN = 70;

/** Patente comparable: mayúsculas, sin espacios, guiones ni puntos. Es la misma
 *  normalización que hace el Lambda GPS (pegasus.normalizar_patente) al guardar. */
export function normalizarPatente(p: string | null | undefined): string {
  return (p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** La traza de una ruta, o null si su camión no tiene GPS hoy. */
export function trazaDe(gps: Gps, patente: string | null | undefined): TrazaGps | null {
  const clave = normalizarPatente(patente);
  if (!clave) return null;
  const t = gps[clave];
  return t && t.puntos.length > 0 ? t : null;
}

/** Cuántos puntos de la traza ocurrieron hasta `minuto` (búsqueda binaria: se
 *  llama en cada tick de la reproducción, por cada panel de la grilla). */
export function puntosHasta(puntos: PuntoGps[], minuto: number): number {
  let lo = 0, hi = puntos.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (puntos[mid][0] <= minuto) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Hueco máximo entre dos puntos, en minutos, sobre el que se interpola. En ruta
 *  el dispositivo reporta cada pocos segundos; un hueco más largo es un camión
 *  detenido (reporta una vez por hora) o sin señal, y ahí deslizarlo inventaría un
 *  camino: se queda en el último punto conocido hasta el siguiente. Cuando el GPS
 *  recupera la señal rellena lo que faltaba, y esos puntos llenan el hueco. */
export const INTERPOLA_MAX_MIN = 5;

/** Dónde iba el camión en `minuto` (fraccionario): entre el último punto ocurrido y
 *  el siguiente, en proporción al tiempo. Es lo que hace que se deslice en vez de
 *  saltar de minuto en minuto. null antes del primer punto del día. */
export function posicionEn(puntos: PuntoGps[], minuto: number, n = puntosHasta(puntos, minuto)): [number, number] | null {
  if (n === 0) return null;
  const a = puntos[n - 1];
  const b = puntos[n];
  if (!b || b[0] - a[0] > INTERPOLA_MAX_MIN || b[0] <= a[0]) return [a[1], a[2]];
  const f = Math.min(1, Math.max(0, (minuto - a[0]) / (b[0] - a[0])));
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Distancia desde donde el camión amaneció a partir de la cual se considera que
 *  SALIÓ. Medido sobre la traza real del VLSK54 (2026-10-02): detenido, las
 *  coordenadas son idénticas (0 m entre puntos); a las 07:32 hizo una maniobra de
 *  77 m sin salir de donde durmió, y a las 08:29 ya estaba a 214 m y siguió (1,4 km
 *  a las 08:33). 200 m deja afuera las maniobras de patio y toma la salida real. */
export const SALIDA_M = 200;

/** Metros entre dos puntos (haversine). */
function metros(a: PuntoGps, b: PuntoGps): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[2] - a[2]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Minuto en que el camión empezó a moverse: el último reporte antes del primero
 *  que queda a más de SALIDA_M de donde amaneció (el primer punto del día). En
 *  movimiento los reportes van cada pocos segundos, así que ese es el arranque; si
 *  el anterior es de hace más de INTERPOLA_MAX_MIN (detenido, reporta por hora), se
 *  toma el que ya cruzó. null si no hay traza o si todavía no salió. */
export function inicioMovimiento(puntos: PuntoGps[] | null | undefined): number | null {
  if (!puntos || puntos.length === 0) return null;
  const origen = puntos[0];
  for (let i = 1; i < puntos.length; i++) {
    const p = puntos[i];
    if (metros(origen, p) > SALIDA_M) {
      const prev = puntos[i - 1];
      return p[0] - prev[0] <= INTERPOLA_MAX_MIN ? prev[0] : p[0];
    }
  }
  return null;
}

/** Último reporte del día, o null sin GPS. La reproducción termina en el más
 *  tardío entre esto y la última visita: lo que el camión hizo después de su
 *  último local también es parte del recorrido. */
export function finTraza(puntos: PuntoGps[] | null | undefined): number | null {
  return puntos && puntos.length > 0 ? puntos[puntos.length - 1][0] : null;
}

/** Une puntos nuevos a una traza ordenada sin duplicar (los ciclos de lectura se
 *  solapan) y la reordena si alguno llegó atrasado (relleno tras perder señal).
 *  Devuelve la misma traza si no entró nada: así no se rehace ningún mapa. */
export function unirPuntos(actual: PuntoGps[] | undefined, nuevos: PuntoGps[]): PuntoGps[] {
  if (!actual || actual.length === 0) return nuevos;
  const vistos = new Set(actual.map((p) => p[0]));
  const agregados = nuevos.filter((p) => !vistos.has(p[0]));
  if (agregados.length === 0) return actual;
  // Lo normal es que lo nuevo vaya después de lo que ya había (la función de
  // lectura lo manda ordenado): se concatena tal cual. Solo un relleno atrasado
  // obliga a reordenar.
  const ultimo = actual[actual.length - 1][0];
  const unidos = actual.concat(agregados);
  return agregados[0][0] >= ultimo ? unidos : unidos.sort((a, b) => a[0] - b[0]);
}

/** Minutos desde medianoche de ahora, en la hora del navegador (la misma
 *  convención que ventanaDe en tiempo.ts: el monitor se mira desde Chile). */
export function minutoAhora(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** Texto del último reporte: "16:53 · hace 2 min". */
export function textoUltimo(ultimo: PuntoGps, ahora: number): string {
  const hace = Math.max(0, ahora - ultimo[0]);
  return `${hhmm(ultimo[0])} · ${hace < 1 ? "recién" : `hace ${duracion(hace)}`}`;
}

export function vigente(ultimo: PuntoGps, ahora: number): boolean {
  return ahora - ultimo[0] <= VIGENCIA_MIN;
}

// Ícono del camión: círculo con borde blanco y sombra (se recorta contra cualquier
// fondo, como los pines), con la silueta de un camión adentro. Es redondo y no una
// gota a propósito: no marca un local, marca dónde ESTÁ el vehículo.
export const CAMION_D = 26;

export function camionSvg(color: string): string {
  return (
    `<svg width="${CAMION_D}" height="${CAMION_D}" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="13" cy="13" r="11.6" fill="${color}" stroke="#ffffff" stroke-width="1.8"/>` +
    // caja + cabina + ruedas
    `<path d="M6.2 9.2h8.4v6.6H6.2z M14.6 11.4h2.9l2.3 2.5v1.9h-5.2z" fill="#ffffff"/>` +
    `<circle cx="9" cy="16.6" r="1.55" fill="#ffffff" stroke="${color}" stroke-width=".9"/>` +
    `<circle cx="17.2" cy="16.6" r="1.55" fill="#ffffff" stroke="${color}" stroke-width=".9"/>` +
    `</svg>`
  );
}

export function popupCamion(patente: string, ultimo: PuntoGps, ahora: number): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  return (
    `<div class="mapa-pop">` +
    `<div class="mapa-pop-tit">🚚 ${esc(patente)}</div>` +
    `<div class="mapa-pop-row"><span>Último reporte</span><b>${textoUltimo(ultimo, ahora)}</b></div>` +
    (vigente(ultimo, ahora) ? "" : `<div class="mapa-pop-id">Sin reportar hace más de ${VIGENCIA_MIN} min</div>`) +
    `</div>`
  );
}
