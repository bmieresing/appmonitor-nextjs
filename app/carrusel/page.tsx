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
  return <CarruselView carrusel={snap.carrusel} initialChofer={chofer} />;
}

export default function CarruselPage() {
  return (
    <Suspense fallback={<p className="muted">Cargando…</p>}>
      <CarruselInner />
    </Suspense>
  );
}
