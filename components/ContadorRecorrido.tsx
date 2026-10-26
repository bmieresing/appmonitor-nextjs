"use client";
// Panel lateral del Recorrido en la ventana grande (vista Mapa y Carrusel): lo que
// la ruta lleva hecho al minuto de la reproducción — kilómetros del camión, visitas
// exitosas y fallidas, litros por producto y la última visita. Avanza con el reloj
// y se recalcula al saltar o retroceder en la línea de tiempo.
//
// Cada número que cambia se ilumina un instante: el `key` con el valor rearma el
// span y con él la animación CSS (.cr-flash).
import React, { useMemo } from "react";
import { useTheme } from "./ThemeProvider";
import { estadoColor, productColor } from "@/lib/theme";
import { miles } from "@/lib/format";
import { acumuladoHasta, hhmm, type EventoVisita } from "@/lib/tiempo";
import { kmHasta, odometroHasta } from "@/lib/gps";
import type { PuntoGps } from "@/lib/types";

const km = (v: number) => v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function ContadorRecorrido({ eventos, total, minuto, traza }: {
  eventos: EventoVisita[];
  /** Locales de la ruta (visitados o no): el "de N" de las visitas. */
  total: number;
  minuto: number;
  traza?: PuntoGps[] | null;
}) {
  const { tokens: t } = useTheme();
  const a = useMemo(() => acumuladoHasta(eventos, minuto), [eventos, minuto]);
  const odo = odometroHasta(traza, minuto);
  const kms = kmHasta(traza, minuto);
  const max = Math.max(1, ...a.productos.map((p) => p.litros));
  const u = a.ultima?.punto;

  return (
    <aside className="cr" aria-label="Acumulado del recorrido">
      <div className="cr-hora tnum">{hhmm(Math.floor(minuto))}</div>

      {kms !== null && (
        <div className="cr-bloque">
          <div className="cr-tit">Recorrido</div>
          <div className="cr-grande tnum"><span key={km(kms)} className="cr-flash">🚚 {km(kms)}</span> <small>km</small></div>
          {/* Lecturas del odómetro del equipo GPS: la del primer reporte del día y
              la del último hasta este minuto (los km de arriba son la diferencia). */}
          {odo && (
            <>
              <div className="cr-fila"><span>Odómetro inicial</span><b className="tnum">{km(odo.ini)} km</b></div>
              <div className="cr-fila"><span>Odómetro final</span><b key={km(odo.fin)} className="cr-flash tnum">{km(odo.fin)} km</b></div>
            </>
          )}
        </div>
      )}

      {/* Camión sin ruta asignada (solo GPS): no hay visitas ni litros que contar. */}
      {total > 0 && (
        <>
          <div className="cr-bloque">
            <div className="cr-tit">Visitas</div>
            <div className="cr-grande tnum">
              <span key={a.hechas} className="cr-flash">{miles(a.hechas)}</span> <small>de {miles(total)}</small>
            </div>
            <div className="cr-fila">
              <span style={{ color: t.good }}>✔ Exitosas</span>
              <b key={a.exitosas} className="cr-flash tnum" style={{ color: t.good }}>{miles(a.exitosas)}</b>
            </div>
            <div className="cr-fila">
              <span style={{ color: t.critical }}>✖ Fallidas</span>
              <b key={a.fallidas} className="cr-flash tnum" style={{ color: t.critical }}>{miles(a.fallidas)}</b>
            </div>
          </div>

          <div className="cr-bloque">
            <div className="cr-tit">Recolectado</div>
            <div className="cr-grande tnum"><span key={a.litros} className="cr-flash">{miles(a.litros)}</span> <small>L</small></div>
            {a.productos.length === 0
              ? <div className="cr-vacio">Todavía nada</div>
              : a.productos.map((p) => {
                  const color = productColor(p.producto);
                  return (
                    <div className="cr-prod" key={p.producto} title={`${p.producto}: ${miles(p.litros)} L`}>
                      <div className="cr-prod-fill" style={{ width: `${Math.max(4, (p.litros / max) * 100)}%`, background: `${color}26` }} />
                      <span className="cr-prod-nom" style={{ color }}>{p.producto}</span>
                      <b key={p.litros} className="cr-flash tnum" style={{ color }}>{miles(p.litros)}</b>
                    </div>
                  );
                })}
          </div>
        </>
      )}

      {u && (
        // El key con el local hace que la tarjeta entre de nuevo con cada visita.
        <div className="cr-bloque cr-ultima cr-flash" key={`${u.local}|${a.ultima!.min}`}>
          <div className="cr-tit">Última visita · {u.hora}</div>
          <div className="cr-local" title={u.local}>{u.local}</div>
          <div className="cr-fila">
            <span style={{ color: estadoColor(u.estado, t) }}>{u.estado}</span>
            {u.litros > 0 && <b className="tnum">{miles(u.litros)} L</b>}
          </div>
          {u.razon && u.estado !== "Realizado" && <div className="cr-vacio">{u.razon}</div>}
        </div>
      )}
    </aside>
  );
}
