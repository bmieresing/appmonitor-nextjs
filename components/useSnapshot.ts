"use client";
// Hook de datos con dos caminos:
//  · cargar()  → lee el snapshot materializado de Supabase (rápido). Corre en el
//    poll automático cada 60 s.
//  · refetch() → FUERZA un recálculo: pega a /api/refresh (que dispara el Lambda)
//    y trae datos frescos (~30 s). Lo usa el botón "Actualizar".
// Mantiene el último snapshot bueno mientras recarga (no parpadea) y nunca pisa
// un snapshot más nuevo con uno más viejo (gana el de generated_at más reciente),
// así el poll no revierte un recálculo recién forzado.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/types";

const INTERVALO_MS = 60_000;

function ganaElNuevo(nuevo: Snapshot, actual: Snapshot | null): boolean {
  if (!actual) return true;
  const a = Date.parse(nuevo.generated_at ?? "");
  const b = Date.parse(actual.generated_at ?? "");
  if (Number.isNaN(a) || Number.isNaN(b)) return true;
  return a >= b;
}

export function useSnapshot() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const vivo = useRef(true);
  const snapRef = useRef<Snapshot | null>(null);

  const aplicar = useCallback((nuevo: Snapshot) => {
    if (!vivo.current) return;
    if (ganaElNuevo(nuevo, snapRef.current)) {
      snapRef.current = nuevo;
      setSnap(nuevo);
    }
    setError(null);
  }, []);

  // marcarLoading: solo el recálculo forzado (botón) mueve el spinner. El poll
  // de fondo NO lo toca — si no, un GET rápido que cae durante un refetch lento
  // apagaría el spinner antes de que llegue el snapshot fresco.
  const pedir = useCallback(async (endpoint: string, method: "GET" | "POST", marcarLoading: boolean) => {
    if (marcarLoading) setLoading(true);
    try {
      const r = await fetch(endpoint, { method, cache: "no-store" });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
      aplicar(body as Snapshot);
    } catch (e) {
      if (vivo.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (marcarLoading && vivo.current) setLoading(false);
    }
  }, [aplicar]);

  // Poll silencioso: lee la tabla materializada (no mueve el spinner).
  const cargar = useCallback(() => pedir("/api/snapshot", "GET", false), [pedir]);
  // Botón: fuerza el recálculo contra el Lambda (spinner hasta que aplica datos).
  const refetch = useCallback(() => pedir("/api/refresh", "POST", true), [pedir]);

  useEffect(() => {
    vivo.current = true;
    cargar();
    const id = setInterval(cargar, INTERVALO_MS);
    return () => { vivo.current = false; clearInterval(id); };
  }, [cargar]);

  return { snap, error, loading, refetch };
}
