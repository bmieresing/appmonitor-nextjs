"use client";
// Aviso flotante, en la esquina, de cada alarma GPS que RECIÉN llega. Va montado en
// el Shell, así que aparece en todas las páginas, incluida /pantalla (la tele).
//
// Solo lo nuevo: la primera lectura de la página marca como vistas las alarmas que
// ya existían, y después avisa las que no estaban. Además la alarma tiene que ser
// reciente (RECIENTE_MIN): el Lambda GPS rellena reportes atrasados cuando un camión
// recupera la señal, y una alarma de hace dos horas que entra tarde no es "ahora".
// El historial del día está en la pestaña Alertas.
import { useEffect, useMemo, useRef, useState } from "react";
import type { AlarmaGps } from "@/lib/types";
import { choferesPorPatente, normalizarPatente, textoGeocerca } from "@/lib/gps";
import { useAlarmas } from "./useAlarmas";
import { useSnap } from "./SnapshotContext";
import { useDia } from "./DiaContext";

const DURACION_MS = 8_000;
const RECIENTE_MIN = 15;
const MAX_VISIBLES = 4;

interface Aviso {
  id: string;
  alarma: AlarmaGps;
  chofer: string | null;
  geocerca: string | null;
}

export default function AvisosAlarma() {
  const { alarmas, geocercas, dia } = useAlarmas(true);
  const { snap } = useSnap();
  const { dia: diaHistorial } = useDia();
  const vistas = useRef<Set<string> | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  // Mirando un día del historial el snapshot es de ese día: sus choferes no sirven
  // para nombrar el camión de hoy.
  const choferes = useMemo(
    () => choferesPorPatente(diaHistorial ? [] : snap?.carrusel ?? []),
    [snap, diaHistorial],
  );

  useEffect(() => {
    if (!dia) return;   // todavía no llegó la primera lectura
    if (vistas.current === null) {
      vistas.current = new Set(alarmas.map((a) => a.id));
      return;
    }
    const corte = Date.now() - RECIENTE_MIN * 60_000;
    const nuevos: Aviso[] = [];
    for (const a of alarmas) {
      if (vistas.current.has(a.id)) continue;
      vistas.current.add(a.id);
      if (new Date(a.t).getTime() < corte) continue;
      nuevos.push({
        id: a.id,
        alarma: a,
        chofer: choferes.get(normalizarPatente(a.patente)) ?? null,
        geocerca: textoGeocerca(a, geocercas),
      });
    }
    if (nuevos.length === 0) return;
    // `alarmas` viene la más nueva primero: así quedan arriba en la pila.
    setAvisos((prev) => [...nuevos, ...prev].slice(0, MAX_VISIBLES));
    for (const n of nuevos) {
      setTimeout(() => setAvisos((prev) => prev.filter((x) => x.id !== n.id)), DURACION_MS);
    }
    // `choferes` y `geocercas` se leen al momento del aviso; no deben redispararlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmas, dia]);

  if (avisos.length === 0) return null;
  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map(({ id, alarma: a, chofer, geocerca }) => (
        <button key={id} className={`aviso${a.nivel === "critical" ? " critico" : ""}`}
          onClick={() => setAvisos((prev) => prev.filter((x) => x.id !== id))}
          title="Cerrar">
          <span className="aviso-ic" aria-hidden>⚠️</span>
          <span className="aviso-cuerpo">
            <span className="aviso-tit">{a.regla ?? "Alarma GPS"}</span>
            <span className="aviso-det">
              <b>{a.patente ?? "—"}</b>{chofer && ` · ${chofer}`}
            </span>
            {(geocerca || a.mensaje) && <span className="aviso-det">{geocerca ?? a.mensaje}</span>}
          </span>
          <span className="aviso-hora tnum">{a.hora}</span>
          <span className="aviso-barra" style={{ animationDuration: `${DURACION_MS}ms` }} />
        </button>
      ))}
    </div>
  );
}
