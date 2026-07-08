"use client";
// Card de un chofer (usada en ZoneView, el feed auto-scroll y carrusel-zonas). Se
// separó de ZoneView para poder reusarla sin import circular con AutoScrollCards.
import React from "react";
import Link from "next/link";
import Tank from "./Tank";
import { useTheme } from "./ThemeProvider";
import { useCentroColores, estiloRuta } from "./CentroColores";
import { miles } from "@/lib/format";
import { semaforo, semaforoComp } from "@/lib/theme";
import type { Card as CardT } from "@/lib/types";

export default function CardChofer({ c }: { c: CardT }) {
  const { tokens: t } = useTheme();
  const { centroDe, colorDe } = useCentroColores();
  const hasAlta = !!c.sub_alta;
  // Recuadro tenue de la ruta con el color del centro de acopio: la tripulación
  // del sheet → centro (mapeo editable) → color. Sin match → estilo plano.
  const centro = centroDe(c.tripulacion);
  const rutaColor = colorDe(centro);
  return (
    <div className={`entity-card${c.cerrado ? " cerrada" : ""}`}>
      <div className="entity-head">
        <span className="entity-name">
          {c.cerrado ? "🔒 " : ""}
          <Link href={`/carrusel?chofer=${encodeURIComponent(c.chofer)}`} style={{ color: t.accent }}>{c.chofer}</Link>
        </span>
        {c.ruta && (
          <span className="entity-route" style={estiloRuta(rutaColor)} title={centro ?? c.tripulacion ?? undefined}>
            🗺️ {c.ruta}
          </span>
        )}
      </div>
      <div className="metric-row">
        <Tank icon="💧" label="Litros" pct={c.pct_lit} color={semaforoComp(c.pct_lit, t)} sub={`${miles(c.litros_hoy)} / ${miles(c.prom)} L`} />
        <Tank icon="🏪" label="Locales" pct={c.pct_loc} color={semaforo(c.pct_loc, t)} sub={c.sub_loc} noAlcPct={c.no_alc_pct_loc ?? 0} noAlcN={c.no_alc_loc} />
        {hasAlta && <Tank icon="⭐" label="Alta" pct={c.pct_alta} color={semaforo(c.pct_alta, t)} sub={c.sub_alta} noAlcPct={c.no_alc_pct_alta ?? 0} noAlcN={c.no_alc_alta} />}
      </div>
    </div>
  );
}
