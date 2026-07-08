"use client";
// Tab Regiones: dropdown para filtrar por centro de acopio + cards de chofer.
// El filtro viaja en la URL (?centro=…) para que el clic en una card de centro
// (vista Global) llegue acá ya filtrado. El centro de cada chofer se resuelve en
// el front desde su tripulación (mapeo editable), igual que el color.
import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ZoneView from "@/components/ZoneView";
import FiltroCentro from "@/components/FiltroCentro";
import { useSnap } from "@/components/SnapshotContext";
import { useCentroColores } from "@/components/CentroColores";

function RegionesInner() {
  const { snap } = useSnap();
  const { centroDe, colorDe, zonaMap } = useCentroColores();
  const router = useRouter();
  const params = useSearchParams();
  const centro = params.get("centro") ?? "";

  const zonaReg = snap?.zonas.Regiones;

  // Centros presentes hoy en Regiones (para el dropdown), ordenados norte→sur
  // según el `orden` del mapeo.
  const centrosPresentes = useMemo(() => {
    if (!zonaReg) return [];
    const set = new Set<string>();
    for (const c of zonaReg.cards) {
      const ce = centroDe(c.tripulacion);
      if (ce) set.add(ce);
    }
    const orden = new Map(zonaMap.map((m) => [m.centro, m.orden] as const));
    return [...set].sort((a, b) => (orden.get(a) ?? 999) - (orden.get(b) ?? 999));
  }, [zonaReg, centroDe, zonaMap]);

  if (!snap || !zonaReg) return <p className="muted">Cargando…</p>;

  const cards = centro
    ? zonaReg.cards.filter((c) => centroDe(c.tripulacion) === centro)
    : zonaReg.cards;
  const setFiltro = (c: string) =>
    router.replace(c ? `/regiones?centro=${encodeURIComponent(c)}` : "/regiones");

  return (
    <div>
      <FiltroCentro centros={centrosPresentes} valor={centro} onChange={setFiltro} colorDe={colorDe} />
      <ZoneView zona={{ ...zonaReg, cards }} esGlobal={false} />
    </div>
  );
}

export default function RegionesPage() {
  // Suspense: useSearchParams lo requiere en el App Router.
  return (
    <Suspense fallback={<p className="muted">Cargando…</p>}>
      <RegionesInner />
    </Suspense>
  );
}
