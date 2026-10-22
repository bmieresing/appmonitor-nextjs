"use client";
// Qué día se está mirando: hoy (null, el monitor en vivo) o uno de los 7 anteriores
// del historial (supabase/historial_schema.sql). De un día pasado se ve su CIERRE:
// el último snapshot de ese día y su GPS completo, como si se mirara a las 23:59.
//
// Va en la URL (`?dia=2026-10-21`) para poder recargar o compartir el link. La
// fuente de verdad es este estado —el layout no se desmonta al navegar—, y un
// efecto vuelve a poner el parámetro cuando un link de la app lo pierde.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

/** Días anteriores a hoy que guarda el historial (la limpieza borra lo más viejo). */
export const DIAS_HISTORIAL = 7;

/** Fecha de hoy en Chile, YYYY-MM-DD: el día del monitor no es el del UTC. */
export function diaHoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

/** Los días del historial, del más reciente (ayer) al más viejo. */
export function diasHistorial(): string[] {
  const [a, m, d] = diaHoy().split("-").map(Number);
  return Array.from({ length: DIAS_HISTORIAL }, (_, i) =>
    new Date(Date.UTC(a, m - 1, d - 1 - i)).toISOString().slice(0, 10));
}

/** "mar 21-10": cómo se nombra un día en el selector y en el aviso. */
export function nombreDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const sem = new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-CL", { weekday: "short", timeZone: "UTC" });
  return `${sem.replace(".", "")} ${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}`;
}

// Un `?dia=` que ya salió del historial (link viejo) se ignora: se abre hoy.
function diaDeUrl(): string | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("dia");
  return v && diasHistorial().includes(v) ? v : null;
}

interface Ctx {
  dia: string | null;               // null = hoy
  setDia: (dia: string | null) => void;
}

const DiaCtx = createContext<Ctx>({ dia: null, setDia: () => {} });

export function DiaProvider({ children }: { children: React.ReactNode }) {
  // Se lee al montar y no en un efecto: el primer fetch del snapshot tiene que
  // salir ya con el día pedido, no traer hoy y después cambiar.
  const [dia, setDia] = useState<string | null>(diaDeUrl);
  const pathname = usePathname();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("dia") === dia) return;
    if (dia) url.searchParams.set("dia", dia); else url.searchParams.delete("dia");
    window.history.replaceState(null, "", url);
  }, [dia, pathname]);

  const valor = useMemo(() => ({ dia, setDia }), [dia]);
  return <DiaCtx.Provider value={valor}>{children}</DiaCtx.Provider>;
}

export function useDia() {
  return useContext(DiaCtx);
}
