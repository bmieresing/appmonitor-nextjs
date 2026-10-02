"use client";
// Ventana por encima de la página para ver un mapa en grande (vista Mapa y
// Carrusel). El mapa de adentro es una instancia NUEVA, no el del panel movido:
// Leaflet no se lleva bien con cambiar de contenedor, y crear otra con el alto de
// la ventana es más simple que reacomodar la chica.
//
// Va por portal a <body> para quedar encima de todo (tabs, barras, otras cards).
// El modo kiosco pone en pantalla completa el documento entero, así que el portal
// se sigue viendo. Se cierra con la ✕, con Escape o clickeando el fondo.
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/** Botón "⤢" para los encabezados de los paneles de mapa. */
export function BotonAgrandar({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn mapa-agrandar" onClick={onClick} title="Ver el mapa en grande" aria-label="Ver el mapa en grande">
      ⤢
    </button>
  );
}

export default function MapaModal({
  titulo,
  subtitulo,
  onClose,
  pie,
  children,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  onClose: () => void;
  /** Debajo del mapa: los controles de la reproducción, cuando corresponde. */
  pie?: React.ReactNode;
  /** El mapa. Tiene que ocupar el alto que le den (alto="100%"). */
  children: React.ReactNode;
}) {
  // Ref y no dependencia: los llamadores pasan una flecha nueva en cada render, y
  // el efecto (listener + bloqueo de scroll) tiene que correr una sola vez.
  const cerrar = useRef(onClose);
  cerrar.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar.current(); };
    document.addEventListener("keydown", onKey);
    // Sin esto la página de atrás scrollea con la rueda cuando el cursor sale del mapa.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="mapa-modal-fondo" onClick={onClose}>
      <div className="mapa-modal card" role="dialog" aria-modal="true" aria-label={titulo}
        onClick={(e) => e.stopPropagation()}>
        <div className="mapa-modal-head">
          <div className="mapa-panel-id">
            <div className="mapa-panel-tit">{titulo}</div>
            {subtitulo}
          </div>
          <button className="icon-btn" onClick={onClose} title="Cerrar (Esc)" aria-label="Cerrar">✕</button>
        </div>
        <div className="mapa-modal-cuerpo">{children}</div>
        {pie && <div className="mapa-modal-pie">{pie}</div>}
      </div>
    </div>,
    document.body,
  );
}
