"use client";
// Vista de zona: fila KPI + grilla de cards (choferes o, en Global, centros).
import React from "react";
import Link from "next/link";
import KpiRow from "./KpiRow";
import Tank from "./Tank";
import { useTheme } from "./ThemeProvider";
import { miles } from "@/lib/format";
import { semaforo, semaforoComp } from "@/lib/theme";
import type { Zona, Card as CardT, Centro } from "@/lib/types";

function CardChofer({ c }: { c: CardT }) {
  const { tokens: t } = useTheme();
  const hasAlta = !!c.sub_alta;
  return (
    <div className={`entity-card${c.cerrado ? " cerrada" : ""}`}>
      <div className="entity-head">
        <span className="entity-name">
          {c.cerrado ? "🔒 " : ""}
          <Link href={`/carrusel?chofer=${encodeURIComponent(c.chofer)}`} style={{ color: t.accent }}>{c.chofer}</Link>
        </span>
        {c.ruta && <span className="entity-route">🗺️ {c.ruta}</span>}
      </div>
      <div className="metric-row">
        <Tank icon="💧" label="Litros" pct={c.pct_lit} color={semaforoComp(c.pct_lit, t)} sub={`${miles(c.litros_hoy)} / ${miles(c.prom)} L`} />
        <Tank icon="🏪" label="Locales" pct={c.pct_loc} color={semaforo(c.pct_loc, t)} sub={c.sub_loc} noAlcPct={c.no_alc_pct_loc ?? 0} />
        {hasAlta && <Tank icon="⭐" label="Alta" pct={c.pct_alta} color={semaforo(c.pct_alta, t)} sub={c.sub_alta} noAlcPct={c.no_alc_pct_alta ?? 0} />}
      </div>
    </div>
  );
}

function CardCentro({ c }: { c: Centro }) {
  const { tokens: t } = useTheme();
  const pct = (r: number, tot: number) => (tot > 0 ? Math.round((r / tot) * 100) : 0);
  const totalAlta = c.total_alta ?? 0;
  return (
    <div className="entity-card">
      <div className="entity-head"><span className="entity-name">{c.centro}</span></div>
      <div className="metric-row">
        <Tank icon="💧" label="Litros" pct={pct(c.litros, c.prom)} color={semaforoComp(pct(c.litros, c.prom), t)} sub={`${miles(c.litros)} / ${miles(c.prom)} L`} />
        <Tank icon="🏪" label="Locales" pct={pct(c.realizados, c.total)} color={semaforo(pct(c.realizados, c.total), t)} sub={`${c.realizados}/${c.total}`} noAlcPct={pct(c.no_alc ?? 0, c.total)} />
        {totalAlta > 0 && (
          <Tank icon="⭐" label="Alta" pct={pct(c.realizados_alta ?? 0, totalAlta)} color={semaforo(pct(c.realizados_alta ?? 0, totalAlta), t)} sub={`${c.realizados_alta ?? 0}/${totalAlta}`} noAlcPct={pct(c.no_alc_alta ?? 0, totalAlta)} />
        )}
      </div>
    </div>
  );
}

export default function ZoneView({ zona, esGlobal }: { zona: Zona; esGlobal: boolean }) {
  return (
    <div>
      <KpiRow zona={zona} />
      <div className="section-title">{esGlobal ? "Centros de acopio" : "Choferes"}</div>
      {esGlobal ? (
        zona.centros.length === 0 ? <p className="muted">Sin datos de centros de acopio.</p>
          : <div className="card-grid">{zona.centros.map((c) => <CardCentro key={c.centro} c={c} />)}</div>
      ) : zona.cards.length === 0 ? <p className="muted">Sin datos de choferes.</p>
        : <div className="card-grid">{zona.cards.map((c) => <CardChofer key={c.chofer} c={c} />)}</div>}
    </div>
  );
}
