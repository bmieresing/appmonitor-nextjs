"use client";
// Trazas GPS del día para la vista Mapa. Se piden una vez por cada snapshot nuevo:
// el trigger escribe `gps` en la misma fila y en el mismo momento que `data`, así
// que el `generated_at` del snapshot en memoria ya dice cuándo hay algo nuevo. Sin
// poll propio y sin cargar las trazas en las vistas que no las usan.
//
// Si falla, la vista sigue sin GPS (rutas con la línea punteada de siempre): el GPS
// es un agregado y no muestra error propio.
import { useEffect, useState } from "react";
import type { Gps } from "@/lib/types";

const VACIO: Gps = {};

export function useGps(generatedAt: string | null | undefined): Gps {
  const [gps, setGps] = useState<Gps>(VACIO);

  useEffect(() => {
    if (!generatedAt) return;
    let vivo = true;
    fetch("/api/gps", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { gps?: Gps } | null) => {
        if (vivo && body?.gps) setGps(body.gps);
      })
      .catch(() => { /* sin GPS: la vista sigue igual */ });
    return () => { vivo = false; };
  }, [generatedAt]);

  return gps;
}
