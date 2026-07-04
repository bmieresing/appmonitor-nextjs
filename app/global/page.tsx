"use client";
import ZoneView from "@/components/ZoneView";
import { useSnap } from "@/components/SnapshotContext";

export default function GlobalPage() {
  const { snap } = useSnap();
  if (!snap) return <p className="muted">Cargando…</p>;
  return <ZoneView zona={snap.zonas.Global} esGlobal />;
}
