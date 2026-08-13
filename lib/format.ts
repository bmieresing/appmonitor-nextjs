// Formato numérico chileno (punto de miles), espejo de helpers/formato.py.
const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

export function miles(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "0";
  return nf.format(Math.round(Number(valor)));
}
