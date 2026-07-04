"use client";
// Un solo poll del snapshot compartido por el header y todas las vistas.
import React, { createContext, useContext } from "react";
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
  return <SnapshotCtx.Provider value={{ snap, error, loading, refetch }}>{children}</SnapshotCtx.Provider>;
}

export function useSnap() {
  return useContext(SnapshotCtx);
}
