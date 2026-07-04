"use client";
import ZoneView from "@/components/ZoneView";
import { useSnap } from "@/components/SnapshotContext";

export default function RegionesPage() {
  const { snap } = useSnap();
  if (!snap) return <p className="muted">Cargando…</p>;
  return <ZoneView zona={snap.zonas.Regiones} esGlobal={false} />;
}
