"use client";
// Rendimiento (FUERA del menú): la pestaña pasó a ser una sección de Estadísticas.
// La ruta se conserva para no romper links viejos y renderiza esa misma sección.
import SeccionRendimiento from "@/components/estadisticas/SeccionRendimiento";
import { useSnap } from "@/components/SnapshotContext";

export default function RendimientoPage() {
  const { snap } = useSnap();
  if (!snap) return <p className="muted">Cargando…</p>;
  return <SeccionRendimiento rendimiento={snap.rendimiento} />;
}
