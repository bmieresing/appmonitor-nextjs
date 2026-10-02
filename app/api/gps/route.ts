// API route: puntos GPS del día (Pegasus, los trae el Lambda GPS cada minuto).
// Sin `?desde` devuelve el día completo; con `?desde=<hasta anterior>`, solo lo
// recibido después. Lo consume useGps (vista Mapa y Carrusel), con poll de 60 s.
import { NextResponse } from "next/server";
import { getGps } from "@/lib/db";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const desde = new URL(request.url).searchParams.get("desde");
  try {
    return NextResponse.json(await getGps(desde), { headers: SIN_CACHE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 503, headers: SIN_CACHE });
  }
}
