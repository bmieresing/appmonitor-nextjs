"use client";
// Sección "Asignación": cómo quedó repartido el día. Responde la pregunta de quien
// arma las rutas —cuántos locales y cuántos de prioridad Alta le tocan a cada
// chofer— y la cruza con los litros esperados, que es lo que dice si esa carga es
// mucha o poca: 40 locales para 300 L esperados no es lo mismo que 8 para 300 L.
//
// Los promedios (litros esperados por local, y por local Alta) son la lectura que
// pidió la sección: cuánto se espera de cada local que se asigna.
import React, { useMemo, useState } from "react";
import Seccion from "./Seccion";
import FiltroCentro from "@/components/FiltroCentro";
import Tank from "@/components/Tank";
import { useCentroColores } from "@/components/CentroColores";
import { useTheme } from "@/components/ThemeProvider";
import { asignacionPorChofer, totalesAsignacion, type FilaAsignacion } from "@/lib/estadisticas";
import { semaforo } from "@/lib/theme";
import { miles } from "@/lib/format";
import type { CarruselChofer } from "@/lib/types";

// Columnas de la tabla. `num` alinea a la derecha y ordena por valor numérico; `tip`
// es lo que explica la columna al pasar el mouse por la ⓘ del encabezado — la mitad
// de estos números son cocientes y sin decir de qué no significan nada.
const COLS: { key: keyof FilaAsignacion; label: string; num?: boolean; tip: string }[] = [
  { key: "chofer", label: "Chofer", tip: "Chofer con ruta asignada hoy." },
  { key: "ruta", label: "Ruta", tip: "Ruta de la planilla del día." },
  { key: "locales", label: "Locales", num: true, tip: "Locales asignados hoy, sin importar si ya se visitaron." },
  { key: "altas", label: "Alta", num: true, tip: "De esos locales, los marcados con prioridad Alta en LocalesRuta." },
  { key: "pctAltas", label: "% Alta", num: true, tip: "Alta ÷ locales asignados.\nCuánto de la ruta es prioridad Alta." },
  { key: "esperado", label: "Esperado", num: true, tip: "Litros que se esperan del chofer: su promedio histórico, el mismo con el que compara el balde 💧." },
  { key: "promLocal", label: "L / local", num: true, tip: "Litros esperados ÷ locales asignados.\nCuánto tiene que rendir cada local que se le asigna." },
  { key: "promAlta", label: "L / local Alta", num: true, tip: "Litros esperados ÷ locales de prioridad Alta.\nSi es muy alto, se está esperando todo el día de pocos locales importantes." },
  { key: "litros", label: "Actual", num: true, tip: "Litros recolectados hasta ahora." },
  { key: "pctLit", label: "% actual", num: true, tip: "Litros actuales ÷ esperados.\nEs el mismo % del balde 💧, acá ordenable y filtrable." },
];

// Filtro por avance: la pregunta operativa no es "quién va en 47%" sino "quiénes
// están abajo". Los cortes son los del semáforo del dashboard (80 / 50) más el
// "ya cumplió", para no inventar umbrales nuevos.
const AVANCES: { v: string; label: string; test: (pct: number) => boolean }[] = [
  { v: "50", label: "Bajo 50%", test: (p) => p < 50 },
  { v: "80", label: "Bajo 80%", test: (p) => p < 80 },
  { v: "100", label: "Cumplió (100%+)", test: (p) => p >= 100 },
];

// Última columna: cómo va ese chofer AHORA, con los mismos baldes de las cards. La
// asignación se lee mucho mejor contra el avance —30 locales para 8 L por local es
// otra conversación si ya va en 90%—, y son los mismos medidores que el operador ya
// sabe leer en Global/Santiago/Regiones.
const TIP_ESTADO = "Cómo va el chofer ahora mismo: litros sobre lo esperado, locales realizados y prioridad Alta. Son los mismos baldes de las cards; el detalle está en el globo de cada uno.";

