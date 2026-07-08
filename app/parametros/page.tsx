"use client";
import { useState } from "react";
import { useSnap } from "@/components/SnapshotContext";
import { useTheme } from "@/components/ThemeProvider";
import { useCentroColores, estiloRuta, COLOR_CENTRO_DEFAULT } from "@/components/CentroColores";
import { miles } from "@/lib/format";

function estadoClase(estado: string): string {
  if (estado.startsWith("✅")) return "status-ok";
  if (estado.startsWith("⚠")) return "status-warn";
  return "status-err";
}

// Mapeo prefijo de TRIPULACIÓN → centro de acopio. Define a qué centro pertenece
// cada chofer (por el prefijo de su tripulación en el sheet) y, con eso, qué color
// lleva su ruta. Se guarda en Supabase y se aplica al instante (sin redeploy).
function MapeoTripulacion() {
  const { zonaMap, setMapeo, quitarMapeo, error } = useCentroColores();
  const [prefijo, setPrefijo] = useState("");
  const [centro, setCentro] = useState("");

  const agregar = () => {
    if (!prefijo.trim() || !centro.trim()) return;
    const orden = (zonaMap.reduce((m, r) => Math.max(m, r.orden), 0) || 0) + 1;
    setMapeo({ prefijo: prefijo.trim(), centro: centro.trim(), orden });
    setPrefijo("");
    setCentro("");
  };

  return (
    <div style={{ marginTop: 22 }}>
      <div className="section-title">🧭 Mapeo tripulación → centro de acopio</div>
      <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
        Cada chofer se asigna a un centro según el <b>prefijo</b> de su tripulación en el
        Seguimiento Diario (ej. <code>NCH 4</code> → prefijo <code>NCH</code>). Se evalúan por
        orden; el primero que coincide gana. Santiago llega con la tripulación <code>SANTIAGO</code>.
      </p>
      {error && <p className="status-err" style={{ marginBottom: 8 }}>No se pudo guardar: {error}</p>}
      <div className="tbl-wrap">
        <table className="data">
          <thead><tr><th>Orden</th><th>Prefijo tripulación</th><th>Centro de acopio</th><th></th></tr></thead>
          <tbody>
            {zonaMap.map((m) => (
              <tr key={m.prefijo}>
                <td className="tnum">{m.orden}</td>
                <td><code>{m.prefijo}</code></td>
                <td>
                  <input
                    className="col-filtro" defaultValue={m.centro}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.centro) setMapeo({ ...m, centro: v }); }}
                    aria-label={`Centro de ${m.prefijo}`}
                  />
                </td>
                <td>
                  <button className="icon-btn" style={{ width: "auto", padding: "0 10px" }}
                    onClick={() => quitarMapeo(m.prefijo)} title="Eliminar este prefijo">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td className="muted">nuevo</td>
              <td>
                <input className="col-filtro" value={prefijo} placeholder="Prefijo (ej. NCH)"
                  onChange={(e) => setPrefijo(e.target.value.toUpperCase())} />
              </td>
              <td>
                <input className="col-filtro" value={centro} placeholder="Centro (ej. Nuevo Chillán)"
                  onChange={(e) => setCentro(e.target.value)} />
              </td>
              <td>
                <button className="icon-btn" style={{ width: "auto", padding: "0 10px" }}
                  onClick={agregar} disabled={!prefijo.trim() || !centro.trim()}>
                  Agregar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Color de ruta por centro de acopio. La lista de centros sale del mapeo de arriba
// (sus valores únicos); el color se guarda en Supabase.
function ColoresCentro() {
  const { zonaMap, colores, colorDe, setColor, quitarColor } = useCentroColores();
  // Orden = el del mapeo (norte→sur por `orden`), dedup preservando la 1ª aparición.
  const centros = [...new Set(zonaMap.map((m) => m.centro))].filter(Boolean);

  return (
    <div style={{ marginTop: 22 }}>
      <div className="section-title">🎨 Colores de ruta por centro de acopio</div>
      <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
        El recuadro alrededor de la ruta en cada card de chofer usa este color. Se guarda
        al instante y se aplica en todas las pantallas. Un centro sin color queda sin recuadro.
      </p>
      {centros.length === 0 ? (
        <p className="muted">Definí primero el mapeo de arriba.</p>
      ) : (
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr><th>Centro de acopio</th><th>Color</th><th>Vista previa</th><th></th></tr></thead>
            <tbody>
              {centros.map((centro) => {
                const actual = colores[centro];
                return (
                  <tr key={centro}>
                    <td>{centro}</td>
                    <td>
                      <input
                        type="color"
                        value={actual ?? COLOR_CENTRO_DEFAULT}
                        onChange={(e) => setColor(centro, e.target.value)}
                        style={{ width: 44, height: 28, padding: 0, border: "none", background: "none", cursor: "pointer" }}
                        aria-label={`Color de ${centro}`}
                      />
                    </td>
                    <td>
                      <span className="entity-route" style={estiloRuta(colorDe(centro)) ?? { color: "var(--muted)" }}>
                        🗺️ Ruta
                      </span>
                    </td>
                    <td>
                      {actual && (
                        <button className="icon-btn" style={{ width: "auto", padding: "0 10px" }}
                          onClick={() => quitarColor(centro)} title="Quitar color (sin recuadro)">
                          Quitar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ParametrosPage() {
  const { snap } = useSnap();
  const { tokens: t } = useTheme();
  if (!snap) return <p className="muted">Cargando…</p>;
  const p = snap.parametros;
  const r = p.resumen;

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="lbl">Sheet Santiago</div><div className="val tnum">{r.filas_sheet_santiago ?? 0}</div></div>
        <div className="stat"><div className="lbl">Sheet Regiones</div><div className="val tnum">{r.filas_sheet_regiones ?? 0}</div></div>
        <div className="stat"><div className="lbl">Choferes Santiago</div><div className="val tnum">{r.choferes_santiago ?? 0}</div></div>
        <div className="stat"><div className="lbl">Choferes Regiones</div><div className="val tnum">{r.choferes_regiones ?? 0}</div></div>
      </div>

      <div className="section-title">🔗 Santiago — match por patente ({r.santiago_match ?? 0}/{r.santiago_total ?? 0})</div>
      <div className="tbl-wrap" style={{ marginBottom: 8 }}>
        <table className="data">
          <thead><tr><th>Match</th><th>Celda</th><th>Patente</th><th>ID Veh.</th><th>ID Chofer</th><th>Chofer</th><th>PROM 3M</th><th>Litros hoy</th></tr></thead>
          <tbody>
            {p.santiago.map((s, i) => (
              <tr key={i}>
                <td>{s.match_ok ? "✅" : "❌"}</td>
                <td className="tnum">{s.celda_sheet}</td>
                <td>{s.patente}</td>
                <td className="tnum">{s.id_vehiculo ?? "—"}</td>
                <td className="tnum">{s.id_chofer ?? "—"}</td>
                <td>{s.nombre_chofer ?? <span className="status-err">sin match</span>}</td>
                <td className="tnum">{s.prom ? miles(s.prom) : "—"}</td>
                <td className="tnum">{s.litros ? miles(s.litros) : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">
        🔗 Regiones — match por nombre
        <span style={{ marginLeft: 10, fontWeight: 600 }}>
          <span className="status-ok">{r.regiones_ok ?? 0} ok</span> · <span className="status-warn">{r.regiones_warn ?? 0} adv.</span> · <span className="status-err">{r.regiones_err ?? 0} sin match</span>
        </span>
      </div>
      <div className="tbl-wrap">
        <table className="data">
          <thead><tr><th>Match</th><th>Celda</th><th>Chofer</th><th>Ruta</th><th>PROM</th><th>Litros hoy</th><th>%</th></tr></thead>
          <tbody>
            {p.regiones.map((g, i) => (
              <tr key={i}>
                <td className={estadoClase(g.match_estado)} style={{ fontWeight: 600 }}>{g.match_estado}</td>
                <td className="tnum">{g.celda_sheet ?? "—"}</td>
                <td>{g.chofer}</td>
                <td>{g.ruta ?? "—"}</td>
                <td className="tnum">{miles(g.prom)}</td>
                <td className="tnum">{miles(g.litros)}</td>
                <td className="tnum">{g.pct != null ? `${g.pct}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MapeoTripulacion />
      <ColoresCentro />
    </div>
  );
}
