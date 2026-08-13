"use client";
// Marco de una sección de la vista Estadísticas: encabezado con título y bajada a la
// izquierda, y la barra de filtros de ESA sección a la derecha.
//
// Cada sección filtra lo suyo y no hay filtros globales de página: dos secciones
// miran cosas distintas (asignación del día, efectividad histórica) y un filtro
// compartido obligaría a que las dos entiendan lo mismo por "centro" o por "chofer".
import React from "react";

export default function Seccion({ icono, titulo, bajada, filtros, children }: {
  icono: string;
  titulo: string;
  bajada?: string;
  filtros?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="est-seccion">
      <header className="est-head">
        <div className="est-head-txt">
          <h2 className="est-tit">{icono} {titulo}</h2>
          {bajada && <p className="est-bajada">{bajada}</p>}
        </div>
        {filtros && <div className="est-filtros">{filtros}</div>}
      </header>
      {children}
    </section>
  );
}
