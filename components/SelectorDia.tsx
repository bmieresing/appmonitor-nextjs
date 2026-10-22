"use client";
// Selector del encabezado: hoy en vivo o el cierre de uno de los 7 días anteriores
// (ver DiaContext). Destacado mientras se mira un día pasado, para que no se
// confunda con el monitor en vivo.
import React, { useMemo } from "react";
import { diasHistorial, nombreDia, useDia } from "./DiaContext";

export default function SelectorDia() {
  const { dia, setDia } = useDia();
  const dias = useMemo(() => diasHistorial(), []);
  return (
    <select className={`sel-dia${dia ? " activo" : ""}`} value={dia ?? ""}
      onChange={(e) => setDia(e.target.value || null)}
      title="Ver el cierre de un día anterior (se guardan 7 días)" aria-label="Día">
      <option value="">Hoy · en vivo</option>
      {dias.map((d, i) => (
        <option key={d} value={d}>{i === 0 ? `Ayer · ${nombreDia(d)}` : nombreDia(d)}</option>
      ))}
    </select>
  );
}
