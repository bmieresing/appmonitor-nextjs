"use client";
// Triángulo de aviso de una card o pestaña (chofer o centro). Rojo si la ruta está
// asignada y no hay una sola visita, o si el % de prioridad Alta dobla al de litros;
// ámbar si apenas lo supera. La regla vive en lib/cards.ts.
//
// Va como ÍCONO y no como color de la card: la grilla ya tiene el color del centro,
// el semáforo de cada balde y la capa roja de "no alcanzado", y una cuarta señal de
// color volvía la pantalla ilegible. Una forma en la esquina se cuenta de un vistazo
// sin competir con nada.
//
// El triángulo es SVG y no un emoji: los emoji se pintan con la paleta del sistema y
// no se pueden teñir, y acá el color ES el dato (ámbar vs rojo).
import React from "react";
import { desbalance, type DatosAviso } from "@/lib/cards";

// Sobre el hero oscuro del carrusel los tonos del tema se apagan, así que ahí van los
// mismos colores en versión clara —y el signo recortado en tinta oscura, porque el
// triángulo pasa a ser el elemento claro.
const TONO = {
  warn: { normal: "var(--warning)", dark: "#ffd166" },
  alert: { normal: "var(--critical)", dark: "#ff9e9e" },
};

export default function AvisoDesbalance({ size = 17, onDark = false, ...d }:
  DatosAviso & { size?: number; onDark?: boolean }) {
  const nivel = desbalance(d);
  if (!nivel) return null;

  const color = TONO[nivel][onDark ? "dark" : "normal"];
  const tinta = onDark ? "#12281a" : "var(--surface)";
  const tip = d.pctLoc <= 0
    ? "Sin visitas registradas: tiene locales asignados y todavía no pasó por ninguno"
    : `Prioridad Alta ${d.pctAlta}% vs litros ${d.pctLit}%: se cubrieron los locales importantes pero los litros no acompañaron`;

  return (
    <svg className="desb-ico" viewBox="0 0 24 24" width={size} height={size} style={{ color }}
      role="img" aria-label={tip}>
      <title>{tip}</title>
      <path d="M12 2.6 23 21H1z" fill="currentColor" />
      <path d="M12 9.4v5" stroke={tinta} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="18" r="1.2" fill={tinta} />
    </svg>
  );
}