/** Ayuda del encabezado: explica la columna sin ocupar espacio en el título. */
function Info({ tip }: { tip: string }) {
  return <span className="est-info has-tip tip-abajo" data-tip={tip} aria-label={tip}>i</span>;
}

/** Decimal corto para los promedios: 12,4 L por local dice más que 12. */
function dec(v: number): string {
  return v > 0 ? v.toLocaleString("es-CL", { maximumFractionDigits: 1 }) : "—";
}

/** El mismo promedio con su unidad, para las celdas de la tabla. */
function decL(v: number): string {
  return v > 0 ? `${dec(v)} L` : "—";
}

export default function SeccionAsignacion({ carrusel }: { carrusel: CarruselChofer[] }) {
  const { centroDe, colorDe } = useCentroColores();
  const { tokens: t } = useTheme();
  const [centro, setCentro] = useState("");
  const [busca, setBusca] = useState("");
  const [avance, setAvance] = useState("");
  const [sortCol, setSortCol] = useState<keyof FilaAsignacion>("locales");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);   // el más cargado primero

  const filas = useMemo(() => asignacionPorChofer(carrusel, centroDe), [carrusel, centroDe]);
  const centros = useMemo(
    () => [...new Set(filas.map((f) => f.centro).filter((c): c is string => !!c))].sort(),
    [filas],
  );

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const corte = AVANCES.find((a) => a.v === avance);
    const out = filas.filter((f) =>
      (!centro || f.centro === centro)
      && (!corte || corte.test(f.pctLit))
      && (!q || f.chofer.toLowerCase().includes(q) || (f.ruta ?? "").toLowerCase().includes(q)));
    return [...out].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * sortDir;
    });
  }, [filas, centro, busca, avance, sortCol, sortDir]);

  const tot = useMemo(() => totalesAsignacion(visibles), [visibles]);

  const ordenar = (key: keyof FilaAsignacion) => {
    if (sortCol === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortCol(key); setSortDir(key === "chofer" || key === "ruta" ? 1 : -1); }
  };

  return (
    <Seccion icono="🧮" titulo="Asignación del día"
      bajada="Cuántos locales y cuántos de prioridad Alta le tocan a cada chofer, y cuántos litros se esperan por local asignado."
      filtros={
        <>
          <FiltroCentro centros={centros} valor={centro} onChange={setCentro} colorDe={colorDe} />
          <label className="est-filtro-sel">
            <span className="fc-label">Avance</span>
            <select className="col-filtro" value={avance} onChange={(e) => setAvance(e.target.value)}>
              <option value="">Todo el avance</option>
              {AVANCES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select>
          </label>
          <input className="col-filtro est-busca" value={busca} placeholder="Buscar chofer o ruta…"
            onChange={(e) => setBusca(e.target.value)} />
        </>
      }>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="lbl">Choferes</div><div className="val tnum">{miles(tot.choferes)}</div></div>
        <div className="stat"><div className="lbl">Locales asignados</div><div className="val tnum">{miles(tot.locales)}</div></div>
        <div className="stat">
          <div className="lbl">Prioridad Alta</div>
          <div className="val tnum" style={{ color: t.critical }}>{miles(tot.altas)} <small>{tot.pctAltas}%</small></div>
        </div>
        <div className="stat"><div className="lbl">Litros esperados</div><div className="val tnum">{miles(tot.esperado)} <small>L</small></div></div>
        {/* Los dos promedios llevan la misma ⓘ que su columna: son cocientes y de un
            número suelto no se deduce de qué. */}
        <div className="stat">
          <div className="lbl">Prom. por local<Info tip={"Litros esperados ÷ locales asignados, sobre el total filtrado.\nNo es el promedio de los promedios: un chofer con 3 locales no pesa igual que uno con 40."} /></div>
          <div className="val tnum" style={{ color: t.accent }}>{dec(tot.promLocal)} <small>L</small></div>
        </div>
        <div className="stat">
          <div className="lbl">Prom. por local Alta<Info tip={"Litros esperados ÷ locales de prioridad Alta, sobre el total filtrado."} /></div>
          <div className="val tnum" style={{ color: t.accent2 }}>{dec(tot.promAlta)} <small>L</small></div>
        </div>
      </div>

      {visibles.length === 0 ? <p className="muted">Ningún chofer coincide con los filtros.</p> : (
        <div className="tbl-wrap">
          <table className="data grid est-tabla">
            <thead>
              <tr>
                {COLS.map((col) => (
                  <th key={col.key} onClick={() => ordenar(col.key)}
                    style={{ cursor: "pointer", textAlign: col.num ? "right" : "left", whiteSpace: "nowrap" }}>
                    {col.label}
                    <Info tip={col.tip} />
                    <span style={{ marginLeft: 4, opacity: sortCol === col.key ? 1 : 0.3, fontSize: 10 }}>
                      {sortCol === col.key ? (sortDir === 1 ? "▲" : "▼") : "↕"}
                    </span>
                  </th>
                ))}
                <th style={{ width: "18%" }}>Estado actual<Info tip={TIP_ESTADO} /></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.chofer}>
                  <td>{f.chofer}</td>
                  <td style={{ color: "var(--muted)" }}>{f.ruta ?? "—"}</td>
                  <td className="tnum" style={{ textAlign: "right", fontWeight: 700 }}>{miles(f.locales)}</td>
                  <td className="tnum" style={{ textAlign: "right", color: t.critical, fontWeight: 700 }}>{f.altas > 0 ? miles(f.altas) : "—"}</td>
                  <td className="tnum" style={{ textAlign: "right", color: "var(--muted)" }}>{f.altas > 0 ? `${f.pctAltas}%` : "—"}</td>
                  <td className="tnum" style={{ textAlign: "right" }}>{f.esperado > 0 ? `${miles(f.esperado)} L` : "—"}</td>
                  <td className="tnum" style={{ textAlign: "right", color: t.accent, fontWeight: 700 }}>{decL(f.promLocal)}</td>
                  <td className="tnum" style={{ textAlign: "right", color: t.accent2, fontWeight: 700 }}>{decL(f.promAlta)}</td>
                  <td className="tnum" style={{ textAlign: "right" }}>{f.litros > 0 ? `${miles(f.litros)} L` : "—"}</td>
                  {/* El % actual toma el color del semáforo comparativo, igual que su
                      balde: es el mismo número y tiene que decir lo mismo. */}
                  <td className="tnum" style={{ textAlign: "right", fontWeight: 800, color: semaforo(f.pctLit, t) }}>{f.pctLit}%</td>
                  {/* Los baldes de la card, en versión compacta: mismo componente, misma
                      escala de color y mismo globo con el detalle. */}
                  <td>
                    <div className="est-tanques">
                      <Tank icon="💧" label="Litros" pct={f.tarjeta.pct_lit} color={semaforo(f.tarjeta.pct_lit, t)} sub={f.tarjeta.sub_lit} />
                      <Tank icon="🏪" label="Locales" pct={f.tarjeta.pct_loc} color={semaforo(f.tarjeta.pct_loc, t)} sub={f.tarjeta.sub_loc}
                        noAlcPct={f.tarjeta.no_alc_pct_loc ?? 0} noAlcN={f.tarjeta.no_alc_loc} />
                      {f.tarjeta.tiene_alta && (
                        <Tank icon="⭐" label="Alta" pct={f.tarjeta.pct_alta} color={semaforo(f.tarjeta.pct_alta, t)} sub={f.tarjeta.sub_alta}
                          noAlcPct={f.tarjeta.no_alc_pct_alta ?? 0} noAlcN={f.tarjeta.no_alc_alta} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Seccion>
  );
}
