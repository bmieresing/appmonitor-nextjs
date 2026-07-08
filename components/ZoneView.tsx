"use client";
// Vista de zona: fila KPI + grilla de cards (choferes o, en Global, centros).
// Con `scrollCards` las cards de chofer se muestran como feed vertical auto-
// desplazable (para Regiones en el Carrusel Zonas) en vez de grilla estática.
import React from "react";
import Link from "next/link";
import KpiRow from "./KpiRow";
import Tank from "./Tank";
import CardChofer from "./CardChofer";
import AutoScrollCards from "./AutoScrollCards";
import { useTheme } from "./ThemeProvider";
import { useCentroColores } from "./CentroColores";
import { miles } from "@/lib/format";
import { semaforo, semaforoComp } from "@/lib/theme";
import type { Zona, Centro } from "@/lib/types";

function CardCentro({ c }: { c: Centro }) {
  const { tokens: t } = useTheme();
  const { colorDe } = useCentroColores();
  const pct = (r: number, tot: number) => (tot > 0 ? Math.round((r / tot) * 100) : 0);
  const totalAlta = c.total_alta ?? 0;
  // Pinta la card con el color del centro (mapeo editable): borde + relleno tenue
  // + nombre en el color. Sin color asignado → card por defecto. Además la card es
  // un link a Regiones filtrado por este centro.
  const color = colorDe(c.centro);
  const cardStyle: React.CSSProperties = {
    textDecoration: "none", color: "inherit", display: "block", cursor: "pointer",
    ...(color ? { border: `1.5px solid ${color}`, background: `color-mix(in srgb, ${color} 10%, var(--surface))` } : {}),
  };
  return (
    <Link href={`/regiones?centro=${encodeURIComponent(c.centro)}`} className="entity-card"
      style={cardStyle} title={`Ver choferes de ${c.centro} en Regiones`}>
      <div className="entity-head">
        <span className="entity-name" style={color ? { color } : undefined}>{c.centro}</span>
      </div>
      <div className="metric-row">
        <Tank icon="💧" label="Litros" pct={pct(c.litros, c.prom)} color={semaforoComp(pct(c.litros, c.prom), t)} sub={`${miles(c.litros)} / ${miles(c.prom)} L`} />
        <Tank icon="🏪" label="Locales" pct={pct(c.realizados, c.total)} color={semaforo(pct(c.realizados, c.total), t)} sub={`${c.realizados}/${c.total}`} noAlcPct={pct(c.no_alc ?? 0, c.total)} noAlcN={c.no_alc} />
        {totalAlta > 0 && (
          <Tank icon="⭐" label="Alta" pct={pct(c.realizados_alta ?? 0, totalAlta)} color={semaforo(pct(c.realizados_alta ?? 0, totalAlta), t)} sub={`${c.realizados_alta ?? 0}/${totalAlta}`} noAlcPct={pct(c.no_alc_alta ?? 0, totalAlta)} noAlcN={c.no_alc_alta} />
        )}
      </div>
    </Link>
  );
}

export default function ZoneView({ zona, esGlobal, scrollCards = false }:
  { zona: Zona; esGlobal: boolean; scrollCards?: boolean }) {
  return (
    <div>
      <KpiRow zona={zona} />
      <div className="section-title">{esGlobal ? "Centros de acopio" : "Choferes"}</div>
      {esGlobal ? (
        zona.centros.length === 0 ? <p className="muted">Sin datos de centros de acopio.</p>
          : <div className="card-grid">{zona.centros.map((c) => <CardCentro key={c.centro} c={c} />)}</div>
      ) : zona.cards.length === 0 ? <p className="muted">Sin datos de choferes.</p>
        : scrollCards
          ? <AutoScrollCards cards={zona.cards} />
          : <div className="card-grid">{zona.cards.map((c) => <CardChofer key={c.chofer} c={c} />)}</div>}
    </div>
  );
}
