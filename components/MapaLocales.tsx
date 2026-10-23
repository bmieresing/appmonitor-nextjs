"use client";
// Wrapper mínimo de Leaflet para React (sin react-leaflet), en el mismo espíritu
// que ReactECharts.tsx: una instancia, capas que se recalculan cuando cambian los
// datos, ResizeObserver y limpieza al desmontar.
//
// Leaflet toca `window` al importarse, así que se carga con import() dinámico
// dentro del efecto: eso evita romper el prerender de Next y, de paso, deja el
// bundle fuera de las otras vistas (solo /mapa y /carrusel lo bajan).
import React, { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
// El CSS sí puede ir estático (no toca `window`); lo diferido es solo el JS.
import "leaflet/dist/leaflet.css";
import { useTheme } from "./ThemeProvider";
import { miles } from "@/lib/format";
import { estadoColor } from "@/lib/theme";
import type { PuntoMapa } from "@/lib/mapa";
import type { AlarmaGps, GeocercaGps, TrazaGps } from "@/lib/types";
import type { Tokens } from "@/lib/theme";
import { CAMION_D, CIERRE_DIA, alarmasDeRuta, camionSvg, minutoAhora, popupCamion, vigente } from "@/lib/gps";
import { useDia } from "./DiaContext";
import { useAlarmas } from "./useAlarmas";

// Tiles de OpenStreetMap, sin key. Antes eran de CARTO, que desde el 23-09-2026
// estampa "API KEY REQUIRED" en cada tile pedida sin key. OSM no tiene variante
// oscura: la clase `mapa-tiles` le aplica un filtro CSS en el tema oscuro
// (globals.css), así que la capa no se recrea al cambiar de tema.
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_OPTS = {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
  className: "mapa-tiles",
};

// Chile continental, para el encuadre inicial y el botón "Ver todo Chile".
export const CHILE_BOUNDS: [[number, number], [number, number]] = [[-56.0, -76.0], [-17.5, -66.0]];

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

// Pin de mapa: gota con relleno sólido, borde blanco y sombra. El borde es lo que
// hace que el marcador se recorte contra CUALQUIER fondo (calle clara, parque,
// mancha urbana) y que dos pines pegados se sigan distinguiendo — un círculo
// translúcido sin contorno se funde con el mapa y con sus vecinos. La punta marca
// la ubicación exacta, así que el ancla va abajo.
//
// El tamaño es fijo: la magnitud (litros) se lee en el popup y en el encabezado
// del panel, no en el mapa, donde solo agrega ruido y solapamiento.
export const PIN_W = 22, PIN_H = 28;

export function pinSvg(color: string, simbolo: string | null): string {
  const centro = simbolo
    ? `<text x="11" y="14.6" text-anchor="middle" font-size="11.5" font-weight="800" fill="#ffffff">${simbolo}</text>`
    : `<circle cx="11" cy="10.6" r="3.3" fill="#ffffff" fill-opacity="0.92"/>`;
  return (
    `<svg width="${PIN_W}" height="${PIN_H}" viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M11 27.2C11 27.2 20.4 16.3 20.4 10.4A9.4 9.4 0 1 0 1.6 10.4C1.6 16.3 11 27.2 11 27.2Z" ` +
    `fill="${color}" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round"/>${centro}</svg>`
  );
}

export function popupHtml(p: PuntoMapa, estColor: string): string {
  const filas: [string, string][] = [
    ["Estado", `<span style="color:${estColor}">${esc(p.estado)}</span>`],
    ["Litros", p.litros > 0 ? `${miles(p.litros)} L` : "—"],
    ["Prioridad", esc(p.prioridad)],
    ["Chofer", esc(p.chofer)],
  ];
  if (p.comuna) filas.push(["Comuna", esc(p.comuna)]);
  if (p.ruta) filas.push(["Ruta", esc(p.ruta)]);
  if (p.razon) filas.push(["Razón", esc(p.razon)]);
  if (p.productos?.length) filas.push(["Productos", p.productos.map((x) => `${esc(x.producto)} ${miles(x.litros)} L`).join(" · ")]);
  return (
    `<div class="mapa-pop">` +
    `<div class="mapa-pop-tit">${p.emergencia ? "🚨 " : ""}${esc(p.local || "—")}</div>` +
    `<div class="mapa-pop-id">ID ${esc(p.id_local ?? "—")}</div>` +
    filas.map(([k, v]) => `<div class="mapa-pop-row"><span>${k}</span><b>${v}</b></div>`).join("") +
    `</div>`
  );
}

/** El mismo pin del mapa, en chico, para las leyendas. */
export function PinLeyenda({ color, simbolo }: { color: string; simbolo?: string | null }) {
  return (
    <span
      className="mapa-leg-pin"
      style={{ width: 13, height: 16.5 }}
      // El SVG es una constante del módulo: no hay entrada de usuario.
      dangerouslySetInnerHTML={{ __html: pinSvg(color, simbolo ?? null).replace(`width="${PIN_W}" height="${PIN_H}"`, 'width="13" height="16.5"') }}
    />
  );
}

// Pin de alarma del GPS (reglas de Pegasus): rombo con "!" y el mismo borde blanco
// que los demás marcadores. Rombo a propósito: la gota es un local y el círculo, el
// camión; esto marca DÓNDE estaba el camión cuando saltó la alarma. Ámbar o rojo
// según el nivel de la regla, como el aviso de las cards.
export const ALARMA_D = 24;

export function colorAlarma(nivel: string | null, t: Tokens): string {
  return nivel === "critical" ? t.critical : t.warning;
}

export function alarmaSvg(color: string, d = ALARMA_D): string {
  return (
    `<svg width="${d}" height="${d}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M12 1.6 22.4 12 12 22.4 1.6 12Z" fill="${color}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M12 7.2v6" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>` +
    `<circle cx="12" cy="16.6" r="1.4" fill="#ffffff"/></svg>`
  );
}

function popupAlarma(a: AlarmaGps, geocerca: GeocercaGps | undefined): string {
  const filas: [string, string][] = [["Hora", esc(a.hora)], ["Camión", esc(a.patente ?? "—")]];
  if (a.evento && geocerca) filas.push(["Geocerca", `${a.evento === "entra" ? "Entra a" : "Sale de"} ${esc(geocerca.nombre ?? geocerca.id)}`]);
  if (a.nivel && a.nivel !== "info") filas.push(["Nivel", esc(a.nivel)]);
  return (
    `<div class="mapa-pop">` +
    `<div class="mapa-pop-tit">⚠️ ${esc(a.regla ?? "Alarma GPS")}</div>` +
    (a.mensaje ? `<div class="mapa-pop-id">${esc(a.mensaje)}</div>` : "") +
    filas.map(([k, v]) => `<div class="mapa-pop-row"><span>${k}</span><b>${v}</b></div>`).join("") +
    `</div>`
  );
}

/** Polígonos de las geocercas vigiladas, punteados en ámbar con su nombre al pasar
 *  el mouse. Los comparten el mapa estático y la reproducción. */
export function dibujarGeocercas(Lf: typeof L, capa: L.LayerGroup, geocercas: GeocercaGps[], t: Tokens) {
  for (const g of geocercas) {
    Lf.geoJSON(g.geometria as GeoJSON.Geometry, {
      style: { color: t.warning, weight: 1.6, opacity: 0.9, fillColor: t.warning, fillOpacity: 0.1, dashArray: "5 4" },
    })
      .bindTooltip(esc(g.nombre ?? `Geocerca ${g.id}`), { sticky: true })
      .addTo(capa);
  }
}

/** Marcador de una alarma (sin agregar a ninguna capa). Solo las que traen posición. */
export function marcadorAlarma(Lf: typeof L, a: AlarmaGps, geocercas: GeocercaGps[], t: Tokens): L.Marker | null {
  if (a.lat == null || a.lon == null) return null;
  const geocerca = a.geocerca != null ? geocercas.find((g) => g.id === a.geocerca) : undefined;
  return Lf.marker([a.lat, a.lon], {
    icon: Lf.divIcon({
      className: "mapa-alarma", html: alarmaSvg(colorAlarma(a.nivel, t)),
      iconSize: [ALARMA_D, ALARMA_D], iconAnchor: [ALARMA_D / 2, ALARMA_D / 2], popupAnchor: [0, -ALARMA_D / 2],
    }),
    zIndexOffset: 1500,   // sobre los locales, bajo el camión
    riseOnHover: true,
  }).bindPopup(popupAlarma(a, geocerca), { closeButton: true });
}

/** El pin de alarma, en chico, para la leyenda. */
export function AlarmaLeyenda({ color }: { color: string }) {
  return (
    <span className="mapa-leg-pin" style={{ width: 15, height: 15 }}
      // El SVG es una constante del módulo: no hay entrada de usuario.
      dangerouslySetInnerHTML={{ __html: alarmaSvg(color, 15) }} />
  );
}

export default function MapaLocales({
  puntos,
  colorDe,
  alto = 560,
  fitKey,
  seleccionado,
  scrollZoom = true,
  className,
  traza,
  patente,
}: {
  puntos: PuntoMapa[];
  /** Color de relleno de cada punto; lo decide la vista (por estado o por centro). */
  colorDe: (p: PuntoMapa) => string;
  alto?: number | string;
  /** Al cambiar, reencuadra a los puntos visibles. */
  fitKey?: string;
  /** id_local a centrar y abrir (click desde la lista lateral). */
  seleccionado?: number | null;
  scrollZoom?: boolean;
  className?: string;
  /** GPS del camión de la ruta: se dibuja el recorrido del día y su posición actual. */
  traza?: TrazaGps | null;
  patente?: string | null;
}) {
  const { tokens: t } = useTheme();
  const { dia } = useDia();
  const ref = useRef<HTMLDivElement>(null);
  const LRef = useRef<typeof L | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const capaRef = useRef<L.LayerGroup | null>(null);
  const gpsRef = useRef<L.LayerGroup | null>(null);
  const alarmasRef = useRef<L.LayerGroup | null>(null);
  const { alarmas, geocercas } = useAlarmas();
  const marcasRef = useRef<Map<number, L.Marker>>(new Map());
  const [listo, setListo] = useState(false);

  // ── Montaje: carga de Leaflet + creación del mapa ───────────────────────
  // El mapa se crea recién cuando el contenedor entra en pantalla. En la vista
  // Mapa hay decenas de paneles (una comuna cada uno): inicializarlos todos de
  // entrada dispararía decenas de instancias de Leaflet y de descargas de tiles
  // que quizá nadie mira. El rootMargin los deja listos justo antes de aparecer.
  useEffect(() => {
    let vivo = true;
    const crear = async () => {
      const mod = await import("leaflet");
      if (!vivo || !ref.current || mapRef.current) return;
      const Lf = (mod.default ?? mod) as typeof L;
      LRef.current = Lf;
      // preferCanvas: los locales del día son miles de círculos; en canvas se
      // dibujan sin crear un nodo SVG por punto.
      const map = Lf.map(ref.current, {
        preferCanvas: true,
        scrollWheelZoom: scrollZoom,
        attributionControl: true,
        zoomControl: true,
      });
      map.fitBounds(CHILE_BOUNDS);
      Lf.tileLayer(TILE_URL, TILE_OPTS).addTo(map);
      mapRef.current = map;
      // Capa propia para el GPS: los pines se refrescan con cada poll del snapshot
      // y la traza con cada snapshot nuevo; separadas, ninguna rehace a la otra.
      // Las alarmas (geocercas + pines) van en otra, que se agrega primero: los
      // polígonos quedan debajo de todo (los marcadores se ordenan por zIndexOffset).
      alarmasRef.current = Lf.layerGroup().addTo(map);
      gpsRef.current = Lf.layerGroup().addTo(map);
      capaRef.current = Lf.layerGroup().addTo(map);
      setListo(true);
    };

    const el = ref.current;
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entradas) => {
        if (entradas.some((e) => e.isIntersecting)) { io?.disconnect(); crear(); }
      }, { rootMargin: "250px" });
      io.observe(el);
    } else {
      crear();   // sin soporte: comportamiento de siempre
    }

    return () => {
      vivo = false;
      io?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      capaRef.current = null;
      gpsRef.current = null;
      alarmasRef.current = null;
      marcasRef.current.clear();
    };
    // scrollZoom se fija al montar: no cambia en vivo en ninguna vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Puntos ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const Lf = LRef.current, capa = capaRef.current;
    if (!listo || !Lf || !capa) return;
    capa.clearLayers();
    marcasRef.current.clear();
    // Un icono por combinación (color + símbolo) en vez de uno por local: los
    // locales de una ruta comparten pocas combinaciones y Leaflet reusa el icono.
    const iconos = new Map<string, L.DivIcon>();
    const icono = (color: string, simbolo: string | null) => {
      const clave = `${color}|${simbolo ?? ""}`;
      let ic = iconos.get(clave);
      if (!ic) {
        ic = Lf.divIcon({
          className: "mapa-pin",
          html: pinSvg(color, simbolo),
          iconSize: [PIN_W, PIN_H],
          iconAnchor: [PIN_W / 2, PIN_H],       // la punta es el local
          popupAnchor: [0, -PIN_H + 4],
        });
        iconos.set(clave, ic);
      }
      return ic;
    };

    for (const p of puntos) {
      // El color dice el estado (o el centro) y el símbolo del pin, la prioridad:
      // "!" para emergencia y "★" para prioridad Alta. Van adentro del marcador y
      // no como un aro aparte, que se leía como una categoría más.
      const simbolo = p.emergencia ? "!" : p.prioridad === "Alta" ? "★" : null;
      const m = Lf.marker([p.lat as number, p.lng as number], {
        icon: icono(colorDe(p), simbolo),
        // Lo accionable arriba: si dos locales se pisan, gana el que falta.
        zIndexOffset: p.emergencia ? 900 : p.estado === "Realizado" ? 0 : 400,
        riseOnHover: true,
      });
      m.bindPopup(popupHtml(p, estadoColor(p.estado, t)), { closeButton: true });
      m.addTo(capa);
      if (p.id_local != null) marcasRef.current.set(p.id_local, m);
    }
  }, [listo, puntos, colorDe, t]);

  // ── GPS: recorrido del día + posición actual ────────────────────────────
  // La línea va en su propia capa, que se agregó al mapa ANTES que la de los pines:
  // queda debajo. El popup del camión se arma al abrirlo, así "hace X min" se
  // calcula en ese momento y no cuando llegó la traza.
  useEffect(() => {
    const Lf = LRef.current, capa = gpsRef.current;
    if (!listo || !Lf || !capa) return;
    capa.clearLayers();
    if (!traza || traza.puntos.length === 0) return;
    Lf.polyline(traza.puntos.map((p) => [p[1], p[2]] as [number, number]), {
      color: t.accent2, weight: 3, opacity: 0.75, lineJoin: "round",
    }).addTo(capa);
    const ultimo = traza.ultimo;
    // En un día del historial el reloj queda en su cierre, no en la hora real.
    const ahora = () => (dia ? CIERRE_DIA : minutoAhora());
    const fresco = vigente(ultimo, ahora());
    Lf.marker([ultimo[1], ultimo[2]], {
      icon: Lf.divIcon({
        className: `mapa-camion${fresco ? "" : " viejo"}`,
        html: camionSvg(t.accent2),
        iconSize: [CAMION_D, CAMION_D], iconAnchor: [CAMION_D / 2, CAMION_D / 2], popupAnchor: [0, -CAMION_D / 2],
      }),
      zIndexOffset: 2000,   // sobre los pines: es lo que se viene a buscar
    })
      .bindPopup(() => popupCamion(patente ?? "", ultimo, ahora()), { closeButton: true })
      .addTo(capa);
  }, [listo, traza, patente, t, dia]);

  // ── Alarmas del GPS: geocercas vigiladas + dónde saltó cada alarma ──────
  // Las geocercas se dibujan todas (son pocas y cada una queda donde está; las de
  // otra región simplemente no se ven). Los pines, solo los del camión de esta ruta.
  // No entran al encuadre: el mapa sigue centrado en los locales y el recorrido.
  useEffect(() => {
    const Lf = LRef.current, capa = alarmasRef.current;
    if (!listo || !Lf || !capa) return;
    capa.clearLayers();
    dibujarGeocercas(Lf, capa, geocercas, t);
    for (const a of alarmasDeRuta(alarmas, patente)) marcadorAlarma(Lf, a, geocercas, t)?.addTo(capa);
  }, [listo, alarmas, geocercas, patente, t]);

  // ── Encuadre ────────────────────────────────────────────────────────────
  // Cada cambio de filtro tiene que acercar a lo que quedó visible. `puntos` se
  // lee del render actual pero NO dispara el efecto: reencuadrar en cada poll de
  // 60 s le movería el mapa al operador debajo de las manos. El recorrido GPS entra
  // al encuadre: el camión puede andar fuera del área de sus locales.
  const estado = useRef({ puntos, traza });
  estado.current = { puntos, traza };
  const tieneTraza = !!traza;

  useEffect(() => {
    const Lf = LRef.current, map = mapRef.current;
    if (!listo || !Lf || !map) return;
    const conCoords: [number, number][] = estado.current.puntos
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => [p.lat as number, p.lng as number]);
    for (const p of estado.current.traza?.puntos ?? []) conCoords.push([p[1], p[2]]);
    if (conCoords.length === 0) { map.fitBounds(CHILE_BOUNDS); return; }
    const bounds = Lf.latLngBounds(conCoords);
    // maxZoom: con un solo local, fitBounds se iría a zoom de manzana.
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    // `tieneTraza` y no `traza`: el GPS llega después del primer encuadre y se
    // reencuadra UNA vez al aparecer; las actualizaciones (cada 5 min) no mueven el mapa.
  }, [listo, fitKey, tieneTraza]);

  // ── Selección desde la lista lateral ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!listo || !map || seleccionado == null) return;
    const m = marcasRef.current.get(seleccionado);
    if (!m) return;
    map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.6 });
    m.openPopup();
  }, [listo, seleccionado]);

  // ── Resize (fullscreen, cambio de grilla) ───────────────────────────────
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return <div ref={ref} className={`mapa-canvas${className ? ` ${className}` : ""}`} style={{ height: alto }} />;
}
