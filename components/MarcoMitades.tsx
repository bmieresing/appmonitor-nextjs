"use client";
// Marco de las mitades: una card grande teñida con el color de la opción activa y,
// arriba al centro, el switch que dice cuál se está viendo y permite cambiarla.
//
// Es solo la cáscara: quién arma las opciones y qué va adentro lo decide cada vista.
// El Carrusel Zonas la usa con Norte / Sur alternando solas; Regiones agrega "Todos"
// y las cambia a mano. Que las dos compartan la cáscara es lo que hace que la vista
// interactiva y la de pantalla se vean como la misma cosa.
import React from "react";
import { tintaSobre } from "./CentroColores";
import { miles } from "@/lib/format";

export interface OpcionMitad {
  id: string;
  label: string;
  icono?: string;
  color: string;   // hex: el switch calcula sobre él la tinta del texto activo
  n: number;       // cuántas cards tiene esa opción
}

export default function MarcoMitades({ opciones, activa, onCambiar, children }: {
  opciones: OpcionMitad[];
  activa: string;
  onCambiar: (id: string) => void;
  children: React.ReactNode;
}) {
  const op = opciones.find((o) => o.id === activa) ?? opciones[0];
  return (
    <div className="card card-pad mitad-card"
      style={{ borderColor: op.color, background: `color-mix(in srgb, ${op.color} 7%, var(--surface))` }}>
      <div className="mitad-sw">
        {opciones.map((o) => {
          const on = o.id === activa;
          return (
            <button key={o.id} className={`mitad-sw-btn${on ? " on" : ""}`} onClick={() => onCambiar(o.id)}
              style={on
                ? { background: o.color, borderColor: o.color, color: tintaSobre(o.color) }
                : { color: o.color, borderColor: `color-mix(in srgb, ${o.color} 35%, var(--border))` }}>
              <span>{o.icono ? `${o.icono} ` : ""}{o.label}</span>
              <span className="n tnum">{miles(o.n)}</span>
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
