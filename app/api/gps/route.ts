// API route: puntos GPS del día (Pegasus, los trae el Lambda GPS cada minuto).
// Sin `?desde` devuelve el día completo; con `?desde=<hasta anterior>`, solo lo
// recibido después. Lo consume useGps (vista Mapa y Carrusel), con poll de 60 s.
// Con `?dia=YYYY-MM-DD`, ese día del historial en vez de hoy.
import { NextResponse } from "next/server";
import { getGps } from "@/lib/db";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const desde = params.get("desde");
  const dia = params.get("dia");
  if (dia && !DIA.test(dia)) {
    return NextResponse.json({ error: "Día inválido." }, { status: 400, headers: SIN_CACHE });
  }
  try {
    return NextResponse.json(await getGps(desde, dia), { headers: SIN_CACHE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 503, headers: SIN_CACHE });
  }
}
