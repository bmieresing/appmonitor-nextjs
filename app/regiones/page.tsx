"use client";
// Tab Regiones: filtro por centro de acopio + switch Todos / Norte / Sur + cards de
// chofer. El filtro de centro viaja en la URL (?centro=…) para que el clic en una
// card de centro (vista Global) llegue acá ya filtrado. El centro de cada chofer se
// resuelve en el front desde su tripulación (mapeo editable), igual que el color.
//
// La cáscara —card grande teñida y switch al centro— es la misma del Carrusel Zonas
// (MarcoMitades), para que la vista que se opera y la que se proyecta se lean igual.
// Las diferencias son las de cada uso: acá el switch lo mueve el operador, hay un
// "Todos" que allá no tendría sentido (la pantalla justamente parte la flota para
// que entre) y el filtro por centro sigue mandando sobre las tres opciones.
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import KpiRow from "@/components/KpiRow";
import CardChofer from "@/components/CardChofer";
import MarcoMitades from "@/components/MarcoMitades";
import FiltroCentro from "@/components/FiltroCentro";
import { useSnap } from "@/components/SnapshotContext";
import { useCentroColores } from "@/components/CentroColores";
import { useTheme } from "@/components/ThemeProvider";
import { conSinLocalesAlFinal } from "@/lib/cards";
import { agruparMitades, colorMitad, ICONO_MITAD, MITADES } from "@/lib/mitades";

const TODOS = "Todos";

function RegionesInner() {
  const { snap } = useSnap();
  const { centroDe, colorDe, zonaMap } = useCentroColores();
  const { tokens: t } = useTheme();
  const router = useRouter();
  const params = useSearchParams();
  const centro = params.get("centro") ?? "";
  const [mitad, setMitad] = useState<string>(TODOS);

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

  // El centro filtra primero y la mitad después: el switch cuenta y muestra lo que
  // quedó del centro elegido, no la flota entera.
  const delCentro = useMemo(() => {
    const base = zonaReg?.cards ?? [];
    return conSinLocalesAlFinal(centro ? base.filter((c) => centroDe(c.tripulacion) === centro) : base);
  }, [zonaReg, centro, centroDe]);

  const grupos = useMemo(
    () => agruparMitades(delCentro, centroDe, zonaMap),
    [delCentro, centroDe, zonaMap],
  );

  if (!snap || !zonaReg) return <p className="muted">Cargando…</p>;

  const opciones = [
    { id: TODOS, label: "Todos", icono: "🗺️", color: t.accent, n: delCentro.length },
    ...MITADES.map((m) => ({ id: m, label: m, icono: ICONO_MITAD[m], color: colorMitad(m, t), n: grupos[m].length })),
  ];
  const cards = mitad === TODOS ? delCentro : grupos[mitad as (typeof MITADES)[number]];
  const setFiltro = (c: string) =>
    router.replace(c ? `/regiones?centro=${encodeURIComponent(c)}` : "/regiones");

  return (
    <div>
      <FiltroCentro centros={centrosPresentes} valor={centro} onChange={setFiltro} colorDe={colorDe} />
      <KpiRow zona={zonaReg} />
      <div className="section-title">Choferes</div>
      <MarcoMitades opciones={opciones} activa={mitad} onCambiar={setMitad}>
        {cards.length === 0
          ? <p className="muted">Ningún chofer coincide con los filtros.</p>
          : <div className="card-grid">{cards.map((c) => <CardChofer key={c.chofer} c={c} />)}</div>}
      </MarcoMitades>
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
