"use client";
// Mapa que REPRODUCE el recorrido de una ruta: a medida que avanza el reloj, los
// locales se van encendiendo en el orden en que la tripulación los registró, y una
// línea va uniendo los ya visitados.
//
// Es un Leaflet propio y no `MapaLocales` a propósito. Aquel recrea todos los
// marcadores cada vez que cambia `puntos`, que es lo correcto para un mapa
// estático que se refiltra de vez en cuando; acá el contenido cambia varias veces
// por segundo y recrear 40 marcadores por frame se ve como un parpadeo. Este crea
// los marcadores UNA vez por ruta y en cada tick solo llama a setIcon / setOpacity
// sobre los que efectivamente cambiaron, y a setLatLngs sobre la línea.
import React, { useEffect, useMemo, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "./ThemeProvider";
import { CHILE_BOUNDS, PIN_H, PIN_W, TILE_OPTS, TILE_URL, pinSvg, popupHtml } from "./MapaLocales";
import { estadoColor } from "@/lib/theme";
import { tieneCoords, type PuntoMapa } from "@/lib/mapa";
import type { EventoVisita } from "@/lib/tiempo";

// Estado visual de cada local en un instante dado. Se guarda por marcador para no
// volver a pintar el que no cambió.
type Fase = "futuro" | "hecho" | "actual";

export default function MapaRecorrido({
  rutaId,
  eventos,
  pendientes,
  minuto,
  alto = 520,
}: {
  /** Cambia ⇒ se reconstruyen los marcadores y se reencuadra. */
  rutaId: string;
  /** Visitas con hora, ordenadas cronológicamente (solo las que tienen coordenadas). */
  eventos: EventoVisita[];
  /** Locales de la ruta todavía sin visitar: contexto, siempre apagados. */
  pendientes: PuntoMapa[];
  /** Reloj de la reproducción, en minutos desde medianoche. */
  minuto: number;
  alto?: number | string;
}) {
  const { tokens: t } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const LRef = useRef<typeof L | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const capaRef = useRef<L.LayerGroup | null>(null);
  const lineaRef = useRef<L.Polyline | null>(null);
  // marcador + su hora (null = pendiente) + la fase ya pintada
  const marcasRef = useRef<{ m: L.Marker; min: number | null; punto: PuntoMapa; fase: Fase | null }[]>([]);
  const [listo, setListo] = useState(false);

  const visitados = useMemo(() => eventos.filter((e) => tieneCoords(e.punto)), [eventos]);
  const ubicables = useMemo(() => pendientes.filter(tieneCoords), [pendientes]);
  // Firma del contenido: el snapshot se repolla cada 60 s y devuelve arrays nuevos
  // aunque nada haya cambiado. Reconstruir por identidad tiraría los marcadores en
  // medio de la reproducción; con la firma solo se rehacen si aparece una visita
  // nueva o cambia una hora.
  const firma = useMemo(
    () => [rutaId, visitados.map((e) => `${e.punto.id_local}@${e.min}`).join(","), ubicables.map((p) => p.id_local).join(",")].join("|"),
    [rutaId, visitados, ubicables],
  );
  // Datos frescos para efectos que NO deben dispararse cuando cambia la identidad.
  const datos = useRef({ visitados, ubicables });
  datos.current = { visitados, ubicables };

  // ── Montaje ─────────────────────────────────────────────────────────────
  // Igual que MapaLocales: el mapa se crea recién cuando el contenedor entra en
  // pantalla. La reproducción muestra la grilla entera —decenas de rutas—, y
  // arrancar todas las instancias de Leaflet juntas, cada una con sus tiles,
  // ahogaría el navegador de la pantalla mural.
  useEffect(() => {
    let vivo = true;
    const crear = async () => {
      const mod = await import("leaflet");
      if (!vivo || !ref.current || mapRef.current) return;
      const Lf = (mod.default ?? mod) as typeof L;
      LRef.current = Lf;
      const map = Lf.map(ref.current, { preferCanvas: true, scrollWheelZoom: false, zoomControl: true });
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
      crear();
    }

    return () => {
      vivo = false;
      io?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      capaRef.current = null;
      lineaRef.current = null;
      marcasRef.current = [];
    };
  }, []);

  // ── Marcadores y línea: se construyen una vez por ruta ───────────────────
  useEffect(() => {
    const Lf = LRef.current, capa = capaRef.current;
    if (!listo || !Lf || !capa) return;
    const { visitados: vis, ubicables: ubi } = datos.current;
    capa.clearLayers();
    marcasRef.current = [];

    // La línea va primero para quedar DEBAJO de los pines.
    lineaRef.current = Lf.polyline([], {
      color: t.accent2,
      weight: 3,
      opacity: 0.85,
      dashArray: "1 7",
      lineCap: "round",
    }).addTo(capa);

    const agregar = (punto: PuntoMapa, min: number | null) => {
      const m = Lf.marker([punto.lat as number, punto.lng as number], {
        icon: Lf.divIcon({ className: "mapa-pin", html: "", iconSize: [PIN_W, PIN_H], iconAnchor: [PIN_W / 2, PIN_H], popupAnchor: [0, -PIN_H + 4] }),
        riseOnHover: true,
      });
      m.bindPopup(popupHtml(punto, estadoColor(punto.estado, t)), { closeButton: true });
      m.addTo(capa);
      marcasRef.current.push({ m, min, punto, fase: null });
    };

    for (const ev of vis) agregar(ev.punto, ev.min);
    for (const p of ubi) agregar(p, null);
    // `t` (tokens) queda fuera a propósito: un cambio de tema repinta los iconos en
    // el efecto del reloj, sin reconstruir marcadores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, firma]);

  // ── Encuadre: solo al cambiar de ruta ────────────────────────────────────
  // Aparte del efecto de arriba a propósito: una visita nueva que entra por el
  // poll no tiene por qué mover el mapa mientras se está reproduciendo.
  useEffect(() => {
    const Lf = LRef.current, map = mapRef.current;
    if (!listo || !Lf || !map) return;
    const { visitados: vis, ubicables: ubi } = datos.current;
    const todos = [...vis.map((e) => e.punto), ...ubi];
    if (todos.length === 0) { map.fitBounds(CHILE_BOUNDS); return; }
    map.fitBounds(Lf.latLngBounds(todos.map((p) => [p.lat as number, p.lng as number])), { padding: [34, 34], maxZoom: 14 });
  }, [listo, rutaId]);

  // ── Reloj: solo se repinta lo que cambió de fase ─────────────────────────
  const temaRef = useRef(t);
  useEffect(() => {
    const Lf = LRef.current;
    if (!listo || !Lf) return;

    // Cambio de tema: los colores de los iconos ya dibujados quedaron viejos, así
    // que se invalida la fase de todos para forzar un repintado completo.
    if (temaRef.current !== t) {
      temaRef.current = t;
      for (const marca of marcasRef.current) marca.fase = null;
      lineaRef.current?.setStyle({ color: t.accent2 });
    }

    // La visita más reciente ocurrida hasta el reloj: es la que va resaltada.
    let ultimo = -1;
    for (let i = 0; i < visitados.length; i++) {
      if (visitados[i].min <= minuto) ultimo = i; else break;
    }
    const minActual = ultimo >= 0 ? visitados[ultimo].min : null;

    for (const marca of marcasRef.current) {
      const hecho = marca.min !== null && marca.min <= minuto;
      const fase: Fase = !hecho ? "futuro" : marca.min === minActual ? "actual" : "hecho";
      if (fase === marca.fase) continue;   // nada que repintar
      // Se acaba de encender (venía apagado, no es el primer pintado ni una
      // reconstrucción): se le da la animación de entrada. Sin esta condición, un
      // cambio de tema haría saltar los pines de toda la ruta a la vez.
      const entra = marca.fase === "futuro" && fase !== "futuro";
      marca.fase = fase;

      if (fase === "futuro") {
        // Todavía no ocurrió (o no se visitó nunca): punto tenue, sin peso visual.
        marca.m.setIcon(Lf.divIcon({
          className: "mapa-pin mapa-pin-off",
          html: `<span class="pin-off" style="background:${t.muted}"></span>`,
          iconSize: [10, 10], iconAnchor: [5, 5], popupAnchor: [0, -6],
        }));
        marca.m.setZIndexOffset(0);
      } else {
        const color = estadoColor(marca.punto.estado, t);
        const simbolo = marca.punto.emergencia ? "!" : marca.punto.prioridad === "Alta" ? "★" : null;
        // Las ondas van dentro del marcador de la visita en curso: se expanden más
        // allá del pin, así que lo delatan aunque quede tapado por sus vecinos.
        const ondas = fase === "actual"
          ? `<span class="pin-onda" style="color:${color}"></span><span class="pin-onda tardia" style="color:${color}"></span>`
          : "";
        marca.m.setIcon(Lf.divIcon({
          className: `mapa-pin${fase === "actual" ? " mapa-pin-actual" : ""}${entra ? " mapa-pin-in" : ""}`,
          html: ondas + pinSvg(color, simbolo),
          iconSize: [PIN_W, PIN_H], iconAnchor: [PIN_W / 2, PIN_H], popupAnchor: [0, -PIN_H + 4],
        }));
        marca.m.setZIndexOffset(fase === "actual" ? 1000 : 300);
      }
    }

    lineaRef.current?.setLatLngs(
      visitados.slice(0, ultimo + 1).map((e) => [e.punto.lat as number, e.punto.lng as number] as [number, number]),
    );
    // `firma` va en las dependencias porque este efecto es el que pinta los iconos:
    // si el de arriba recreó los marcadores (nacen vacíos), este tiene que correr
    // detrás aunque el reloj no se haya movido.
  }, [listo, minuto, visitados, firma, t]);

  // ── Resize (fullscreen, cambio de grilla) ───────────────────────────────
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return <div ref={ref} className="mapa-canvas" style={{ height: alto }} />;
}
