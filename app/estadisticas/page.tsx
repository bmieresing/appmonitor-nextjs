"use client";
// Estadísticas: una pestaña con varias secciones independientes, cada una con sus
// propios filtros —el formato de un reporte, no el de un tablero de operación—.
// Reemplaza a la vieja pestaña Rendimiento, que hoy es una sección más de acá.
//
// Todo sale del snapshot que ya se está poleando: ninguna sección consulta aparte.
// Agregar una sección es escribir su componente y sumarlo a esta lista.
import SeccionAsignacion from "@/components/estadisticas/SeccionAsignacion";
import SeccionRendimiento from "@/components/estadisticas/SeccionRendimiento";
import { useSnap } from "@/components/SnapshotContext";

export default function EstadisticasPage() {
  const { snap } = useSnap();
  if (!snap) return <p className="muted">Cargando…</p>;

  return (
    <div className="est-page">
      <SeccionAsignacion carrusel={snap.carrusel} />
      <SeccionRendimiento rendimiento={snap.rendimiento} />
    </div>
  );
}
