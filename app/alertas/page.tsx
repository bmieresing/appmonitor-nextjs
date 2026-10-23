"use client";
// Alertas: las alarmas GPS del día (reglas de Pegasus que trae el Lambda GPS), la más
// nueva arriba. Es el registro de los avisos flotantes (AvisosAlarma), que solo
// duran unos segundos. Sigue al selector de día como el resto de las pestañas.
import { useMemo } from "react";
import { useAlarmas } from "@/components/useAlarmas";
import { useSnap } from "@/components/SnapshotContext";
import { choferesPorPatente, normalizarPatente, textoGeocerca } from "@/lib/gps";
import { miles } from "@/lib/format";

export default function AlertasPage() {
  const { alarmas, geocercas, dia } = useAlarmas();
  const { snap } = useSnap();
  const choferes = useMemo(() => choferesPorPatente(snap?.carrusel ?? []), [snap]);
  const camiones = useMemo(() => new Set(alarmas.map((a) => normalizarPatente(a.patente))).size, [alarmas]);

  if (!dia) return <p className="muted">Cargando…</p>;

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="lbl">Alarmas GPS</div><div className="val tnum">{miles(alarmas.length)}</div></div>
        <div className="stat"><div className="lbl">Camiones con alarma</div><div className="val tnum">{miles(camiones)}</div></div>
      </div>

      <div className="section-title">Alarmas del día</div>
      {alarmas.length === 0 ? <p className="muted">Sin alarmas GPS en el día.</p> : (
        <div className="tbl-wrap">
          <table className="data grid">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Camión</th>
                <th>Chofer</th>
                <th>Alarma</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {alarmas.map((a) => (
                <tr key={a.id}>
                  <td className="tnum">{a.hora}</td>
                  <td><b>{a.patente ?? "—"}</b></td>
                  <td>{choferes.get(normalizarPatente(a.patente)) ?? "—"}</td>
                  <td className={a.nivel === "critical" ? "status-err" : "status-warn"}>⚠️ {a.regla ?? "Alarma GPS"}</td>
                  <td style={{ color: "var(--muted)" }}>{textoGeocerca(a, geocercas) ?? a.mensaje ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
