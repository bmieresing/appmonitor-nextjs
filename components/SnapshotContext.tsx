"use client";
// Un solo poll del snapshot compartido por el header y todas las vistas.
import React, { createContext, useContext, useMemo } from "react";
import { useSnapshot } from "./useSnapshot";
import type { Snapshot } from "@/lib/types";

interface Ctx {
  snap: Snapshot | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

const SnapshotCtx = createContext<Ctx>({ snap: null, error: null, loading: false, refetch: () => {} });

export function SnapshotProvider({ children }: { children: React.ReactNode }) {
  const { snap, error, loading, refetch } = useSnapshot();
  // El objeto del contexto se memoiza: si se armara en cada render, cualquier
  // render del provider (aunque el snapshot fuera el mismo) le cambiaría la
  // identidad al contexto y haría re-render de TODAS las vistas.
  const valor = useMemo(() => ({ snap, error, loading, refetch }), [snap, error, loading, refetch]);
  return <SnapshotCtx.Provider value={valor}>{children}</SnapshotCtx.Provider>;
}

export function useSnap() {
  return useContext(SnapshotCtx);
}
