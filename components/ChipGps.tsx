"use client";
// Chip "GPS hh:mm" del encabezado: cuándo respondió bien por última vez el Lambda
// GPS (Pegasus, cada minuto), traiga o no puntos nuevos. Va al lado del chip del
// snapshot porque son dos relojes distintos: el snapshot se recalcula cada 5 min y
// el GPS cada minuto, y uno puede estar al día mientras el otro falla.
import React from "react";
import { useGpsEstado } from "./useGps";

/** Sin actualizar por más que esto ⇒ amarillo. El Lambda corre cada minuto: cinco
 *  minutos son varios ciclos seguidos fallando, no un ciclo lento. */
const ATRASO_MIN = 5;

export default function ChipGps() {
  const { actualizado, error } = useGpsEstado();
  const fecha = actualizado ? new Date(actualizado) : null;
  const atrasado = !fecha || Date.now() - fecha.getTime() > ATRASO_MIN * 60_000;
  const hora = fecha
    ? fecha.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const titulo = error
    ? "No se pudo leer el estado del GPS"
    : !fecha
      ? "El GPS todavía no se actualizó hoy"
      : atrasado
        ? `GPS sin actualizar desde las ${hora} (se actualiza cada minuto)`
        : `GPS de los camiones actualizado a las ${hora} (se actualiza cada minuto)`;
  return (
    <span className={`chip${atrasado || error ? " warn" : ""}`} title={titulo}>
      <span className="dot" /> GPS {hora}
    </span>
  );
}
