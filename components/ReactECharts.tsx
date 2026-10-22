"use client";
// Wrapper mínimo de ECharts para React (sin echarts-for-react, que aún arrastra
// peer-deps de React 18). Inicializa una instancia, aplica la opción, se
// redimensiona con un ResizeObserver y limpia al desmontar.
import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

export default function ReactECharts({
  option,
  height = 260,
  className,
}: {
  // ECharts + TS: los objetos de opción con props literales ("bar", "pie", …) no
  // encajan en el tipo estricto sin fricción; se acepta como objeto abierto.
  option: Record<string, unknown>;
  height?: number | string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    chart.current = echarts.init(el, undefined, { renderer: "canvas" });
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el);

    // Corrección por el zoom del tablero (components/Zoom.tsx, `zoom` de CSS sobre
    // <html>): ECharts ubica el mouse con offsetX/offsetY, que el navegador entrega
    // en píxeles de pantalla, mientras el canvas dibuja en píxeles CSS del gráfico.
    // Con zoom ≠ 100 % el tooltip y el resaltado caían corridos hacia arriba a la
    // izquierda. Se recalcula la posición desde clientX y el rect —que están en el
    // mismo espacio— y se pasa a píxeles del gráfico con la escala real del
    // contenedor. Va en captura sobre el contenedor, antes que el listener de
    // ECharts (que vive en un div hijo).
    const corregir = (e: Event) => {
      const me = e as MouseEvent;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const sx = el.offsetWidth / r.width;
      const sy = el.offsetHeight / r.height;
      if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) return;
      const x = (me.clientX - r.left) * sx;
      const y = (me.clientY - r.top) * sy;
      for (const [k, v] of [["offsetX", x], ["offsetY", y], ["layerX", x], ["layerY", y]] as const) {
        Object.defineProperty(me, k, { value: v, configurable: true });
      }
    };
    const EVENTOS = ["pointermove", "pointerdown", "pointerup", "mousemove", "mousedown", "mouseup",
      "click", "dblclick", "contextmenu", "mouseout", "wheel"];
    EVENTOS.forEach((t) => el.addEventListener(t, corregir, true));

    return () => {
      EVENTOS.forEach((t) => el.removeEventListener(t, corregir, true));
      ro.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    // notMerge: true → al cambiar de tema/datos se reemplaza la opción entera,
    // sin restos de la anterior. Se inyecta la fuente del documento (Inter) como
    // textStyle global para que los textos del canvas igualen al resto de la UI.
    const fontFamily = typeof window !== "undefined"
      ? getComputedStyle(document.body).fontFamily
      : undefined;
    const withFont = fontFamily
      ? { ...option, textStyle: { fontFamily, ...(option.textStyle as object) } }
      : option;
    chart.current?.setOption(withFont, true);
  }, [option]);

  // `contain: inline-size`: el ancho del contenedor no depende del canvas. ECharts
  // le fija al canvas un ancho en px; sin esto, al bajar el zoom del tablero la
  // columna de la grilla no podía achicarse por debajo de ese canvas, el
  // contenedor nunca cambiaba de tamaño, el ResizeObserver no se enteraba y la fila
  // quedaba desbordada hasta recargar.
  return <div ref={ref} className={className} style={{ width: "100%", height, contain: "inline-size", minWidth: 0 }} />;
}
