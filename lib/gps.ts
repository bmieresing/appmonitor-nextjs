// GPS de los camiones (Pegasus) en la vista Mapa y el Carrusel: aritmética de las
// trazas y el ícono del camión. Lo comparten MapaLocales (recorrido completo +
// posición actual) y MapaRecorrido (recorrido hasta el reloj de la reproducción).
//
// Las trazas llegan por useGps(), indexadas por patente NORMALIZADA; cada punto es
// un reporte crudo del dispositivo: [minutos desde 00:00 hora Chile, lat, lon],
// ordenados por la hora del GPS (ver types.ts).
import type { AlarmaGps, DetencionGps, GeocercaGps, Gps, PuntoGps, TramoMotor, TrazaGps } from "./types";
import { aMinutos, hhmm, duracion } from "./tiempo";

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

/** Kilómetros recorridos desde el primer reporte del día hasta `minuto`, según el
 *  odómetro del equipo (último − primero con odómetro). null si la traza todavía
 *  no trae odómetro: puntos guardados antes de que el Lambda lo pidiera, o días
 *  del historial anteriores. No se suma la distancia entre puntos: el filtro de
 *  calidad y los cortes de señal la dejarían corta. */
export function kmHasta(puntos: PuntoGps[] | null | undefined, minuto: number): number | null {
  const o = odometroHasta(puntos, minuto);
  return o === null ? null : Math.max(0, o.fin - o.ini);
}

// ── Detenciones (tramos detenidos de Pegasus) ───────────────────────────────
// Salen solo del GPS y NO se asocian a un local: la hora de la visita es la del
// registro en la app (el chofer puede cargarla después) y hay locales mal
// geolocalizados. Una detención en curso trae `hasta` = null: termina en `ahora`.

/** Las detenciones a mostrar, con sus tramos de motor: sin la de la noche anterior
 *  (`previo`), que es el camión estacionado antes de salir y no dice nada de la
 *  jornada. */
export function detencionesDelDia(traza: TrazaGps | null | undefined): DetencionGps[] {
  const conMotor = !!traza?.puntos.some((p) => p[4] != null);
  return (traza?.detenciones ?? []).filter((d) => !d.previo).map((d) => {
    if (!conMotor) return d;
    const tramos = tramosMotor(traza!.puntos, d.desde, d.hasta ?? 1440);
    return cuadraMotor(d, tramos) ? { ...d, tramos } : { ...d, motorNoCuadra: true };
  });
}

/** ¿Los tramos de los eventos cuadran con el total de motor encendido que mide
 *  Pegasus? Si el equipo no mandó un apagado (VLSK54, 23-10, 12:20–12:29: los
 *  eventos daban 566 s y Pegasus 45 s), el detalle mentiría: no se dibuja. Solo se
 *  compara una detención cerrada dentro del día; la en curso no tiene total todavía
 *  y la que cruza la medianoche lo trae hasta la mañana siguiente. Tolerancia: 1 min
 *  o el 20 %. En las otras 9 del 23-10 cuadraron al segundo. */
function cuadraMotor(d: DetencionGps, tramos: TramoMotor[]): boolean {
  if (d.hasta === null || d.hasta >= 1440 || d.motor_min === null) return true;
  const enc = tramos.reduce((s, t) => s + (t.encendido === true ? t.fin - t.ini : 0), 0);
  return Math.abs(enc - d.motor_min) <= Math.max(1, d.motor_min * 0.2);
}

/** Tramos de motor encendido / apagado entre `desde` y `hasta`, armados con los
 *  eventos de encendido y apagado (5º valor del punto). El estado al empezar es el
 *  del último evento anterior; sin ninguno, el primer tramo queda sin dato (null).
 *  Verificado contra Pegasus (VLSK54, 23-10, detención 09:13–10:48): la suma de los
 *  tramos encendidos da los mismos 481 s que su `ignition`. */
export function tramosMotor(puntos: PuntoGps[], desde: number, hasta: number): TramoMotor[] {
  if (hasta <= desde) return [];
  const n0 = puntosHasta(puntos, desde);
  let estado: boolean | null = null;
  for (let i = n0 - 1; i >= 0 && estado === null; i--) estado = puntos[i][4] ?? null;
  const tramos: TramoMotor[] = [];
  let ini = desde;
  for (let i = n0; i < puntos.length && puntos[i][0] < hasta; i++) {
    const m = puntos[i][4];
    if (m == null || m === estado) continue;
    if (puntos[i][0] > ini) tramos.push({ ini, fin: puntos[i][0], encendido: estado });
    ini = puntos[i][0];
    estado = m;
  }
  tramos.push({ ini, fin: hasta, encendido: estado });
  return tramos;
}

/** Tramos con el motor encendido de una detención, recortados a [desde, hasta]. */
export function encendidosEn(d: DetencionGps, desde: number, hasta: number): TramoMotor[] {
  return (d.tramos ?? [])
    .filter((t) => t.encendido === true && t.fin > desde && t.ini < hasta)
    .map((t) => ({ ini: Math.max(desde, t.ini), fin: Math.min(hasta, t.fin), encendido: true }));
}

/** Minutos detenido con el motor encendido entre `desde` y `hasta`. null si ninguna
 *  detención trae tramos (puntos guardados antes del 2026-10-26). */
export function minutosEncendido(dets: DetencionGps[], desde: number, hasta: number): number | null {
  if (!dets.some((d) => d.tramos)) return null;
  let total = 0;
  for (const d of dets) {
    if (d.tramos) {
      for (const t of encendidosEn(d, Math.max(desde, d.desde), Math.min(hasta, finDetencion(d, hasta)))) total += t.fin - t.ini;
    } else if (d.motor_min !== null && d.desde >= desde && finDetencion(d, hasta) <= hasta) {
      total += d.motor_min;   // sin detalle (no cuadró): el total, una vez que terminó
    }
  }
  return total;
}

