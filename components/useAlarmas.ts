"use client";
// Alarmas del GPS del día (reglas de Pegasus) y las geocercas que vigilan, para los
// mapas, la pestaña Alertas y los avisos. Poll de 60 s, como useGps.
//
// La vista Mapa monta decenas de MapaLocales (un panel por ruta) y cada uno pide
// sus alarmas: en vez de un fetch por panel hay UNA lectura compartida por día,
// que vive mientras haya algún mapa suscrito. Mirando un día del historial
// (DiaContext) se lee una vez, sin poll.
//
// Si una lectura falla, los mapas siguen con lo que tenían y la próxima reintenta.
import { useEffect, useState } from "react";
import type { LecturaAlarmas } from "@/lib/types";
import { useDia } from "./DiaContext";

const INTERVALO_MS = 60_000;
const VACIO: LecturaAlarmas = { dia: "", alarmas: [], geocercas: [] };

type Fuente = { valor: LecturaAlarmas; oyentes: Set<(v: LecturaAlarmas) => void>; timer?: ReturnType<typeof setInterval> };
const fuentes = new Map<string, Fuente>();   // clave: el día ("" = hoy en vivo)

async function leer(clave: string, f: Fuente) {
  try {
    const r = await fetch(`/api/gps/alarmas${clave ? `?dia=${clave}` : ""}`, { cache: "no-store" });
    if (!r.ok) return;
    const lectura = (await r.json()) as LecturaAlarmas;
    if (!lectura?.alarmas) return;
    f.valor = lectura;
    f.oyentes.forEach((o) => o(lectura));
  } catch {
    // sin red: la próxima vuelta reintenta
  }
}

/** @param soloHoy Ignora el día del historial y lee siempre hoy en vivo: lo usan los
 *                 avisos (AvisosAlarma), que son de lo que está pasando ahora. */
export function useAlarmas(soloHoy = false): LecturaAlarmas {
  const { dia } = useDia();
  const clave = soloHoy ? "" : dia ?? "";
  const [valor, setValor] = useState<LecturaAlarmas>(() => fuentes.get(clave)?.valor ?? VACIO);

  useEffect(() => {
    let f = fuentes.get(clave);
    const nueva = !f;
    if (!f) {
      f = { valor: VACIO, oyentes: new Set() };
      fuentes.set(clave, f);
    }
    f.oyentes.add(setValor);
    setValor(f.valor);
    if (nueva) {
      leer(clave, f);
      if (!clave) f.timer = setInterval(() => leer(clave, f!), INTERVALO_MS);
    }
    return () => {
      f!.oyentes.delete(setValor);
      if (f!.oyentes.size === 0) {
        clearInterval(f!.timer);
        fuentes.delete(clave);
      }
    };
  }, [clave]);

  return valor;
}
