// Utilidades de las cards de chofer compartidas por las vistas que las listan
// (Regiones, las mitades Norte/Sur del Carrusel Zonas y las pestañas del Carrusel).

import type { Card, CarruselChofer } from "@/lib/types";

/**
 * Chofer de la planilla que hoy no tiene locales asignados. El publisher los emite
 * igual: `sub_loc` en null en las cards (ver `_cards()` en compute.py, paso 2) y
 * "—" en las tarjetas del carrusel. Su card no tiene nada que mostrar en locales.
 */
export function sinLocales(c: Pick<Card, "sub_loc">): boolean {
  return !c.sub_loc || c.sub_loc === "—";
}

/**
 * Aviso de la card (chofer o centro). Dos cosas distintas con la misma marca:
 *
 *   · "alert" — con ruta asignada y sin una sola visita registrada. Es lo más grave
 *     que puede decir la card: no arrancó.
 *   · "alert" — el % de prioridad Alta dobla al % de litros (o no hay litros): se
 *     cubrieron los locales importantes y los litros no acompañaron.
 *   · "warn"  — el % de Alta apenas supera al de litros.
 *
 * Nunca marca a quien no tiene locales asignados hoy: ese no trabaja, no es que
 * esté mal. Tampoco compara Alta contra litros si falta alguno de los dos lados
 * (ruta sin locales Alta, o chofer sin litros esperados: ahí el % de litros es 0
 * por definición y saldrían todos marcados).
 */
export type Desbalance = "" | "warn" | "alert";

export interface DatosAviso {
  hayLocales: boolean;   // tiene locales asignados hoy
  pctLoc: number;        // % de locales realizados
  pctAlta: number;       // % de locales de prioridad Alta realizados
  pctLit: number;        // % de litros sobre lo esperado
  hayAlta: boolean;      // la ruta tiene locales de prioridad Alta
  hayEsperado: boolean;  // hay litros esperados contra los que comparar
}

/**
 * Litros esperados de una tarjeta del carrusel. No viajan como número: están dentro
 * de `sub_lit`, que es "530 / 962 L" cuando hay con qué comparar y "530 L" cuando el
 * chofer no está en la planilla. El separador de miles es el chileno (punto).
 */
export function esperadoDeSub(subLit: string | null | undefined): number {
  const m = (subLit ?? "").match(/\/\s*([\d.]+)/);
  return m ? Number(m[1].replace(/\./g, "")) : 0;
}

/** Denominador de un sub tipo "12/33" (realizados/total). 0 si no tiene esa forma. */
export function totalDeSub(sub: string | null | undefined): number {
  const m = (sub ?? "").match(/\/\s*([\d.]+)/);
  return m ? Number(m[1].replace(/\./g, "")) : 0;
}

/** Los mismos datos del aviso, sacados de una tarjeta del carrusel. */
export function avisoDeCarrusel(c: CarruselChofer): DatosAviso {
  const esperado = esperadoDeSub(c.sub_lit);
  return {
    hayLocales: !sinLocales(c),
    pctLoc: c.pct_loc,
    pctAlta: c.pct_alta,
    pctLit: c.pct_lit,
    hayAlta: c.tiene_alta,
    hayEsperado: esperado > 0,
  };
}

export function desbalance(d: DatosAviso): Desbalance {
  if (!d.hayLocales) return "";                       // no trabaja hoy
  if (d.pctLoc <= 0) return "alert";                  // ruta asignada y cero visitas
  if (!d.hayAlta || !d.hayEsperado) return "";
  if (d.pctLit <= 0 || d.pctAlta > d.pctLit * 2) return "alert";
  if (d.pctAlta > d.pctLit) return "warn";
  return "";
}
