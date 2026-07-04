"use client";
// Indicador tipo "tanque/balde": un contenedor que se llena de abajo hacia
// arriba hasta el %, con el número centrado. Versión React/CSS del mini-tanque
// original (widgets/tanque.py del App Monitor v1), theme-aware (claro/oscuro),
// con relleno translúcido animado y una capa opcional de "no alcanzado" en rojo.
import React from "react";

// Arma el contenido del tooltip: desglosa el sub ("50/301" o "590 / 310 L") en
// dos líneas etiquetadas —logrado (con su %) y esperado— más la línea de no
// alcanzados si aplica. Si el sub no tiene ese formato, cae a "<label>: <pct>%".
// La línea de no alcanzados muestra el conteo exacto (naN) cuando está disponible,
// además del %.
function buildTip(label: string, pct: number, sub: string | null | undefined, naPct: number, naN?: number): string {
  const s = (sub ?? "").trim();
  const m = s.match(/^([\d.,]+)\s*\/\s*([\d.,]+)(\s*L)?$/);
  const naTxt = `No alcanzados: ${naN != null ? `${naN} · ` : ""}${Math.round(naPct)}%`;
  const lineas: string[] = [];
  if (m) {
    const unidad = m[3] ? " L" : "";
    const esLitros = !!m[3] || label.toLowerCase().includes("litro");
    lineas.push(`${esLitros ? "Recolectado" : "Realizados"}: ${m[1]}${unidad} · ${pct}%`);
    if (naPct > 0) lineas.push(naTxt); // entre logrado y esperado
    lineas.push(`${esLitros ? "Esperado" : "Esperados"}: ${m[2]}${unidad}`);
  } else {
    lineas.push(`${label}: ${pct}%`);
    if (naPct > 0) lineas.push(naTxt);
    if (s && s !== "—") lineas.push(s);
  }
  return lineas.join("\n");
}

export default function Tank({
  label,
  pct,
  sub,
  color,
  icon,
  noAlcPct = 0,
  noAlcN,
  onDark = false,
}: {
  label: string;
  pct: number;
  sub?: string | null;
  color: string;
  icon?: string;
  noAlcPct?: number;
  noAlcN?: number; // conteo exacto de no alcanzados (para el tooltip)
  onDark?: boolean; // sobre el hero oscuro: fondo translúcido y textos claros
}) {
  const p = Math.max(0, Math.min(100, pct));
  const na = Math.max(0, Math.min(noAlcPct, 100 - p)); // rojo apilado sobre el fill
  const fill = `color-mix(in srgb, ${color} ${onDark ? 34 : 22}%, transparent)`;
  return (
    <div className={`tank has-tip${onDark ? " on-dark" : ""}`} data-tip={buildTip(label, pct, sub, na, noAlcN)}>
      <div className="tank-body" style={{ borderColor: color }}>
        <div className="tank-fill" style={{ height: `${p}%`, background: fill }} />
        {na > 0 && <div className="tank-na" style={{ bottom: `${p}%`, height: `${na}%` }} />}
        <span className="tank-pct tnum" style={{ color }}>{pct}%</span>
      </div>
      <div className="tank-cap">{icon ? `${icon} ` : ""}{label}</div>
      {sub && <div className="tank-sub tnum">{sub}</div>}
    </div>
  );
}
