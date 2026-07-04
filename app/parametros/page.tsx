"use client";
import { useSnap } from "@/components/SnapshotContext";
import { useTheme } from "@/components/ThemeProvider";
import { miles } from "@/lib/format";

function estadoClase(estado: string): string {
  if (estado.startsWith("✅")) return "status-ok";
  if (estado.startsWith("⚠")) return "status-warn";
  return "status-err";
}

export default function ParametrosPage() {
  const { snap } = useSnap();
  const { tokens: t } = useTheme();
  if (!snap) return <p className="muted">Cargando…</p>;
  const p = snap.parametros;
  const r = p.resumen;

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="lbl">Sheet Santiago</div><div className="val tnum">{r.filas_sheet_santiago ?? 0}</div></div>
        <div className="stat"><div className="lbl">Sheet Regiones</div><div className="val tnum">{r.filas_sheet_regiones ?? 0}</div></div>
        <div className="stat"><div className="lbl">Choferes Santiago</div><div className="val tnum">{r.choferes_santiago ?? 0}</div></div>
        <div className="stat"><div className="lbl">Choferes Regiones</div><div className="val tnum">{r.choferes_regiones ?? 0}</div></div>
      </div>

      <div className="section-title">🔗 Santiago — match por patente ({r.santiago_match ?? 0}/{r.santiago_total ?? 0})</div>
      <div className="tbl-wrap" style={{ marginBottom: 8 }}>
        <table className="data">
          <thead><tr><th>Match</th><th>Celda</th><th>Patente</th><th>ID Veh.</th><th>ID Chofer</th><th>Chofer</th><th>PROM 3M</th><th>Litros hoy</th></tr></thead>
          <tbody>
            {p.santiago.map((s, i) => (
              <tr key={i}>
                <td>{s.match_ok ? "✅" : "❌"}</td>
                <td className="tnum">{s.celda_sheet}</td>
                <td>{s.patente}</td>
                <td className="tnum">{s.id_vehiculo ?? "—"}</td>
                <td className="tnum">{s.id_chofer ?? "—"}</td>
                <td>{s.nombre_chofer ?? <span className="status-err">sin match</span>}</td>
                <td className="tnum">{s.prom ? miles(s.prom) : "—"}</td>
                <td className="tnum">{s.litros ? miles(s.litros) : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">
        🔗 Regiones — match por nombre
        <span style={{ marginLeft: 10, fontWeight: 600 }}>
          <span className="status-ok">{r.regiones_ok ?? 0} ok</span> · <span className="status-warn">{r.regiones_warn ?? 0} adv.</span> · <span className="status-err">{r.regiones_err ?? 0} sin match</span>
        </span>
      </div>
      <div className="tbl-wrap">
        <table className="data">
          <thead><tr><th>Match</th><th>Celda</th><th>Chofer</th><th>Ruta</th><th>PROM</th><th>Litros hoy</th><th>%</th></tr></thead>
          <tbody>
            {p.regiones.map((g, i) => (
              <tr key={i}>
                <td className={estadoClase(g.match_estado)} style={{ fontWeight: 600 }}>{g.match_estado}</td>
                <td className="tnum">{g.celda_sheet ?? "—"}</td>
                <td>{g.chofer}</td>
                <td>{g.ruta ?? "—"}</td>
                <td className="tnum">{miles(g.prom)}</td>
                <td className="tnum">{miles(g.litros)}</td>
                <td className="tnum">{g.pct != null ? `${g.pct}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
