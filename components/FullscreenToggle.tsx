"use client";
// Botón de pantalla completa para los carruseles. Combina dos cosas en un clic:
//  1) modo "kiosco" (clase body.kiosk) que oculta la barra superior y pega el
//     contenido arriba para aprovechar todo el alto —útil en TV/monitores—.
//  2) la Fullscreen API real del navegador, que además esconde su propio chrome.
// Si la Fullscreen API falla o se deniega, el modo kiosco igual se aplica.
import React, { useCallback, useEffect, useState } from "react";
import { useSnap } from "./SnapshotContext";

export default function FullscreenToggle() {
  const [on, setOn] = useState(false);
  // En modo kiosco la barra superior se oculta, así que traemos el chip de hora
  // y el botón de actualizar acá para no perderlos.
  const { snap, error, loading, refetch } = useSnap();

  const apply = useCallback((v: boolean) => {
    document.body.classList.toggle("kiosk", v);
    setOn(v);
  }, []);

  const enter = useCallback(async () => {
    apply(true);
    try { await document.documentElement.requestFullscreen(); } catch { /* kiosco basta */ }
  }, [apply]);

  const exit = useCallback(async () => {
    apply(false);
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
  }, [apply]);

  // Sincroniza el estado cuando el usuario sale del fullscreen con ESC/F11, y
  // limpia la clase al desmontar (p. ej. al navegar a otra vista).
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) apply(false); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.body.classList.remove("kiosk");
    };
  }, [apply]);

  const hora = snap?.hora_ciclo
    ? new Date(snap.hora_ciclo).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";
  const hayFalla = !!snap?.falla || (!!error && !snap);

  return (
    <>
      <button
        className={`icon-btn${on ? " active" : ""}`}
        onClick={() => (on ? exit() : enter())}
        title={on ? "Salir de pantalla completa" : "Pantalla completa (ocultar barra superior)"}
        aria-label={on ? "Salir de pantalla completa" : "Pantalla completa"}
      >
        {on ? "⤡" : "⛶"}
      </button>
      {/* Solo en kiosco: chip de hora + actualizar, que en modo normal viven en la barra superior. */}
      {on && (
        <>
          <span className={`chip${hayFalla ? " warn" : ""}`} title={snap?.falla ?? error ?? undefined}>
            <span className="dot" /> {error && !snap ? "sin datos" : hora}
          </span>
          <button className={`icon-btn${loading ? " loading" : ""}`} onClick={refetch} disabled={loading} title="Forzar recálculo: trae datos frescos del Lambda (~30s)" aria-label="Forzar recálculo">
            <span className="spin">↺</span>
          </button>
        </>
      )}
    </>
  );
}
