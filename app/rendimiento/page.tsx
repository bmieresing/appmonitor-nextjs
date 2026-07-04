"use client";
// Efectividad por chofer con barras DOM/CSS (no canvas): el texto —nombres,
// conteos, %— es HTML, nítido a cualquier zoom. Barra apilada exitosas (verde) +
// fallidas (rojo), con largo proporcional al total del chofer con más visitas.
import { useSnap } from "@/components/SnapshotContext";
import { useTheme } from "@/components/ThemeProvider";

export default function RendimientoPage() {
  const { snap } = useSnap();
  const { tokens: t } = useTheme();
  if (!snap) return <p className="muted">Cargando…</p>;
  const filas = snap.rendimiento; // ya viene ordenado por pct asc
  const rows = [...filas].reverse(); // mejores arriba (pct desc)
  const maxTotal = Math.max(...filas.map((r) => r.total), 1); // escala común de largo

  const totalEx = filas.reduce((a, r) => a + r.exitosas, 0);
  const totalFa = filas.reduce((a, r) => a + r.fallidas, 0);
  const pctGlobal = totalEx + totalFa > 0 ? Math.round((totalEx / (totalEx + totalFa)) * 100) : 0;

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="lbl">Efectividad global</div><div className="val tnum" style={{ color: t.good }}>{pctGlobal}%</div></div>
        <div className="stat"><div className="lbl">Visitas exitosas</div><div className="val tnum">{totalEx}</div></div>
        <div className="stat"><div className="lbl">Visitas fallidas</div><div className="val tnum" style={{ color: t.critical }}>{totalFa}</div></div>
        <div className="stat"><div className="lbl">Choferes</div><div className="val tnum">{filas.length}</div></div>
      </div>

      <div className="section-title">Efectividad por chofer — exitosas vs fallidas</div>
      <div className="card card-pad">
        <div className="rend-legend">
          <span><span className="rend-dot" style={{ background: t.good }} />Exitosas</span>
          <span><span className="rend-dot" style={{ background: t.critical }} />Fallidas</span>
        </div>
        {rows.length === 0 ? <p className="muted">Sin datos de choferes.</p> : (
          <div className="rend-list">
            {rows.map((r) => (
              <div className="rend-row" key={r.chofer}>
                <div className="rend-name" title={r.chofer}>{r.chofer}</div>
                <div className="rend-track" title={`${r.exitosas} exitosas · ${r.fallidas} fallidas`}>
                  <div className="rend-seg" style={{ width: `${(r.exitosas / maxTotal) * 100}%`, background: t.good }} />
                  <div className="rend-seg" style={{ width: `${(r.fallidas / maxTotal) * 100}%`, background: t.critical }} />
                </div>
                <div className="rend-val tnum">
                  <span style={{ color: t.good }}>{r.exitosas}</span>
                  <span style={{ color: "var(--muted)" }}>/</span>
                  <span style={{ color: t.critical }}>{r.fallidas}</span>
                  <span className="rend-pct">{r.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
