// Builders de opciones de ECharts, todos theme-aware (reciben los tokens).
// Devuelven objetos de opción; el render lo hace <ReactECharts>.
// El tipo de retorno es un objeto abierto: el tipo estricto de ECharts choca
// con props literales ("bar"/"pie") sin aportar seguridad real acá.
import { Tokens, semaforo, semaforoComp } from "./theme";

type EOption = Record<string, unknown>;

const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

function tip(t: Tokens) {
  return {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    textStyle: { color: t.text, fontSize: 12 },
    extraCssText: "box-shadow:0 6px 20px rgba(0,0,0,0.18);border-radius:10px;",
  };
}

// Anillo KPI. Recibe los tramos ya armados (nombre, valor geométrico 0-100,
// texto a mostrar y color). El texto central lo pone el card por HTML encima.
export interface KpiSlice { name: string; value: number; display: string; color: string }

export function kpiDonutOption(slices: KpiSlice[], t: Tokens): EOption {
  return {
    animationDuration: 700,
    tooltip: {
      trigger: "item",
      ...tip(t),
      formatter: (o: any) => `${o.marker} ${o.name}: <b>${o.data.display}</b> · ${o.percent}%`,
    },
    series: [
      {
        type: "pie",
        radius: ["74%", "92%"], // banda más fina → el % central respira mejor
        center: ["50%", "50%"],
        label: { show: false },
        labelLine: { show: false },
        data: slices
          .filter((s) => s.value > 0)
          .map((s) => ({ value: s.value, name: s.name, display: s.display, itemStyle: { color: s.color, borderRadius: 6 } })),
      },
    ],
  };
}

// Rendimiento: barras horizontales apiladas exitosas/fallidas por chofer.
export function rendimientoOption(
  filas: { chofer: string; exitosas: number; fallidas: number; pct: number }[],
  t: Tokens
): EOption {
  const data = [...filas].reverse(); // peores abajo → mejores arriba
  return {
    grid: { left: 8, right: 24, top: 30, bottom: 8, containLabel: true },
    legend: { data: ["Exitosas", "Fallidas"], top: 0, textStyle: { color: t.textSecondary }, itemWidth: 12, itemHeight: 12 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...tip(t) },
    xAxis: { type: "value", axisLabel: { color: t.muted }, splitLine: { lineStyle: { color: t.grid } } },
    yAxis: {
      type: "category",
      data: data.map((r) => r.chofer),
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: { color: t.textSecondary, fontSize: 12 },
    },
    series: [
      {
        name: "Exitosas", type: "bar", stack: "t", data: data.map((r) => r.exitosas),
        itemStyle: { color: t.good, borderRadius: [4, 0, 0, 4] }, barWidth: "62%",
        label: { show: true, color: "#fff", fontWeight: 700, formatter: (o: any) => (o.value > 0 ? o.value : "") },
      },
      {
        name: "Fallidas", type: "bar", stack: "t", data: data.map((r) => r.fallidas),
        itemStyle: { color: t.critical, borderRadius: [0, 4, 4, 0] },
        label: { show: true, color: "#fff", fontWeight: 700, formatter: (o: any) => (o.value > 0 ? o.value : "") },
      },
    ],
  };
}

// Donut de desglose del carrusel (segmentos con valores absolutos + leyenda).
export function breakdownDonutOption(
  segs: { name: string; value: number; color: string }[],
  t: Tokens
): EOption {
  const vis = segs.filter((s) => s.value > 0);
  return {
    animationDuration: 600,
    tooltip: { trigger: "item", ...tip(t), formatter: (o: any) => `${o.marker} ${o.name}: <b>${nf.format(o.value)}</b> · ${o.percent}%` },
    legend: { bottom: 0, type: "scroll", textStyle: { color: t.textSecondary, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    series: [
      {
        type: "pie",
        radius: ["52%", "78%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 4 },
        label: { show: true, formatter: (o: any) => nf.format(o.value), color: t.text, fontSize: 11, fontWeight: 700 },
        labelLine: { length: 8, length2: 6, lineStyle: { color: t.axis } },
        data: vis.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
      },
    ],
  };
}

export { semaforo, semaforoComp, nf };
