"use client";
import { useSnap } from "@/components/SnapshotContext";
import { useTheme } from "@/components/ThemeProvider";
import { productColor, semaforo } from "@/lib/theme";
import { miles } from "@/lib/format";

export default function RecoleccionesPage() {
  const { snap } = useSnap();
  const { tokens: t } = useTheme();
  if (!snap) return <p className="muted">Cargando…</p>;
  const { litros_aceite, productos, choferes } = snap.recolecciones;
  // "Litros hoy" = solo aceite (excluye Latas/Desengrasante), como el original.
  const totalVisitas = productos.reduce((a, p) => a + p.visitas, 0);
  const maxLit = Math.max(...choferes.map((c) => c.litros), 1); // para barra/semáforo relativo

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="lbl">Litros hoy</div><div className="val tnum">{miles(litros_aceite)} <small>L</small></div></div>
        <div className="stat"><div className="lbl">Visitas con litros</div><div className="val tnum">{miles(totalVisitas)}</div></div>
        <div className="stat"><div className="lbl">Choferes activos</div><div className="val tnum">{choferes.length}</div></div>
        <div className="stat"><div className="lbl">Productos</div><div className="val tnum">{productos.length}</div></div>
      </div>

      <div className="section-title">Litros por producto</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {productos.map((p, i) => {
          const col = t.categorical[i % t.categorical.length];
          return (
            <div key={p.producto} className="card card-pad" style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .4, color: t.muted, textTransform: "uppercase" }}>{p.producto}</div>
              <div className="tnum" style={{ fontSize: 26, fontWeight: 800, color: col, marginTop: 4 }}>{miles(p.litros)} L</div>
              <div className="tnum" style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{p.visitas} visitas · {p.pct}%</div>
              <div className="track" style={{ marginTop: 8 }}><i style={{ width: `${Math.min(p.pct, 100)}%`, background: col }} /></div>
            </div>
          );
        })}
      </div>

      <div className="section-title">Detalle por chofer</div>
      {choferes.length === 0 ? <p className="muted">Sin datos de choferes.</p> : (
        <div className="card-grid">
          {choferes.map((ch) => {
            const col = semaforo(Math.round((ch.litros / maxLit) * 100), t);
            return (
              <div key={ch.chofer} className="chofer-card" style={{ borderTopColor: col }}>
                <div className="chofer-name" title={ch.chofer}>{ch.chofer}</div>
                <div className="chofer-lit tnum" style={{ color: col }}>{miles(ch.litros)} L</div>
                <div className="track" style={{ marginTop: 8 }}><i style={{ width: `${Math.max(3, Math.round((ch.litros / maxLit) * 100))}%`, background: col }} /></div>
                {ch.productos && ch.productos.length > 0 && (
                  <div className="chofer-prods">
                    {ch.productos.map((p) => {
                      const pc = productColor(p.producto);
                      return (
                        <div key={p.producto} className="chofer-prod">
                          <span className="chofer-prod-badge" style={{ color: pc, background: `${pc}1f` }}>{p.producto}</span>
                          <span className="chofer-prod-val">{miles(p.litros)} L</span>
                        </div>
                      );
                    })}
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
