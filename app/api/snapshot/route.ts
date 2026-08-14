// API route: sirve el snapshot como JSON. Lo consume el frontend (hook
// useSnapshot) con polling cada 60 s. Si no hay datos (o falta config), responde
// 503 con el error — no hay demo.
//
// Con `?desde=<ISO>` la respuesta es condicional: si el snapshot de la base no es
// más nuevo que esa fecha, devuelve `{ sin_cambios: true }` en vez de los ~300 KB.
// El publisher recalcula cada 5 min y el poll corre cada 60 s, así que cuatro de
// cada cinco respuestas caen en ese caso.
import { NextResponse } from "next/server";
import { getSnapshot, getSnapshotSiCambio } from "@/lib/db";

export const dynamic = "force-dynamic"; // nunca cachear: siempre el último snapshot

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const desde = new URL(request.url).searchParams.get("desde");
  try {
    // Primer fetch de la pestaña (sin `desde`): el snapshot completo, y si no hay
    // fila es un error real que la UI muestra como "no hay datos".
    if (!desde) {
      return NextResponse.json(await getSnapshot(), { headers: SIN_CACHE });
    }
    // Poll con fecha: `null` acá significa "no hay nada más nuevo", no "no hay
    // datos" — el cliente ya tiene un snapshot en memoria y se queda con ese.
    const snapshot = await getSnapshotSiCambio(desde);
    if (!snapshot) {
      return NextResponse.json({ sin_cambios: true }, { headers: SIN_CACHE });
    }
    return NextResponse.json(snapshot, { headers: SIN_CACHE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 503, headers: SIN_CACHE });
  }
}
