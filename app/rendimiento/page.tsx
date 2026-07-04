"use client";
import ReactECharts from "@/components/ReactECharts";
import { useSnap } from "@/components/SnapshotContext";
import { useTheme } from "@/components/ThemeProvider";
import { rendimientoOption } from "@/lib/charts";

export default function RendimientoPage() {
  const { snap } = useSnap();
  const { tokens: t } = useTheme();
  if (!snap) return <p className="muted">Cargando…</p>;
  const filas = snap.rendimiento; // ya viene ordenado por pct asc

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
        <ReactECharts option={rendimientoOption(filas, t)} height={Math.max(280, filas.length * 34)} />
      </div>
    </div>
  );
}
