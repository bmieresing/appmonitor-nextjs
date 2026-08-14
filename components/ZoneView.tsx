"use client";
// Vista de zona: fila KPI + grilla de cards (choferes o, en Global, centros).
import React, { useMemo, useState } from "react";
import Link from "next/link";
import KpiRow from "./KpiRow";
import Tank from "./Tank";
import GrillaChoferes from "./GrillaChoferes";
import AvisoDesbalance from "./AvisoDesbalance";
import { useTheme } from "./ThemeProvider";
import { useCentroColores } from "./CentroColores";
import { miles } from "@/lib/format";
import { semaforo } from "@/lib/theme";
import type { Zona, Centro } from "@/lib/types";

function CardCentro({ c }: { c: Centro }) {
  const { tokens: t } = useTheme();
  const { colorDe } = useCentroColores();
  const pct = (r: number, tot: number) => (tot > 0 ? Math.round((r / tot) * 100) : 0);
  const totalAlta = c.total_alta ?? 0;
  const pctLoc = pct(c.realizados, c.total);
  const pctLit = pct(c.litros, c.prom);
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
        <AvisoDesbalance hayLocales={c.total > 0} pctLoc={pctLoc} pctAlta={pct(c.realizados_alta ?? 0, totalAlta)}
          pctLit={pctLit} hayAlta={totalAlta > 0} hayEsperado={c.prom > 0} />
        <span className="entity-name" style={color ? { color } : undefined}>{c.centro}</span>
      </div>
      <div className="metric-row">
        <Tank icon="💧" label="Litros" pct={pctLit} color={semaforo(pctLit, t)} sub={`${miles(c.litros)} / ${miles(c.prom)} L`} />
        <Tank icon="🏪" label="Locales" pct={pctLoc} color={semaforo(pctLoc, t)} sub={`${c.realizados}/${c.total}`} noAlcPct={pct(c.no_alc ?? 0, c.total)} noAlcN={c.no_alc} />
        {totalAlta > 0 && (
          <Tank icon="⭐" label="Alta" pct={pct(c.realizados_alta ?? 0, totalAlta)} color={semaforo(pct(c.realizados_alta ?? 0, totalAlta), t)} sub={`${c.realizados_alta ?? 0}/${totalAlta}`} noAlcPct={pct(c.no_alc_alta ?? 0, totalAlta)} noAlcN={c.no_alc_alta} />
        )}
      </div>
    </Link>
  );
}

// Centro que hoy no tiene ni un local asignado. NO es un centro al 0 %: es un
// centro que no salió a la calle, y dibujarlo con los mismos tanques en rojo lo
// hacía indistinguible del que sí salió y va mal — con la mayoría de los centros
// sin ruta en un día normal, dos tercios de la pantalla principal gritaban alarma
// por nada. Va como chip atenuado, sin semáforo y sin link (no hay choferes que
// mostrar del otro lado).
function ChipCentroSinRuta({ c }: { c: Centro }) {
  const { colorDe } = useCentroColores();
  const color = colorDe(c.centro);
  return (
    <span className="centro-off" title={`${c.centro}: sin locales asignados hoy`}>
      <span className="centro-off-dot" style={{ background: color ?? "var(--muted)" }} />
      <span className="centro-off-nom">{c.centro}</span>
      {c.prom > 0 && <span className="centro-off-prom tnum">{miles(c.prom)} L esperados</span>}
    </span>
  );
}

export default function ZoneView({ zona, esGlobal }:
  { zona: Zona; esGlobal: boolean }) {
  // Un centro sin locales asignados no tiene porcentaje que mostrar: se separa del
  // resto en vez de competir con los que sí están operando.
  const [activos, sinRuta] = useMemo(() => [
    zona.centros.filter((c) => c.total > 0),
    zona.centros.filter((c) => c.total === 0),
  ], [zona.centros]);

  // En Global la sección se puede intercambiar entre los centros de acopio (lo que se
  // ve siempre, es la lectura por defecto del día) y la grilla con TODOS los choferes,
  // que en Global es la unión de Santiago + Regiones. Solo cambia esta sección: los
  // KPIs de arriba son los mismos en las dos pestañas.
  const [vista, setVista] = useState<"centros" | "choferes">("centros");
  const verChoferes = esGlobal && vista === "choferes";

  return (
    <div>
      <KpiRow zona={zona} />
      {esGlobal ? (
        <div className="section-head">
          <div className="section-title">{verChoferes ? "Choferes" : "Centros de acopio"}</div>
          <div className="tab-sw" role="tablist" aria-label="Qué mostrar en esta sección">
            <button role="tab" aria-selected={!verChoferes} onClick={() => setVista("centros")}
              className={`tab-sw-btn${!verChoferes ? " on" : ""}`}>
              🏭 Centros <span className="n">{activos.length}</span>
            </button>
            <button role="tab" aria-selected={verChoferes} onClick={() => setVista("choferes")}
              className={`tab-sw-btn${verChoferes ? " on" : ""}`}>
              🚚 Choferes <span className="n">{zona.cards.length}</span>
            </button>
          </div>
        </div>
      ) : <div className="section-title">Choferes</div>}
      {esGlobal && !verChoferes ? (
        zona.centros.length === 0 ? <p className="muted">Sin datos de centros de acopio.</p> : (
          <>
            {activos.length === 0
              ? <p className="muted">Ningún centro tiene locales asignados hoy.</p>
              : <div className="card-grid">{activos.map((c) => <CardCentro key={c.centro} c={c} />)}</div>}
            {sinRuta.length > 0 && (
              <details className="off-block">
                <summary>
                  Sin ruta hoy <span className="tnum">{sinRuta.length}</span>
                </summary>
                <div className="centros-off-lista">
                  {sinRuta.map((c) => <ChipCentroSinRuta key={c.centro} c={c} />)}
                </div>
              </details>
            )}
          </>
        )
      ) : <GrillaChoferes cards={zona.cards} />}
    </div>
  );
}
