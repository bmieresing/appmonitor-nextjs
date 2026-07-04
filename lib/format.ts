// Formato numérico chileno (punto de miles), espejo de helpers/formato.py.
const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

export function miles(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "0";
  return nf.format(Math.round(Number(valor)));
}

// Semáforo general del dashboard (locales, litros relativos, prioridad alta).
export function colorSemaforo(pct: number): string {
  if (pct >= 80) return "#2d7a2d";
  if (pct >= 50) return "#e67e22";
  return "#c0392b";
}
