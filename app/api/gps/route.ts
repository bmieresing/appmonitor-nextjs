// API route: las trazas GPS del día (Pegasus). Las pide solo la vista Mapa, una
// vez por snapshot nuevo (hook useGps): cambian en la misma fila y en el mismo
// momento que el snapshot, así que no necesitan un poll propio.
import { NextResponse } from "next/server";
import { getGps } from "@/lib/db";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    return NextResponse.json(await getGps(), { headers: SIN_CACHE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 503, headers: SIN_CACHE });
  }
}
