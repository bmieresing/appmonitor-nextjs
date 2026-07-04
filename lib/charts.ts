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

// Donut de desglose del carrusel. Igual que kpiDonutOption: ECharts dibuja SOLO
// el aro; los valores y la leyenda los pone CarruselView por HTML (nítidos a
// cualquier zoom, sin texto rasterizado en el canvas).
export function breakdownDonutOption(
  segs: { name: string; value: number; color: string }[],
  t: Tokens
): EOption {
  const vis = segs.filter((s) => s.value > 0);
  return {
    animationDuration: 600,
    tooltip: { trigger: "item", ...tip(t), formatter: (o: any) => `${o.marker} ${o.name}: <b>${nf.format(o.value)}</b> · ${o.percent}%` },
    series: [
      {
        type: "pie",
        radius: ["52%", "78%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 4 },
        label: { show: false },
        labelLine: { show: false },
        data: vis.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
      },
    ],
  };
}

export { semaforo, semaforoComp, nf };
