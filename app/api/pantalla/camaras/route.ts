// API route: canal del grabador que muestra cada cámara de la tele de la oficina.
// La lee Monitor Android (android-tv/) sin sesión desde la IP de la oficina
// (middleware.ts) y se edita en Parámetros. Solo devuelve números de canal: la URL
// RTSP con la clave del grabador se arma dentro de la app.
import { NextResponse } from "next/server";
import { getPantallaCamaras } from "@/lib/db";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    return NextResponse.json({ camaras: await getPantallaCamaras() }, { headers: SIN_CACHE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 503, headers: SIN_CACHE });
  }
}
