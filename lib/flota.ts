// Pestaña Flota (Reportes): un resumen por CAMIÓN del día — km y odómetro del GPS,
// y lo recolectado por sus rutas. Aritmética pura; el render está en app/flota.
//
// El cruce ruta → camión es por patente normalizada, como en el resto del GPS: el
// snapshot trae la `patente` de cada chofer (la que usó hoy) y el odómetro viene por
// patente (rpc odometro_del_dia). Un camión con GPS sin ruta del día sale solo con
// sus km; una ruta sin patente conocida va a "Sin camión identificado", para que la
// suma de las tarjetas dé el total de arriba.
import { normalizarPatente } from "./gps";
import type { CarruselChofer, OdometroCamion } from "./types";

/** Lo que NO cuenta como litros recolectados: la misma regla que el publisher
 *  (EXCLUIR_LITROS en compute.py). El desengrasante se muestra aparte. */
export const EXCLUIR_LITROS = new Set(["Latas", "Desengrasante"]);
export const DESENGRASANTE = "Desengrasante";
export const SIN_CAMION = "";

export interface FilaFlota {
  patente: string;                 // normalizada; SIN_CAMION para las rutas sin patente
  choferes: { chofer: string; ruta: string | null }[];
  odometro: OdometroCamion | null; // null = sin GPS ese día
  litros: number;                  // todos los productos menos latas y desengrasante
  desengrasante: number;
  productos: { producto: string; litros: number }[];   // de mayor a menor, sin latas
}

export interface ResumenFlota {
  filas: FilaFlota[];
  km: number;
  litros: number;
  desengrasante: number;
  conGps: number;                  // camiones con odómetro ese día
}

export function resumenFlota(carrusel: CarruselChofer[], odometros: OdometroCamion[]): ResumenFlota {
  const porPatente = new Map<string, FilaFlota>();
  const fila = (patente: string): FilaFlota => {
    let f = porPatente.get(patente);
    if (!f) {
      f = { patente, choferes: [], odometro: null, litros: 0, desengrasante: 0, productos: [] };
      porPatente.set(patente, f);
    }
    return f;
  };

  for (const o of odometros) fila(normalizarPatente(o.patente)).odometro = o;

  for (const c of carrusel) {
    const f = fila(normalizarPatente(c.patente) || SIN_CAMION);
    f.choferes.push({ chofer: c.chofer, ruta: c.ruta });
    for (const p of c.productos ?? []) {
      const litros = Number(p.Litros) || 0;
      if (litros <= 0) continue;
      if (p.Producto === DESENGRASANTE) f.desengrasante += litros;
      if (EXCLUIR_LITROS.has(p.Producto)) continue;
      f.litros += litros;
      const prev = f.productos.find((x) => x.producto === p.Producto);
      if (prev) prev.litros += litros; else f.productos.push({ producto: p.Producto, litros });
    }
  }

  const filas = [...porPatente.values()]
    // Sin camión: solo si alguna ruta sin patente recolectó algo.
    .filter((f) => f.patente !== SIN_CAMION || f.litros > 0 || f.desengrasante > 0)
    .map((f) => ({ ...f, productos: f.productos.sort((a, b) => b.litros - a.litros) }))
    // Primero los camiones con ruta (más litros arriba), después los que solo
    // tienen GPS (más km arriba) y al final las rutas sin camión.
    .sort((a, b) =>
      Number(a.patente === SIN_CAMION) - Number(b.patente === SIN_CAMION)
      || Number(a.choferes.length === 0) - Number(b.choferes.length === 0)
      || b.litros - a.litros
      || (b.odometro?.km ?? 0) - (a.odometro?.km ?? 0));

  return {
    filas,
    km: filas.reduce((s, f) => s + (f.odometro?.km ?? 0), 0),
    litros: filas.reduce((s, f) => s + f.litros, 0),
    desengrasante: filas.reduce((s, f) => s + f.desengrasante, 0),
    conGps: filas.filter((f) => f.odometro).length,
  };
}
