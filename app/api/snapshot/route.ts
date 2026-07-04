// API route: sirve el snapshot como JSON. Lo consume el frontend (hook
// useSnapshot) con polling cada 60 s. Si no hay datos (o falta config), responde
// 503 con el error — no hay demo.
import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/db";

export const dynamic = "force-dynamic"; // nunca cachear: siempre el último snapshot

export async function GET() {
  try {
    const snapshot = await getSnapshot();
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
