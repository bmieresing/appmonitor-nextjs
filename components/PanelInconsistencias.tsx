"use client";
// Panel de congruencia con el sistema: lo que el monitor muestra hoy y no va a estar
// mañana en rendering_db2 (o al revés).
//
// El monitor lee VistaMonitor + LocalesRuta y lo que sube es ResumenCompleto, que
// comparte con ellas las tablas base y el filtro de actividad. Cuando aun así algo no
// calza —una visita sin tripulación, un local dado por realizado sin recolección— la
// diferencia aparecía como un número que bajaba de un día para el otro sin dejar
// rastro. Acá se nombra: cuántos son, qué litros mueven y qué locales.
//
// Va plegado por defecto y no pinta nada cuando no hay diferencias: es un panel de
// excepciones, no un widget permanente.
import React from "react";
import { miles } from "@/lib/format";
import type { Inconsistencias } from "@/lib/types";

export default function PanelInconsistencias({ inc }: { inc?: Inconsistencias }) {
  if (!inc || inc.total === 0) return null;
  const litrosTotal = inc.grupos.reduce((s, g) => s + (g.litros || 0), 0);

  return (
    <div className="card card-pad" style={{ marginTop: 16, borderLeft: "3px solid var(--warning)" }}>
      <div className="section-title" style={{ margin: "0 0 10px" }}>
        ⚠️ Registros que no calzan con el sistema{" "}
        <span style={{ color: "var(--muted)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
          · {miles(inc.total)} {inc.total === 1 ? "registro" : "registros"}
          {litrosTotal > 0 && ` · ${miles(litrosTotal)} L involucrados`}
        </span>
      </div>

      {inc.grupos.map((g) => (
        <details key={g.clave} style={{ marginBottom: 8 }}>
          <summary style={{ cursor: "pointer", padding: "6px 0", fontWeight: 600 }}>
            {g.titulo}{" "}
            <span className="tnum" style={{ color: "var(--warning)" }}>{miles(g.n)}</span>
            {g.litros > 0 && (
              <span className="tnum" style={{ color: "var(--muted)", fontWeight: 500 }}>
                {" "}· {miles(g.litros)} L
              </span>
            )}
          </summary>
          <p className="muted" style={{ margin: "4px 0 8px", fontSize: 12 }}>{g.detalle}</p>
          <div className="tbl-wrap">
            <table className="data grid">
              <thead>
                <tr>
                  <th style={{ textAlign: "right" }}>ID</th>
                  <th>Local</th>
                  <th style={{ textAlign: "right" }}>Litros</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {g.ejemplos.map((e, i) => (
                  <tr key={`${e.id_local ?? "x"}-${i}`}>
                    <td className="tnum" style={{ color: "var(--muted)", textAlign: "right" }}>{e.id_local ?? "—"}</td>
                    <td>{e.local || "—"}</td>
                    <td className="tnum" style={{ textAlign: "right" }}>{e.litros ? `${miles(e.litros)} L` : "—"}</td>
                    <td style={{ color: "var(--muted)" }}>{e.estado ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* El publisher trunca la lista para no inflar el snapshot: si el conteo
              supera lo que llegó, se dice explícitamente en vez de dejar creer que
              la tabla es todo. */}
          {g.n > g.ejemplos.length && (
            <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
              Se muestran {miles(g.ejemplos.length)} de {miles(g.n)}.
            </p>
          )}
        </details>
      ))}
    </div>
  );
}
