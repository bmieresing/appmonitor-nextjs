"use client";
// Sección "Rendimiento": la vista que antes era su propia pestaña. Efectividad por
// chofer con barras DOM/CSS (no canvas): el texto —nombres, conteos, %— es HTML,
// nítido a cualquier zoom. Barra apilada exitosas (verde) + fallidas (rojo), con
// largo proporcional al chofer con más visitas.
import React, { useMemo, useState } from "react";
import Seccion from "./Seccion";
import { useTheme } from "@/components/ThemeProvider";
import { miles } from "@/lib/format";
import type { Rendimiento } from "@/lib/types";

export default function SeccionRendimiento({ rendimiento }: { rendimiento: Rendimiento[] }) {
  const { tokens: t } = useTheme();
  const [busca, setBusca] = useState("");

  const filas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rendimiento.filter((r) => !q || r.chofer.toLowerCase().includes(q));
  }, [rendimiento, busca]);

  const rows = [...filas].reverse();                                  // mejores arriba (pct desc)
  const maxTotal = Math.max(...filas.map((r) => r.total), 1);         // escala común de largo
  const totalEx = filas.reduce((a, r) => a + r.exitosas, 0);
  const totalFa = filas.reduce((a, r) => a + r.fallidas, 0);
  const pctGlobal = totalEx + totalFa > 0 ? Math.round((totalEx / (totalEx + totalFa)) * 100) : 0;

  return (
    <Seccion icono="✅" titulo="Efectividad por chofer"
      bajada="Visitas exitosas contra fallidas, por local único."
      filtros={
        <input className="col-filtro est-busca" value={busca} placeholder="Buscar chofer…"
          onChange={(e) => setBusca(e.target.value)} />
      }>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="lbl">Efectividad global</div><div className="val tnum" style={{ color: t.good }}>{pctGlobal}%</div></div>
        <div className="stat"><div className="lbl">Visitas exitosas</div><div className="val tnum">{miles(totalEx)}</div></div>
        <div className="stat"><div className="lbl">Visitas fallidas</div><div className="val tnum" style={{ color: t.critical }}>{miles(totalFa)}</div></div>
        <div className="stat"><div className="lbl">Choferes</div><div className="val tnum">{miles(filas.length)}</div></div>
      </div>

      <div className="card card-pad">
        <div className="rend-legend">
          <span><span className="rend-dot" style={{ background: t.good }} />Exitosas</span>
          <span><span className="rend-dot" style={{ background: t.critical }} />Fallidas</span>
        </div>
        {rows.length === 0 ? <p className="muted">Ningún chofer coincide con los filtros.</p> : (
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
    </Seccion>
  );
}
