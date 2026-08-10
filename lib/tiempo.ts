// Derivados temporales de las rutas del día.
//
// El snapshot trae la hora de cada visita en `carrusel[].detalle[].hora` ("HH:MM",
// hora Chile), que el publisher saca de VistaMonitor.FechaVisita — el momento en
// que la app del chofer registró la visita. Con eso las rutas dejan de responder
// solo DÓNDE y responden también CUÁNDO: la línea de tiempo (vista Mapa y también
// el carrusel, para el chofer que se está mostrando) y la reproducción del
// recorrido sobre el mapa.
//
// Acá vive solo la aritmética (parseo, ventana, huecos); el render está en
// TimelineRutas / ReproduccionRutas. No viaja ni un dato nuevo en el JSON más allá
// del campo `hora`.
import type { PuntoMapa } from "./mapa";

/** Hueco entre dos visitas consecutivas a partir del cual la fila lo marca, en
 *  minutos. Una ruta normal encadena locales cada 15-30 min; media hora larga sin
 *  registrar ya es algo que el operador quiere ver (traslado largo, colación,
 *  problema). Es un umbral operativo: calibrarlo acá lo cambia en toda la vista. */
export const GAP_MIN = 45;

/** "HH:MM" → minutos desde medianoche. null si el local todavía no se visitó. */
export function aMinutos(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hora);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutos desde medianoche → "HH:MM". */
export function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "1 h 20 min" · "45 min". Para los huecos entre visitas. */
export function duracion(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// ── Ventana horaria ──────────────────────────────────────────────────────
// El eje no es el día completo: arranca en la primera visita y termina en la
// última, redondeado a horas enteras. A media mañana eso mantiene los puntos
// separados, en vez de aplastarlos contra el borde izquierdo de un eje 00-24.

export interface Ventana {
  desde: number;    // minuto del borde izquierdo (hora entera)
  hasta: number;    // minuto del borde derecho (hora entera)
  horas: number[];  // marcas del eje, en minutos (una por hora)
}

/** Ventana que cubre todas las visitas, con un ancho mínimo de `minHoras` para
 *  que un día recién empezado no quede comprimido en unos pocos píxeles. */
export function ventanaDe(minutos: number[], minHoras = 4): Ventana {
  const ahora = new Date();
  const fin = ahora.getHours() * 60 + ahora.getMinutes();
  const base = minutos.length > 0 ? minutos : [Math.max(0, fin - minHoras * 60), fin];
  let desde = Math.floor(Math.min(...base) / 60) * 60;
  // El borde derecho es la hora SIGUIENTE a la última visita, no su techo: con
  // `ceil`, una visita a las 12:00 en punto cerraría el eje justo encima de ella y
  // quedaría pegada al borde, sin lugar donde leerse.
  let hasta = Math.floor(Math.max(...base) / 60) * 60 + 60;
  // Ancho mínimo: se crece hacia la derecha, y solo hacia atrás si topa con las 24 h.
  if (hasta - desde < minHoras * 60) {
    hasta = Math.min(24 * 60, desde + minHoras * 60);
    desde = Math.max(0, hasta - minHoras * 60);
  }
  const horas: number[] = [];
  for (let m = desde; m <= hasta; m += 60) horas.push(m);
  return { desde, hasta, horas };
}

/** Posición 0-100 de un minuto dentro de la ventana (para el CSS del track). */
export function posicion(min: number, v: Ventana): number {
  const ancho = v.hasta - v.desde;
  if (ancho <= 0) return 0;
  return ((min - v.desde) / ancho) * 100;
}

// ── Filas de la línea de tiempo ──────────────────────────────────────────

export interface EventoVisita {
  punto: PuntoMapa;
  min: number;          // hora de la visita, en minutos
  gapPrevio: number;    // minutos desde la visita anterior de la misma ruta (0 la primera)
}

/** Lo mínimo que necesita una ruta para entrar en la línea de tiempo. `Panel` (la
 *  vista Mapa) lo cumple tal cual; el carrusel arma uno con el chofer que está
 *  mostrando, y así las dos vistas comparten el mismo render sin acoplarse. */
export interface RutaTiempo {
  id: string;
  titulo: string;              // chofer
  subtitulo: string | null;    // su ruta
  centro?: string;             // centro de acopio (color del recuadro)
  pct: number;                 // avance de la ruta
  puntos: PuntoMapa[];
}

export interface FilaTiempo {
  ruta: RutaTiempo;
  eventos: EventoVisita[];   // ordenados por hora
  primera: number | null;
  ultima: number | null;
  gapMax: number;            // hueco más largo entre dos visitas consecutivas
  gapMaxDesde: number | null; // minuto en que arranca ese hueco
  sinHora: number;           // locales de la ruta todavía sin visitar
}

/** Una fila por ruta, con sus visitas ordenadas en el tiempo y sus huecos.
 *  Conserva el orden recibido (en la vista Mapa: centro norte→sur, después chofer). */
export function filasTiempo(rutas: RutaTiempo[]): FilaTiempo[] {
  return rutas.map((ruta) => {
    const conHora: { punto: PuntoMapa; min: number }[] = [];
    let sinHora = 0;
    for (const punto of ruta.puntos) {
      const min = aMinutos(punto.hora);
      if (min === null) sinHora++;
      else conHora.push({ punto, min });
    }
    conHora.sort((a, b) => a.min - b.min);

    let gapMax = 0;
    let gapMaxDesde: number | null = null;
    const eventos: EventoVisita[] = conHora.map((e, i) => {
      const gapPrevio = i === 0 ? 0 : e.min - conHora[i - 1].min;
      if (gapPrevio > gapMax) {
        gapMax = gapPrevio;
        gapMaxDesde = conHora[i - 1].min;
      }
      return { ...e, gapPrevio };
    });

    return {
      ruta,
      eventos,
      primera: eventos.length > 0 ? eventos[0].min : null,
      ultima: eventos.length > 0 ? eventos[eventos.length - 1].min : null,
      gapMax,
      gapMaxDesde,
      sinHora,
    };
  });
}

/** ¿Hay al menos una visita con hora? Un snapshot de un Lambda anterior a este
 *  cambio no trae `hora` en ningún local y las vistas temporales no tienen qué
 *  mostrar. */
export function sinSoporteHora(puntos: PuntoMapa[]): boolean {
  return puntos.length > 0 && puntos.every((p) => p.hora === undefined);
}