export function finDetencion(d: DetencionGps, ahora: number): number {
  return Math.min(1440, d.hasta ?? Math.max(d.desde, ahora));
}

/** Minutos detenido entre `desde` y `hasta` (lo que se solapa con cada detención). */
export function minutosDetenido(dets: DetencionGps[], desde: number, hasta: number): number {
  let total = 0;
  for (const d of dets) {
    const ini = Math.max(desde, d.desde), fin = Math.min(hasta, finDetencion(d, hasta));
    if (fin > ini) total += fin - ini;
  }
  return total;
}

/** Detalle de una detención para el tooltip: "Detenido 1 h 35 min · 09:13–10:48" y,
 *  con tramos de motor, cuándo estuvo encendido ("motor encendido 8 min: 09:13–09:15 ·
 *  10:41–10:42"). Sin tramos (días anteriores), el total que da Pegasus. */
export function textoDetencion(d: DetencionGps, ahora: number): string {
  const fin = finDetencion(d, ahora);
  const tramo = d.hasta === null ? `desde ${hhmm(d.desde)} · sigue detenido` : `${hhmm(d.desde)}–${hhmm(fin)}`;
  let motor = "";
  if (d.tramos) {
    const enc = encendidosEn(d, d.desde, fin).filter((t) => t.fin - t.ini >= 0.5);
    const total = enc.reduce((s, t) => s + (t.fin - t.ini), 0);
    const lista = enc.slice(0, 4).map((t) => `${hhmm(t.ini)}–${hhmm(t.fin)}`).join(" · ") + (enc.length > 4 ? " …" : "");
    motor = total >= 1 ? `\nmotor encendido ${duracion(total)}: ${lista}` : "\nmotor apagado";
  } else if (d.motor_min !== null && d.motor_min >= 1) {
    motor = `\nmotor encendido ${duracion(d.motor_min)} en total (sin detalle de cuándo)`;
  } else if (d.motor_min !== null) {
    motor = d.motor_min > 0 ? "\nmotor encendido menos de 1 min" : "\nmotor apagado";
  }
  return `Detenido ${duracion(Math.max(1, fin - d.desde))} · ${tramo}${motor}`;
}

/** Lectura del odómetro del equipo, en km: la del primer reporte del día y la del
 *  último hasta `minuto` (antes del primer reporte, la misma inicial). null si la
 *  traza no trae odómetro. */
export function odometroHasta(puntos: PuntoGps[] | null | undefined, minuto: number): { ini: number; fin: number } | null {
  if (!puntos || puntos.length === 0) return null;
  let ini: number | null = null;
  for (const p of puntos) if (p[3] != null) { ini = p[3]; break; }
  if (ini === null) return null;
  let fin: number | null = null;
  for (let i = puntosHasta(puntos, minuto) - 1; i >= 0 && fin === null; i--) fin = puntos[i][3] ?? null;
  return { ini: ini / 1000, fin: (fin ?? ini) / 1000 };
}

/** Primer reporte del día, o null sin GPS. Es el inicio de la reproducción de un
 *  camión que no salió (inicioMovimiento = null) y no tiene visitas: igual hay un
 *  día de reportes que mirar, aunque sea en el patio. */
export function inicioTraza(puntos: PuntoGps[] | null | undefined): number | null {
  return puntos && puntos.length > 0 ? puntos[0][0] : null;
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

/** "Ahora" de un día del historial: se mira como si fueran las 23:59 de ese día,
 *  así el camión y su "hace X min" quedan como estaban al cierre. */
export const CIERRE_DIA = 24 * 60 - 1;

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

/** "Entra a <geocerca>" / "Sale de <geocerca>", o null si la alarma no es de geocerca.
 *  Texto plano: quien lo pinte en HTML crudo lo escapa. */
export function textoGeocerca(a: AlarmaGps, geocercas: GeocercaGps[]): string | null {
  if (!a.evento || a.geocerca == null) return null;
  const g = geocercas.find((x) => x.id === a.geocerca);
  return `${a.evento === "entra" ? "Entra a" : "Sale de"} ${g?.nombre ?? `geocerca ${a.geocerca}`}`;
}

/** Nombre del chofer de cada camión del día, por patente normalizada (del snapshot). */
export function choferesPorPatente(carrusel: { chofer: string; patente?: string | null }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of carrusel) {
    const p = normalizarPatente(c.patente);
    if (p && !m.has(p)) m.set(p, c.chofer);
  }
  return m;
}

/** Alarma del GPS con su minuto del día (hora Chile), para ubicarla en el reloj de
 *  la reproducción y en la línea de tiempo. */
export type AlarmaEnRuta = AlarmaGps & { min: number };

/** Las alarmas del camión de una ruta (por patente normalizada), en orden de hora.
 *  Sin patente, ninguna: la pestaña Global no tiene camión. */
export function alarmasDeRuta(alarmas: AlarmaGps[], patente: string | null | undefined): AlarmaEnRuta[] {
  const pat = normalizarPatente(patente);
  if (!pat) return [];
  const salida: AlarmaEnRuta[] = [];
  for (const a of alarmas) {
    const min = aMinutos(a.hora);
    if (min !== null && normalizarPatente(a.patente) === pat) salida.push({ ...a, min });
  }
  return salida.sort((x, y) => x.min - y.min);
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
