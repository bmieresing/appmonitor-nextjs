"use client";
// Fila de 6 KPIs con anillos ECharts (5, con tooltip) + píldoras de producto (1).
import React from "react";
import ReactECharts from "./ReactECharts";
import { useTheme } from "./ThemeProvider";
import { kpiDonutOption, KpiSlice } from "@/lib/charts";
import { productColor } from "@/lib/theme";
import { miles } from "@/lib/format";
import type { Zona } from "@/lib/types";

// Píldoras de litros por producto: una caja legible por producto (borde y texto
// del color de marca, relleno translúcido proporcional). Reemplaza a las barras
// puras, ilegibles cuando un producto domina (p.ej. Aceite) y aplasta al resto.
function ProductPills({ productos }: { productos: { producto: string; litros: number }[] }) {
  const max = Math.max(...productos.map((p) => p.litros || 0), 1);
  if (productos.length === 0) return <div className="prod-pills empty">Sin datos</div>;
  return (
    <div className="prod-pills">
      {productos.map((p) => {
        const color = productColor(p.producto);
        const width = Math.max(4, Math.round(((p.litros || 0) / max) * 100)); // mínimo visible
        return (
          <div className="prod-pill" key={p.producto} style={{ borderColor: color }} title={`${p.producto}: ${miles(p.litros)} L`}>
            <div className="prod-fill" style={{ width: `${width}%`, background: `${color}26` }} />
            <span className="prod-name" style={{ color }}>{p.producto}</span>
            <span className="prod-value tnum" style={{ color }}>{miles(p.litros)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Ring({ emoji, pct, color, label, value, slices }: {
  emoji: string; pct: number; color: string; label: string; value: string; slices: KpiSlice[];
}) {
  const { tokens } = useTheme();
  return (
    <div className="kpi-card">
      <div className="kpi-ring">
        <ReactECharts option={kpiDonutOption(slices, tokens)} height={128} />
        <div className="kpi-center">
          <div className="em">{emoji}</div>
          <div className="pc tnum" style={{ color }}>{pct}%</div>
        </div>
      </div>
      <div className="kpi-label" title={label}>{label}</div>
      <div className="kpi-value tnum">{value}</div>
      <div className="kpi-legend">
        {slices.map((s) => (<span key={s.name}><span className="d" style={{ background: s.color }} />{s.name}</span>))}
      </div>
    </div>
  );
}

export default function KpiRow({ zona }: { zona: Zona }) {
  const { tokens: t } = useTheme();
  const k = zona.kpis;
  const prodTotal = zona.productos.reduce((a, p) => a + p.litros, 0);
  const g = (p: number) => Math.max(0, Math.min(100, p)); // geometría 0-100

  return (
    <div className="kpi-grid">
      <Ring emoji="💧" pct={k.pct_lit} color={t.accent} label="Litros vs Esperado"
        value={`${miles(k.litros)} / ${miles(k.esperado)} L`}
        slices={[
          { name: "Recolectado", value: g(k.pct_lit), display: `${miles(k.litros)} L`, color: t.accent },
          { name: "Restante", value: g(100 - k.pct_lit), display: `${miles(Math.max(k.esperado - k.litros, 0))} L`, color: t.grid },
        ]} />

      <Ring emoji="🏪" pct={k.pct_loc} color={t.accent} label="Locales Realizados"
        value={`${miles(k.exitosos_loc)} / ${miles(k.total_loc)}`}
        slices={[
          { name: "Realizados", value: k.exitosos_loc, display: `${miles(k.exitosos_loc)} locales`, color: t.accent },
          { name: "No alcanzados", value: k.no_alc_loc, display: `${miles(k.no_alc_loc)} locales`, color: t.critical },
          { name: "Pendientes", value: Math.max(k.total_loc - k.exitosos_loc - k.no_alc_loc, 0), display: `${miles(Math.max(k.total_loc - k.exitosos_loc - k.no_alc_loc, 0))} locales`, color: t.grid },
        ]} />

      <Ring emoji="⭐" pct={k.pct_alta} color={t.accent} label="Prioridad Alta"
        value={`${miles(k.exitosos_alta)} / ${miles(k.total_alta)}`}
        slices={[
          { name: "Realizados", value: k.exitosos_alta, display: `${miles(k.exitosos_alta)} locales`, color: t.accent },
          { name: "No alcanzados", value: k.no_alc_alta, display: `${miles(k.no_alc_alta)} locales`, color: t.critical },
          { name: "Pendientes", value: Math.max(k.total_alta - k.exitosos_alta - k.no_alc_alta, 0), display: `${miles(Math.max(k.total_alta - k.exitosos_alta - k.no_alc_alta, 0))} locales`, color: t.grid },
        ]} />

      <Ring emoji="✅" pct={k.pct_exit} color={t.good} label="Recolecciones"
        value={`${miles(k.exitosas)} / ${miles(k.fallidas)}`}
        slices={[
          { name: "Exitosas", value: k.exitosas, display: `${miles(k.exitosas)} visitas`, color: t.good },
          { name: "No alcanzadas", value: k.fallidas_no_alc, display: `${miles(k.fallidas_no_alc)} visitas`, color: t.critical },
          { name: "Otras fallidas", value: Math.max(k.fallidas - k.fallidas_no_alc, 0), display: `${miles(Math.max(k.fallidas - k.fallidas_no_alc, 0))} visitas`, color: t.serious },
        ]} />

      <Ring emoji="🚦" pct={k.pct_cerradas} color={t.accent2} label="Rutas Cerradas"
        value={`${miles(k.cerradas)} / ${miles(k.n_rutas)}`}
        slices={[
          { name: "Cerradas", value: k.cerradas, display: `${miles(k.cerradas)} rutas`, color: t.accent2 },
          { name: "Abiertas", value: Math.max(k.n_rutas - k.cerradas, 0), display: `${miles(Math.max(k.n_rutas - k.cerradas, 0))} rutas`, color: t.grid },
        ]} />

      <div className="kpi-card">
        <ProductPills productos={zona.productos} />
        <div className="kpi-label">Productos</div>
        <div className="kpi-value tnum">{miles(prodTotal)} L</div>
        <div className="kpi-legend"><span>{zona.productos.length} productos</span></div>
      </div>
    </div>
  );
}
