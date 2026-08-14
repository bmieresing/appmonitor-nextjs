// Tipos del snapshot del App Monitor. Espejo del contrato producido por el
// publisher (compute.py) y descrito en su snapshot_schema.sql.

export interface Kpis {
  litros: number;
  esperado: number;
  pct_lit: number;
  exitosos_loc: number;
  total_loc: number;
  pct_loc: number;
  no_alc_loc: number;
  exitosos_alta: number;
  total_alta: number;
  pct_alta: number;
  no_alc_alta: number;
  exitosas: number;
  fallidas: number;
  fallidas_no_alc: number;
  pct_exit: number;
  cerradas: number;
  n_rutas: number;
  pct_cerradas: number;
}

export interface Card {
  chofer: string;
  ruta: string | null;
  tripulacion: string | null;   // tripulación del sheet; el front la mapea a centro/color
  litros_hoy: number;
  prom: number;
  pct_lit: number;
  pct_loc: number;
  sub_loc: string | null;
  pct_alta: number;
  sub_alta: string | null;
  cerrado: boolean;
  no_alc_pct_loc?: number; // % rojo "no alcanzamos a pasar" sobre el tanque de locales
  no_alc_pct_alta?: number;
  no_alc_loc?: number;     // conteo de "no alcanzamos a pasar" (locales), para el tooltip
  no_alc_alta?: number;
}

export interface Centro {
  centro: string;
  litros: number;
  prom: number;
  realizados: number;
  total: number;
  no_alc?: number;         // locales "no alcanzamos a pasar" (capa roja)
  realizados_alta?: number;
  total_alta?: number;
  no_alc_alta?: number;
}

export interface Producto {
  producto: string;
  litros: number;
  visitas: number;
}

export interface Zona {
  kpis: Kpis;
  cards: Card[];
  centros: Centro[];
  productos: Producto[];
}

export interface Rendimiento {
  chofer: string;
  exitosas: number;
  fallidas: number;
  total: number;
  pct: number;
}

export interface CarruselChofer {
  chofer: string;
  ruta: string | null;
  tripulacion: string | null;   // tripulación del sheet; el front la mapea a centro/color
  litros_tot: number;
  exitosas: number;
  fallidas: number;
  pend_alta: number;
  pend_normal: number;
  pct_lit: number;
  sub_lit: string | null;
  pct_loc: number;
  sub_loc: string | null;
  no_alc_pct_loc?: number;
  no_alc_loc?: number;   // conteo de "no alcanzamos a pasar" (locales), para el tooltip
  no_alc_alta?: number;
  pct_alta: number;
  sub_alta: string | null;
  no_alc_pct_alta?: number;
  tiene_alta: boolean;
  emerg_total: number;
  pct_emerg: number;
  sub_emerg: string | null;
  cerrado: boolean;
  razones: { NombreRazon: string; N: number }[];
  locales: { Local: string; Litros: number }[];
  productos: { Producto: string; Visitas: number; Litros: number }[];
  detalle?: DetalleLocal[];
}

// Una fila por local de la ruta del chofer. Es la única granularidad por local
// del snapshot: alimenta la tabla del carrusel y, concatenando el detalle de
// todos los choferes, los puntos de la vista Mapa (ver lib/mapa.ts).
// `type` y no `interface`: la tabla del carrusel accede a las celdas por nombre
// de columna (`d as Record<string, unknown>`), y solo los type alias de objeto
// tienen index signature implícita.
export type DetalleLocal = {
  id_local: number | null;
  local: string;
  prioridad: string;          // valor real de LocalesRuta (Alta / Media / Baja / …)
  emergencia?: boolean;       // el local está marcado como emergencia
  estado: string;             // "Realizado" | "No alcanzado" | "Fallido" | "Pendiente"
  razon: string | null;       // nombre de la razón de fallo
  // Aviso de que esta fila no calza con lo que se va a subir al sistema (hoy:
  // marcada Realizado en la app sin recolección ni razón, así que no pasa el filtro
  // de actividad de ResumenCompleto). null cuando la fila es consistente; ausente si
  // el snapshot lo generó un Lambda anterior a los chequeos de congruencia.
  alerta?: string | null;
  // Hora "HH:MM" en que la app del chofer registró la visita (VistaMonitor.FechaVisita).
  // null = todavía no se visitó; ausente si el snapshot lo generó un Lambda anterior
  // a la línea de tiempo. Alimenta la línea de tiempo (vista Mapa y carrusel) y la
  // reproducción del recorrido.
  hora?: string | null;
  litros: number;
  productos: { producto: string; litros: number }[];
  // Coordenadas de LocalesRuta (vía dim.local). null = local sin geocodificar o
  // con coordenada fuera de Chile; el publisher ya las descarta. Ausentes si el
  // snapshot lo generó un Lambda anterior al mapa.
  lat?: number | null;
  lng?: number | null;
  comuna?: string | null;     // subdivide el mapa de Santiago (un solo centro)
};

export interface Parametros {
  resumen: Record<string, number>;
  santiago: {
    match_ok: boolean;
    celda_sheet: string;
    patente: string;
    id_vehiculo: string | null;
    id_chofer: string | null;
    nombre_chofer: string | null;
    prom: number | null;
    litros: number | null;
  }[];
  regiones: {
    match_estado: string;
    celda_sheet: string | null;
    chofer: string;
    ruta: string | null;
    prom: number;
    litros: number;
    pct: number | null;
  }[];
  zona_map: { prefijo: string; zona: string; activa: boolean }[];
}

// Diferencias entre lo que muestra el monitor (VistaMonitor + LocalesRuta) y lo que
// va a subir al sistema (ResumenCompleto → ResumenCompleto_Historico →
// CargaVisitasFromAppsheet). Antes se veían como números que no cuadraban de un día
// para el otro; ahora el publisher las cuenta y las nombra (ver `_inconsistencias`
// en compute.py). `ejemplos` viene truncado; `n` es el total real.
export interface GrupoInconsistencia {
  clave: string;       // "sin_tripulacion" | "locales_sin_tripulacion" | …
  titulo: string;
  detalle: string;     // qué significa y qué consecuencia tiene en la carga
  n: number;
  litros: number;      // litros involucrados (0 si el grupo no mueve litros)
  ejemplos: { id_local: number | null; local: string; litros?: number; estado?: string }[];
}

export interface Inconsistencias {
  total: number;
  grupos: GrupoInconsistencia[];
}

export type ZonaNombre = "Global" | "Santiago" | "Regiones";

// Fila del mapeo prefijo → centro (tabla Supabase monitor_zona_map). El tipo vive
// completo en CentroColores, que es quien la lee y la escribe; acá solo lo que
// necesitan las funciones puras que reparten choferes por tramo del país.
export interface ZonaMapRowLike {
  prefijo: string;
  centro: string;
  orden: number;
}

export interface Snapshot {
  generated_at: string;
  hora_ciclo: string | null;
  falla: string | null;
  zonas: Record<ZonaNombre, Zona>;
  rendimiento: Rendimiento[];
  recolecciones: {
    litros_aceite: number;
    productos: { producto: string; litros: number; visitas: number; pct: number }[];
    choferes: {
      chofer: string;
      litros: number;
      locales_ok: number;
      locales_total: number;
      productos?: { producto: string; litros: number }[];
    }[];
  };
  carrusel: CarruselChofer[];
  parametros: Parametros;
  // Ausente en snapshots generados por un Lambda anterior a los chequeos.
  inconsistencias?: Inconsistencias;
}
