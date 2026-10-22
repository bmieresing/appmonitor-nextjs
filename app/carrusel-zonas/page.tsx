"use client";
// Carrusel Zonas (Global → Santiago → Regiones). El ciclo vive en CarruselZonas;
// esta vista le suma el botón de pantalla completa.
import CarruselZonas from "@/components/CarruselZonas";
import FullscreenToggle from "@/components/FullscreenToggle";

export default function CarruselZonasPage() {
  return <CarruselZonas controles={<FullscreenToggle />} />;
}
