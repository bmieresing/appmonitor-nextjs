"use client";
// Carrusel por chofer: pills + auto-avance, hero con métricas, donut de
// desglose (ECharts) y tablas/barras. Look profesional, tema-aware.
import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "./ReactECharts";
import FullscreenToggle from "./FullscreenToggle";
import Tank from "./Tank";
import { useTheme } from "./ThemeProvider";
import { breakdownDonutOption } from "@/lib/charts";
import { miles } from "@/lib/format";
import type { CarruselChofer } from "@/lib/types";

const NO_ALC = "no alcanzamos a pasar";
const INTERVALO_MS = 10_000;

// Color del estado de cada local en el detalle (verde ok · rojo no alcanzado ·
// naranja otro fallo · gris pendiente).
function estadoColor(estado: string, t: { good: string; critical: string; warning: string; muted: string }): string {
  if (estado === "Realizado") return t.good;
  if (estado === "No alcanzado") return t.critical;
  if (estado === "Fallido") return t.warning;
  return t.muted; // Pendiente
}

// Tabla de magnitud (estilo original): encabezados de columna + una columna con
// barra fina proporcional al máximo de la lista. `valueKey` es la columna barra.
function BarTable({ cols, rows, valueKey }: {
  cols: { key: string; label: string; num?: boolean }[];
  rows: Record<string, string | number>[];
  valueKey: string;
}) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  return (
    <table className="data bartable">
      <thead>
        <tr>{cols.map((col) => <th key={col.key} style={{ textAlign: col.num && col.key !== valueKey ? "right" : "left" }}>{col.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {cols.map((col) => {
              if (col.key === valueKey) {
                const v = Number(r[valueKey]) || 0;
                return (
                  <td key={col.key} className="bar-td">
                    <div className="dbar-cell">
                      <div className="dbar-track"><i style={{ width: `${Math.max(4, Math.round((v / max) * 100))}%` }} /></div>
                      <span className="dbar-val">{miles(v)} L</span>
                    </div>
                  </td>
                );
              }
              return <td key={col.key} style={{ textAlign: col.num ? "right" : "left" }}>{r[col.key]}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function segmentos(c: CarruselChofer, t: { good: string; critical: string; serious: string; warning: string; muted: string; categorical: string[] }) {
  const reds = [t.critical, t.serious, t.warning, "#7b241c", "#d35400"];
  const segs = [{ name: "Exitosas", value: c.exitosas, color: t.good }];
  let oi = 0;
  for (const r of c.razones ?? []) {
    const esNoAlc = r.NombreRazon.trim().toLowerCase() === NO_ALC;
    segs.push({ name: r.NombreRazon, value: r.N, color: esNoAlc ? t.critical : reds[(oi++ % (reds.length - 1)) + 1] });
  }
  segs.push({ name: "Pend. Alta", value: c.pend_alta, color: "#6b7280" });
  segs.push({ name: "Pend. Baja/Media", value: c.pend_normal, color: t.muted });
  return segs;
}

export default function CarruselView({ carrusel, initialChofer }: { carrusel: CarruselChofer[]; initialChofer?: string }) {
  const { tokens: t } = useTheme();
  const choferes = useMemo(() => carrusel.map((c) => c.chofer), [carrusel]);
  const startIdx = Math.max(0, initialChofer ? choferes.indexOf(initialChofer) : 0);
  const [idx, setIdx] = useState(startIdx);
  const [auto, setAuto] = useState(false);
  // Orden y filtros por columna del detalle (client-side; el detalle ya viene en
  // el snapshot). sortCol="" = orden natural del publisher (Alta + litros desc).
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [filtros, setFiltros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!auto || choferes.length === 0) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % choferes.length), INTERVALO_MS);
    return () => clearInterval(id);
  }, [auto, choferes.length]);

  if (carrusel.length === 0) return <p className="muted">Sin datos de recolecciones para hoy.</p>;
  const c = carrusel[Math.min(idx, carrusel.length - 1)];
  const segs = segmentos(c, t);
  const locOrden = (c.locales ?? []).slice().sort((a, b) => b.Litros - a.Litros); // desc

  // Detalle: columnas (con su tipo de filtro), filtrado y orden por columna.
  const detalle = c.detalle ?? [];
  const estadosPresentes = ["Realizado", "No alcanzado", "Fallido", "Pendiente"].filter((e) => detalle.some((d) => d.estado === e));
  // Prioridades reales presentes en la ruta (LocalesRuta), ordenadas Alta→Media→Baja→Normal→otras.
  const ordenPrio = ["Alta", "Media", "Baja", "Normal"];
  const prioridadesPresentes = [...new Set(detalle.map((d) => d.prioridad))]
    .sort((a, b) => ((ordenPrio.indexOf(a) + 1 || 99) - (ordenPrio.indexOf(b) + 1 || 99)) || a.localeCompare(b));
  const hayEmergencias = detalle.some((d) => d.emergencia);
  const cols: { key: string; label: string; num?: boolean; filtro: "text" | "select" | "none"; ops?: string[] }[] = [
    { key: "id_local", label: "ID", num: true, filtro: "text" },
    { key: "local", label: "Local", filtro: "text" },
    { key: "prioridad", label: "Prioridad", filtro: "select", ops: prioridadesPresentes },
    { key: "emergencia", label: "Emergencia", filtro: hayEmergencias ? "select" : "none", ops: ["Sí", "No"] },
    { key: "estado", label: "Estado", filtro: "select", ops: estadosPresentes },
    { key: "razon", label: "Razón", filtro: "text" },
    { key: "litros", label: "Litros", num: true, filtro: "none" },
  ];
  const celda = (d: (typeof detalle)[number], key: string) =>
    key === "id_local" ? String(d.id_local ?? "")
      : key === "emergencia" ? (d.emergencia ? "Sí" : "No")
        : String((d as Record<string, unknown>)[key] ?? "");
  let detFilt = detalle.filter((d) => cols.every((col) => {
    const v = filtros[col.key];
    if (!v) return true;
    const cell = celda(d, col.key);
    return col.filtro === "select" ? cell === v : cell.toLowerCase().includes(v.toLowerCase());
  }));
  if (sortCol) {
    const col = cols.find((c2) => c2.key === sortCol);
    detFilt = [...detFilt].sort((a, b) => {
      if (col?.num) {
        const av = Number((a as Record<string, unknown>)[sortCol] ?? -Infinity);
        const bv = Number((b as Record<string, unknown>)[sortCol] ?? -Infinity);
        return (av - bv) * sortDir;
      }
      return celda(a, sortCol).localeCompare(celda(b, sortCol)) * sortDir;
    });
  }
  const ordenarPor = (key: string) => {
    if (sortCol !== key) { setSortCol(key); setSortDir(1); }        // 1er click: asc
    else if (sortDir === 1) setSortDir(-1);                         // 2do: desc
    else { setSortCol(""); setSortDir(1); }                         // 3er: orden natural
  };

  const cajas: [string, number, string][] = [
    [t.good, c.exitosas, "Exitosas"],
    [t.critical, c.fallidas, "Fallidas"],
    ["#6b7280", c.pend_alta, "Pend. Alta"],
    [t.muted, c.pend_normal, "Pend. Normal"],
  ];

  return (
    <div>
      <div className="toolbar">
        <button className="icon-btn" onClick={() => setIdx((i) => (i - 1 + choferes.length) % choferes.length)}>◀</button>
        <button className="icon-btn" onClick={() => setIdx((i) => (i + 1) % choferes.length)}>▶</button>
        <label className="sw"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-avance</label>
        <FullscreenToggle />
      </div>

      <div className="pills">
        {carrusel.map((ch, i) => (
          <button key={ch.chofer} className={`chip-btn${i === idx ? " active" : ""}`} onClick={() => setIdx(i)}>
            {ch.cerrado ? "🔒 " : ""}{ch.chofer}
          </button>
        ))}
      </div>

      <div className="hero">
        <div>
          <div className="hero-eyebrow">Chofer</div>
          <div className="hero-name">{c.cerrado ? "🔒 " : ""}{c.chofer}</div>
          {c.ruta && <div className="hero-route">🗺️ {c.ruta}</div>}
        </div>
        <div className="hero-metrics">
          <Tank icon="💧" label="Litros" pct={c.pct_lit} color="#8fe08f" sub={c.sub_lit} onDark />
          <Tank icon="🏪" label="Locales" pct={c.pct_loc} color="#8fe08f" sub={c.sub_loc} noAlcPct={c.no_alc_pct_loc ?? 0} noAlcN={c.no_alc_loc} onDark />
          {c.tiene_alta && <Tank icon="⭐" label="Alta" pct={c.pct_alta} color="#ffe08a" sub={c.sub_alta} noAlcPct={c.no_alc_pct_alta ?? 0} noAlcN={c.no_alc_alta} onDark />}
          {c.emerg_total > 0 && <Tank icon="🚨" label="Emergencias" pct={c.pct_emerg} color="#ff9e9e" sub={c.sub_emerg} onDark />}
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="section-title" style={{ margin: "0 0 6px" }}>Desglose de visitas</div>
          <ReactECharts option={breakdownDonutOption(segs, t)} height={300} />
          {/* Leyenda en HTML (nombre + valor por segmento): texto nítido al zoom,
              el canvas solo dibuja el aro. */}
          <div className="donut-legend">
            {segs.filter((s) => s.value > 0).map((s) => (
              <span key={s.name} className="donut-leg-item">
                <span className="donut-leg-dot" style={{ background: s.color }} />
                <span className="donut-leg-name">{s.name}</span>
                <span className="donut-leg-val tnum">{miles(s.value)}</span>
              </span>
            ))}
          </div>
          <div className="mini-kpis">
            {cajas.map(([color, val, lbl]) => (
              <div key={lbl} className="mini-kpi" style={{ background: color }}>
                <div className="v tnum">{val}</div>
                <div className="l">{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="carrusel-lists">
          <div className="lists-col">
            <div className="card card-pad">
              <div className="section-title" style={{ margin: "0 0 10px" }}>🏆 Top 5 — Más litros</div>
              {locOrden.length === 0 ? <p className="muted">Sin datos</p>
                : <BarTable cols={[{ key: "Local", label: "Local" }, { key: "Litros", label: "Litros", num: true }]} rows={locOrden.slice(0, 5)} valueKey="Litros" />}
            </div>
            <div className="card card-pad">
              <div className="section-title" style={{ margin: "0 0 10px" }}>🧴 Por producto</div>
              {(c.productos ?? []).length === 0 ? <p className="muted">Sin datos</p>
                : <BarTable cols={[{ key: "Producto", label: "Producto" }, { key: "Visitas", label: "Visitas", num: true }, { key: "Litros", label: "Litros", num: true }]} rows={c.productos} valueKey="Litros" />}
            </div>
          </div>
          <div className="lists-col">
            <div className="card card-pad">
              <div className="section-title" style={{ margin: "0 0 10px" }}>⚠️ Top 5 — Menos litros</div>
              {locOrden.length === 0 ? <p className="muted">Sin datos</p>
                : <BarTable cols={[{ key: "Local", label: "Local" }, { key: "Litros", label: "Litros", num: true }]} rows={locOrden.slice(-5).reverse()} valueKey="Litros" />}
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="section-title" style={{ margin: "0 0 10px" }}>
          📋 Detalle de recolecciones {detalle.length > 0 && <span style={{ color: "var(--muted)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· {detFilt.length === detalle.length ? `${detalle.length} locales` : `${detFilt.length} de ${detalle.length}`}</span>}
        </div>
        {detalle.length === 0 ? <p className="muted">Sin datos de la ruta.</p> : (
          <div className="tbl-wrap">
            <table className="data grid">
              <thead>
                <tr>
                  {cols.map((col) => (
                    <th key={col.key} onClick={() => ordenarPor(col.key)} style={{ cursor: "pointer", textAlign: col.num ? "right" : "left", whiteSpace: "nowrap" }} title="Ordenar">
                      {col.label}
                      <span style={{ marginLeft: 4, opacity: sortCol === col.key ? 1 : 0.3, fontSize: 10 }}>{sortCol === col.key ? (sortDir === 1 ? "▲" : "▼") : "↕"}</span>
                    </th>
                  ))}
                </tr>
                <tr className="filtro-row">
                  {cols.map((col) => (
                    <th key={col.key}>
                      {col.filtro === "text" && (
                        <input className="col-filtro" value={filtros[col.key] ?? ""} placeholder="Filtrar…"
                          onChange={(e) => setFiltros((f) => ({ ...f, [col.key]: e.target.value }))} />
                      )}
                      {col.filtro === "select" && (
                        <select className="col-filtro" value={filtros[col.key] ?? ""}
                          onChange={(e) => setFiltros((f) => ({ ...f, [col.key]: e.target.value }))}>
                          <option value="">Todos</option>
                          {col.ops!.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detFilt.length === 0 ? (
                  <tr><td colSpan={cols.length} className="muted" style={{ textAlign: "center", padding: 18 }}>Ningún local coincide con los filtros.</td></tr>
                ) : detFilt.map((d, i) => {
                  const ec = estadoColor(d.estado, t);
                  return (
                    <tr key={i}>
                      <td className="tnum" style={{ color: "var(--muted)", textAlign: "right" }}>{d.id_local ?? "—"}</td>
                      <td>
                        {d.local || "—"}
                        {d.productos.length > 0 && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                            {d.productos.map((p) => `${p.producto} ${miles(p.litros)} L`).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td>
                        {d.prioridad === "Alta"
                          ? <span className="pill" style={{ background: `color-mix(in srgb, ${t.warning} 16%, transparent)`, color: t.warning }}>⭐ Alta</span>
                          : <span style={{ color: "var(--muted)" }}>{d.prioridad}</span>}
                      </td>
                      <td>
                        {d.emergencia
                          ? <span className="pill" style={{ background: `color-mix(in srgb, ${t.critical} 16%, transparent)`, color: t.critical }}>🚨 Sí</span>
                          : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td><span className="pill" style={{ background: `color-mix(in srgb, ${ec} 16%, transparent)`, color: ec }}>{d.estado}</span></td>
                      <td style={{ color: "var(--muted)" }}>{d.razon ?? "—"}</td>
                      <td className="tnum" style={{ textAlign: "right", fontWeight: 700 }}>{d.litros > 0 ? `${miles(d.litros)} L` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
