"use client";
// Regiones partido en dos mitades —Norte y Sur— que se alternan solas. Es la
// alternativa al feed auto-desplazable (`AutoScrollCards`) del Carrusel Zonas: en
// vez de arrastrar la lista entera de choferes por la pantalla, muestra media flota
// quieta el tiempo suficiente para leerla y después cambia de mitad. Cada mitad
// dura lo mismo que una zona entera (`mitadMs`), así que Regiones se lleva el doble
// de tiempo que Global o Santiago — es el doble de gente.
//
// El corte Norte/Sur y la cáscara (card teñida + switch) son los mismos de la vista
// Regiones: acá el switch cambia solo, allá lo mueve el operador.
import React, { useEffect, useMemo, useState } from "react";
import KpiRow from "./KpiRow";
import CardChofer from "./CardChofer";
import MarcoMitades from "./MarcoMitades";
import { useCentroColores } from "./CentroColores";
import { useTheme } from "./ThemeProvider";
import { agruparMitades, colorMitad, ICONO_MITAD, MITADES, type Mitad } from "@/lib/mitades";
import { miles } from "@/lib/format";
import type { Zona } from "@/lib/types";

export default function RegionesMitades({ zona, mitadMs, pausado = false }:
  { zona: Zona; mitadMs: number; pausado?: boolean }) {
  const { centroDe, zonaMap } = useCentroColores();
  const { tokens: t } = useTheme();
  const [idx, setIdx] = useState(0);

  const grupos = useMemo(
    () => agruparMitades(zona.cards, centroDe, zonaMap),
    [zona.cards, centroDe, zonaMap],
  );

  // Sin auto, la mitad no cambia sola: queda fija en la que esté y solo se mueve con
  // el switch. Apagar el ciclo de zonas y que las mitades siguieran rotando dejaba la
  // pantalla igual de inquieta que antes.
  useEffect(() => {
    if (pausado) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % MITADES.length), mitadMs);
    return () => clearInterval(id);
  }, [mitadMs, pausado]);

  const mitad = MITADES[idx];
  const cards = grupos[mitad];

  return (
    <div>
      <KpiRow zona={zona} />
      <div className="section-title">Choferes</div>
      <MarcoMitades activa={mitad} onCambiar={(id) => setIdx(MITADES.indexOf(id as Mitad))}
        opciones={MITADES.map((m) => ({ id: m, label: m, icono: ICONO_MITAD[m], color: colorMitad(m, t), n: grupos[m].length }))}>
        {cards.length === 0 ? <p className="muted">Sin choferes en {mitad}.</p>
          : <div className="card-grid">{cards.map((c) => <CardChofer key={c.chofer} c={c} />)}</div>}
      </MarcoMitades>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {miles(zona.cards.length)} choferes en Regiones · {miles(grupos.Norte.length)} Norte · {miles(grupos.Sur.length)} Sur
      </p>
    </div>
  );
}
