// API route: alarmas del GPS del día (reglas de Pegasus, las trae el Lambda GPS) y
// las geocercas que vigilan. La consumen useAlarmas (pin + polígono en la vista
// Mapa) y la tele de la oficina (Monitor Android, lista entre las cámaras), que la
// lee sin sesión desde la IP de la oficina (middleware.ts).
// Con `?dia=YYYY-MM-DD`, ese día del historial en vez de hoy.
import { NextResponse } from "next/server";
import { getAlarmas } from "@/lib/db";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const dia = new URL(request.url).searchParams.get("dia");
  if (dia && !DIA.test(dia)) {
    return NextResponse.json({ error: "Día inválido." }, { status: 400, headers: SIN_CACHE });
  }
  try {
    return NextResponse.json(await getAlarmas(dia), { headers: SIN_CACHE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 503, headers: SIN_CACHE });
  }
}
