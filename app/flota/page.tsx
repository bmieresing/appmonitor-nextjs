"use client";
// Flota (menú Reportes): resumen del día por camión — km y odómetro inicial/final
// del GPS, y litros recolectados (todos los productos menos latas y desengrasante) y
// desengrasante de sus rutas. Sigue al selector de día como el resto de las
// pestañas. La aritmética está en lib/flota.ts.
import { useEffect, useMemo, useState } from "react";
import { useSnap } from "@/components/SnapshotContext";
import { useDia } from "@/components/DiaContext";
import { productColor } from "@/lib/theme";
import { miles } from "@/lib/format";
import { resumenFlota, SIN_CAMION } from "@/lib/flota";
import type { LecturaOdometro } from "@/lib/types";

const INTERVALO_MS = 60_000;
const km = (v: number) => v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Odómetro del día por camión. Hoy: poll de 60 s, como el GPS; un día del
 *  historial: una sola lectura. */
function useOdometro(dia: string | null): LecturaOdometro | null {
  const [lectura, setLectura] = useState<LecturaOdometro | null>(null);
  useEffect(() => {
    let vivo = true;
    setLectura(null);
    const leer = async () => {
      try {
        const r = await fetch(`/api/gps/odometro${dia ? `?dia=${dia}` : ""}`, { cache: "no-store" });
        if (!r.ok) return;
        const l = (await r.json()) as LecturaOdometro;
        if (vivo && l?.camiones) setLectura(l);
      } catch {
        // sin red: la próxima vuelta reintenta
      }
    };
    leer();
    if (dia) return () => { vivo = false; };
    const id = setInterval(leer, INTERVALO_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [dia]);
  return lectura;
}

export default function FlotaPage() {
  const { snap } = useSnap();
  const { dia } = useDia();
  const odo = useOdometro(dia);
  const r = useMemo(() => resumenFlota(snap?.carrusel ?? [], odo?.camiones ?? []), [snap, odo]);

  if (!snap) return <p className="muted">Cargando…</p>;

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="lbl">Km recorridos</div><div className="val tnum">{km(r.km)} <small>km</small></div></div>
        <div className="stat"><div className="lbl">Litros recolectados</div><div className="val tnum">{miles(r.litros)} <small>L</small></div></div>
        <div className="stat"><div className="lbl">Desengrasante</div><div className="val tnum">{miles(r.desengrasante)} <small>L</small></div></div>
        <div className="stat"><div className="lbl">Camiones con GPS</div><div className="val tnum">{miles(r.conGps)}</div></div>
      </div>

      <div className="section-title">
        Por camión
        <span className="flota-nota"> · litros = todos los productos menos latas y desengrasante</span>
      </div>
      {r.filas.length === 0 ? <p className="muted">Sin camiones ni rutas en el día.</p> : (
        <div className="card-grid">
          {r.filas.map((f) => {
            const o = f.odometro;
            const sinCamion = f.patente === SIN_CAMION;
            return (
              <div key={f.patente || "sin-camion"} className="chofer-card flota-card">
                <div className="flota-head">
                  <div className="chofer-name">{sinCamion ? "Sin camión identificado" : `🚚 ${f.patente}`}</div>
                  {!sinCamion && f.choferes.length === 0 && <span className="flota-tag">solo GPS</span>}
                </div>
                {f.choferes.length > 0 && (
                  <div className="flota-choferes">
                    {f.choferes.map((c) => <div key={c.chofer} title={c.ruta ?? undefined}>{c.chofer}{c.ruta ? ` · ${c.ruta}` : ""}</div>)}
                  </div>
                )}

                {!sinCamion && (
                  o ? (
                    <div className="flota-odo">
                      <div className="flota-km tnum">{km(o.km)} <small>km</small></div>
                      <div className="flota-fila"><span>Odómetro inicial · {o.hora_ini}</span><b className="tnum">{km(o.odo_ini_km)} km</b></div>
                      <div className="flota-fila"><span>Odómetro final · {o.hora_fin}</span><b className="tnum">{km(o.odo_fin_km)} km</b></div>
                    </div>
                  ) : <div className="flota-vacio">Sin GPS este día</div>
                )}

                {/* Solo GPS (sin ruta del día): no hay litros que mostrar. */}
                {f.choferes.length > 0 && (
                  <div className="chofer-prods">
                    <div className="flota-fila"><span>Litros</span><b className="tnum">{miles(f.litros)} L</b></div>
                    {f.productos.map((p) => {
                      const pc = productColor(p.producto);
                      return (
                        <div key={p.producto} className="chofer-prod">
                          <span className="chofer-prod-badge" style={{ color: pc, background: `${pc}1f` }}>{p.producto}</span>
                          <span className="chofer-prod-val">{miles(p.litros)} L</span>
                        </div>
                      );
                    })}
                    <div className="flota-fila"><span>Desengrasante</span><b className="tnum">{miles(f.desengrasante)} L</b></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
