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
    if (!ref.current) return;
    chart.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(ref.current);
    return () => {
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

  return <div ref={ref} className={className} style={{ width: "100%", height }} />;
}
