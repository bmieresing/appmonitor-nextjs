"use client";
// Puntos GPS del día para la vista Mapa y el Carrusel, con su propio poll (el GPS
// se actualiza cada minuto, aparte del snapshot de 5 min).
//
//   · Primera lectura: el día completo.
//   · Después, cada 60 s: solo lo recibido desde la lectura anterior (`hasta`), que
//     se une a lo que ya hay sin duplicar. Incluye los rellenos que un camión sin
//     señal manda con hora atrasada al reconectarse: entran en su lugar por hora.
//   · Al cambiar el día (hora Chile) se descarta todo y se vuelve a leer completo:
//     el monitor es solo del día.
//
// Si una lectura falla, la vista sigue con lo que tenía y la próxima reintenta.
import { useEffect, useRef, useState } from "react";
import type { Gps, LecturaGps } from "@/lib/types";
import { unirPuntos } from "@/lib/gps";

const INTERVALO_MS = 60_000;
const VACIO: Gps = {};

export function useGps(): Gps {
  const [gps, setGps] = useState<Gps>(VACIO);
  const estado = useRef<{ dia: string | null; hasta: string | null }>({ dia: null, hasta: null });

  useEffect(() => {
    let vivo = true;

    const leer = async () => {
      const qs = estado.current.hasta ? `?desde=${encodeURIComponent(estado.current.hasta)}` : "";
      try {
        const r = await fetch(`/api/gps${qs}`, { cache: "no-store" });
        if (!r.ok || !vivo) return;
        const lectura = (await r.json()) as LecturaGps;
        if (!vivo || !lectura?.trazas) return;

        // Día nuevo: lo cargado es de ayer. Se descarta y se pide el día completo.
        if (estado.current.dia && lectura.dia !== estado.current.dia) {
          estado.current = { dia: lectura.dia, hasta: null };
          setGps(VACIO);
          leer();
          return;
        }
        estado.current.dia = lectura.dia;
        if (lectura.hasta) estado.current.hasta = lectura.hasta;

        const patentes = Object.keys(lectura.trazas);
        if (patentes.length === 0) return;   // nada nuevo: no se toca el estado
        setGps((previo) => {
          let cambio = false;
          const siguiente: Gps = { ...previo };
          for (const pat of patentes) {
            const puntos = unirPuntos(previo[pat]?.puntos, lectura.trazas[pat]);
            if (puntos === previo[pat]?.puntos || puntos.length === 0) continue;
            siguiente[pat] = { puntos, ultimo: puntos[puntos.length - 1] };
            cambio = true;
          }
          // Misma identidad si no entró nada: no se rehace ningún mapa.
          return cambio ? siguiente : previo;
        });
      } catch {
        // sin red: la próxima vuelta reintenta
      }
    };

    leer();
    const id = setInterval(leer, INTERVALO_MS);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  return gps;
}

/** Hora de la última actualización exitosa del GPS, para el chip del encabezado.
 *  Poll liviano de 60 s: es una fila, no las trazas. */
export function useGpsEstado(): { actualizado: string | null; error: boolean } {
  const [est, setEst] = useState<{ actualizado: string | null; error: boolean }>({ actualizado: null, error: false });
  useEffect(() => {
    let vivo = true;
    const leer = async () => {
      try {
        const r = await fetch("/api/gps/estado", { cache: "no-store" });
        const body = (await r.json().catch(() => null)) as { actualizado?: string | null } | null;
        if (vivo) setEst({ actualizado: r.ok ? body?.actualizado ?? null : null, error: !r.ok });
      } catch {
        if (vivo) setEst((e) => ({ ...e, error: true }));
      }
    };
    leer();
    const id = setInterval(leer, INTERVALO_MS);
    return () => { vivo = false; clearInterval(id); };
  }, []);
  return est;
}
