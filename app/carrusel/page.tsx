"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CarruselView from "@/components/CarruselView";
import { useSnap } from "@/components/SnapshotContext";

function CarruselInner() {
  const { snap } = useSnap();
  const params = useSearchParams();
  const chofer = params.get("chofer") ?? undefined;
  if (!snap) return <p className="muted">Cargando…</p>;
  // `zonas.Global` alimenta la pestaña Global: sus KPIs ya los calculó el publisher
  // (son los mismos de la vista Global), así que el carrusel no los vuelve a sumar.
  return <CarruselView carrusel={snap.carrusel} global={snap.zonas?.Global} initialChofer={chofer} />;
}

export default function CarruselPage() {
  return (
    <Suspense fallback={<p className="muted">Cargando…</p>}>
      <CarruselInner />
    </Suspense>
  );
}
