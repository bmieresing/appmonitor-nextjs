// Partición Norte / Sur de los choferes de Regiones. La comparten el Carrusel Zonas
// —que las alterna solas— y la vista Regiones, donde se eligen a mano junto con
// "Todos".
//
// El corte sale del mismo lugar que los tabs de la vista Mapa: el `orden` de
// monitor_zona_map (`tramosPorCentro`), así que agregar un centro es darle su orden
// en Parámetros y no tocar código. Lo que no cae en Sur va a Norte —incluido el
// chofer cuya tripulación todavía no mapea a ningún centro—: en estas vistas no
// puede quedar nadie afuera.

import { conSinLocalesAlFinal } from "@/lib/cards";
import { tramosPorCentro } from "@/lib/mapa";
import type { Tokens } from "@/lib/theme";
import type { Card, ZonaMapRowLike } from "@/lib/types";

export const MITADES = ["Norte", "Sur"] as const;
export type Mitad = (typeof MITADES)[number];

/** Ícono de cada mitad: el norte del país es el desierto y el sur, el frío. */
export const ICONO_MITAD: Record<Mitad, string> = { Norte: "☀️", Sur: "❄️" };

/**
 * Temperatura de color por mitad: el norte en cálido (coral) y el sur en frío (azul
 * petróleo). Salen de los tokens del tema, así que acompañan al modo claro/oscuro;
 * el semáforo no se toca, esto es identidad de la mitad y no estado.
 */
export function colorMitad(m: Mitad, t: Tokens): string {
  return m === "Norte" ? t.serious : t.accent2;
}

export function agruparMitades(
  cards: Card[],
  centroDe: (tripulacion: string | null | undefined) => string | undefined,
  zonaMap: ZonaMapRowLike[],
): Record<Mitad, Card[]> {
  const tramos = tramosPorCentro(zonaMap);
  const out: Record<Mitad, Card[]> = { Norte: [], Sur: [] };
  for (const c of cards) {
    const centro = centroDe(c.tripulacion);
    out[tramos.get(centro ?? "") === "Sur" ? "Sur" : "Norte"].push(c);
  }
  // Los sin locales al final de SU mitad, igual que en la vista Regiones.
  return { Norte: conSinLocalesAlFinal(out.Norte), Sur: conSinLocalesAlFinal(out.Sur) };
}
