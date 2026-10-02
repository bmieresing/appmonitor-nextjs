// GPS de los camiones (Pegasus) en la vista Mapa: aritmética de las trazas y el
// ícono del camión. Lo comparten el modo Mapas (MapaLocales: recorrido completo +
// posición actual) y la Reproducción (MapaRecorrido: recorrido hasta el reloj).
//
// Las trazas llegan por useGps(), indexadas por patente; cada punto es
// [minutos desde 00:00 hora Chile, lat, lon], ordenados por hora (ver types.ts).
import type { Gps, PuntoGps, TrazaGps } from "./types";
import { hhmm, duracion } from "./tiempo";

/** Minutos sin reportar a partir de los cuales la posición deja de ser "actual" y
 *  el camión se dibuja atenuado. Un camión en movimiento reporta cada pocos
 *  segundos y uno detenido, una vez por hora; el GPS además llega con el snapshot
 *  (cada 5 min), así que por debajo de esto no se distingue nada. */
export const VIGENCIA_MIN = 15;

/** La traza de una ruta, o null si su camión no tiene GPS hoy. */
export function trazaDe(gps: Gps, patente: string | null | undefined): TrazaGps | null {
  if (!patente) return null;
  const t = gps[patente];
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
