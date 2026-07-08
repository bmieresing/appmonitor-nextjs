"use client";
// Columna auto-desplazable de cards de chofer (feed vertical). Se usa en el
// Carrusel Zonas para Regiones y en la página /carrusel-regiones. Loop continuo
// sin salto: lista DUPLICADA + translateY -50% (CSS .vscroll-*), con margen
// uniforme por item para que la costura no se note. El alto del viewport se mide
// por JS: así llena el espacio restante debajo de lo que haya arriba (KpiRow,
// toolbar) y se re-ajusta al entrar/salir de pantalla completa (modo kiosco).
import { useLayoutEffect, useRef, useState } from "react";
import CardChofer from "./CardChofer";
import type { Card as CardT } from "@/lib/types";

// Velocidad: segundos que tarda cada card en cruzar la pantalla (más = más lento).
const SEG_POR_CARD = 4;

// Duración de una pasada completa (para que quien cicla las zonas espere a que
// termine antes de avanzar).
export function duracionScrollMs(nCards: number): number {
  return Math.max(nCards * SEG_POR_CARD, 20) * 1000;
}

export default function AutoScrollCards({ cards, pausado = false }: { cards: CardT[]; pausado?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const top = el.getBoundingClientRect().top;
      setAlto(Math.max(240, Math.round(window.innerHeight - top - 16)));
    };
    medir();
    window.addEventListener("resize", medir);
    document.addEventListener("fullscreenchange", medir);
    // El modo kiosco oculta la barra superior sin disparar fullscreenchange si la
    // API se deniega: un recálculo periódico barato cubre ese cambio de layout.
    const id = window.setInterval(medir, 1200);
    return () => {
      window.removeEventListener("resize", medir);
      document.removeEventListener("fullscreenchange", medir);
      window.clearInterval(id);
    };
  }, []);

  if (cards.length === 0) return <p className="muted">Sin datos de choferes.</p>;
  const duracion = Math.max(cards.length * SEG_POR_CARD, 20);

  return (
    <div className="vscroll-viewport" ref={ref} style={{ height: alto || undefined }}>
      {/* GRILLA duplicada (mismas columnas que caben por pantalla): la animación
          traslada -50%, así al terminar la 2ª copia queda donde arrancó la 1ª. */}
      <div
        className="vscroll-track"
        style={{ animationDuration: `${duracion}s`, animationPlayState: pausado ? "paused" : "running" }}
      >
        <div className="card-grid vscroll-copy">
          {cards.map((c) => <CardChofer key={c.chofer} c={c} />)}
        </div>
        <div className="card-grid vscroll-copy" aria-hidden="true">
          {cards.map((c) => <CardChofer key={c.chofer} c={c} />)}
        </div>
      </div>
    </div>
  );
}
