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

export default function MapaLocales({
  puntos,
  colorDe,
  alto = 560,
  fitKey,
  seleccionado,
  scrollZoom = true,
  className,
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
}) {
  const { tokens: t } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const LRef = useRef<typeof L | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const capaRef = useRef<L.LayerGroup | null>(null);
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

  // ── Encuadre ────────────────────────────────────────────────────────────
  // Cada cambio de filtro tiene que acercar a lo que quedó visible. `puntos` se
  // lee del render actual pero NO dispara el efecto: reencuadrar en cada poll de
  // 60 s le movería el mapa al operador debajo de las manos.
  const estado = useRef({ puntos });
  estado.current = { puntos };

  useEffect(() => {
    const Lf = LRef.current, map = mapRef.current;
    if (!listo || !Lf || !map) return;
    const conCoords = estado.current.puntos.filter((p) => p.lat != null && p.lng != null);
    if (conCoords.length === 0) { map.fitBounds(CHILE_BOUNDS); return; }
    const bounds = Lf.latLngBounds(conCoords.map((p) => [p.lat as number, p.lng as number]));
    // maxZoom: con un solo local, fitBounds se iría a zoom de manzana.
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
  }, [listo, fitKey]);

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
