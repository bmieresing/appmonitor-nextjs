"use client";
// Reloj de la reproducción del recorrido, compartido por la vista Mapa (grilla de
// rutas) y el carrusel (la ruta del chofer que se está mostrando).
//
// El tick es fijo y lo que cambia con la velocidad es cuántos minutos de jornada
// avanza cada uno: la animación mantiene el mismo frame rate y solo se acelera el
// tiempo simulado.
import { useCallback, useEffect, useState } from "react";

const TICK_MS = 260;

// Minutos de jornada por tick. Las lentas avanzan una fracción de minuto en vez de
// espaciar el tick: así el frame rate es el mismo en todas y a ¼× la reproducción
// se ve fluida, no a saltos. El reloj se muestra redondeado, de modo que un paso de
// 0,75 min simplemente tarda un par de ticks en cambiar de minuto.
export const VELOCIDADES = [
  { x: 0.25, min: 0.75, label: "¼×" },
  { x: 0.5, min: 1.5, label: "½×" },
  { x: 1, min: 3, label: "1×" },
  { x: 2, min: 6, label: "2×" },
  { x: 4, min: 14, label: "4×" },
];

export interface Reproduccion {
  minuto: number;
  playing: boolean;
  vel: number;
  terminado: boolean;
  setVel: (v: number) => void;
  alternar: () => void;      // play / pausa (y rebobina si ya terminó)
  reiniciar: () => void;
  irA: (minuto: number) => void;  // saltar a una hora: pausa y se queda ahí
}

/**
 * @param inicio Primera visita de la jornada que se reproduce.
 * @param fin    Última visita. Terminar ahí evita recorrer horas vacías.
 * @param activo Si la reproducción corre. En false el reloj queda quieto en
 *               `inicio` — es lo que permite tener el modo apagado en el carrusel
 *               sin desmontar nada.
 */
export function useReproduccion(inicio: number, fin: number, activo = true): Reproduccion {
  const [minuto, setMinuto] = useState(inicio);
  const [playing, setPlaying] = useState(activo);
  const [vel, setVel] = useState(1);

  // Rearranca al cambiar la jornada (otro chofer, otro tramo) o al activarse.
  useEffect(() => { setMinuto(inicio); setPlaying(activo); }, [inicio, activo]);

  // Depende solo de lo que gobierna el reloj: los datos cambian de identidad en
  // cada poll del snapshot y reiniciarían el intervalo cada 60 s sin motivo.
  useEffect(() => {
    if (!playing || !activo || fin < 0) return;
    const paso = VELOCIDADES.find((v) => v.x === vel)?.min ?? 3;
    const id = setInterval(() => {
      setMinuto((m) => {
        if (m >= fin) { setPlaying(false); return fin; }
        return Math.min(fin, m + paso);
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, activo, vel, fin]);

  const terminado = minuto >= fin;

  const alternar = useCallback(() => {
    setMinuto((m) => (m >= fin ? inicio : m));   // si terminó, vuelve a empezar
    setPlaying((p) => !p);
  }, [fin, inicio]);

  const reiniciar = useCallback(() => { setMinuto(inicio); setPlaying(false); }, [inicio]);

  const irA = useCallback((m: number) => { setMinuto(m); setPlaying(false); }, []);

  return { minuto, playing, vel, terminado, setVel, alternar, reiniciar, irA };
}
