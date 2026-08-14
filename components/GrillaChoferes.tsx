"use client";
// Grilla de cards de chofer, con los que hoy NO tienen locales asignados plegados
// abajo.
//
// Es el mismo criterio que las cards de centro: un chofer sin ruta asignada no está
// en 0 %, está fuera del día. Dejarlo en la grilla con el tanque de locales vacío lo
// hace indistinguible de uno que salió y no avanzó, y en Regiones son varios: la
// pantalla se llena de medidores en rojo que no piden ninguna acción. Antes solo se
// los mandaba al final de la lista, que no alcanza cuando la grilla ocupa el alto de
// un mural.
//
// Van como card completa y no como chip (a diferencia de los centros) porque el dato
// sigue existiendo: un chofer de la planilla sin locales igual puede haber juntado
// litros, y su tanque 💧 los muestra. Lo que se oculta es el ruido, no la información.
import React, { useMemo } from "react";
import CardChofer from "./CardChofer";
import { sinLocales } from "@/lib/cards";
import { miles } from "@/lib/format";
import type { Card } from "@/lib/types";

export default function GrillaChoferes({ cards, vacio = "Sin datos de choferes." }: {
  cards: Card[];
  /** Mensaje cuando no hay ningún chofer (el filtro no dejó nada, la zona está vacía). */
  vacio?: string;
}) {
  const [conRuta, sinRuta] = useMemo(() => [
    cards.filter((c) => !sinLocales(c)),
    cards.filter((c) => sinLocales(c)),
  ], [cards]);

  if (cards.length === 0) return <p className="muted">{vacio}</p>;

  return (
    <>
      {conRuta.length === 0
        ? <p className="muted">Ningún chofer tiene locales asignados hoy.</p>
        : <div className="card-grid">{conRuta.map((c) => <CardChofer key={c.chofer} c={c} />)}</div>}

      {sinRuta.length > 0 && (
        <details className="off-block">
          <summary>
            Sin locales asignados hoy <span className="tnum">{miles(sinRuta.length)}</span>
          </summary>
          <div className="card-grid off-grid">
            {sinRuta.map((c) => <CardChofer key={c.chofer} c={c} />)}
          </div>
        </details>
      )}
    </>
  );
}
