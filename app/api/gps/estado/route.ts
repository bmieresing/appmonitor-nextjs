// API route: hora de la última actualización exitosa del GPS. La pide el chip
// "GPS hh:mm" del encabezado, en todas las vistas: es una fila, no las trazas.
import { NextResponse } from "next/server";
import { getGpsEstado } from "@/lib/db";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    return NextResponse.json(await getGpsEstado(), { headers: SIN_CACHE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 503, headers: SIN_CACHE });
  }
}
