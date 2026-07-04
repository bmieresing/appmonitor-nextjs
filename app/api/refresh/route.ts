// API route: fuerza un recálculo YA. Pega al Lambda server-side (con la api-key,
// que NUNCA se expone al browser) y devuelve el snapshot recién calculado. Lo usa
// el botón "Actualizar" del header. Tarda ~30s (el Lambda lee RDS + Sheets).
// El cron de Supabase sigue refrescando la tabla en paralelo cada 5 min; esto es
// solo para traer datos frescos al toque sin esperar el próximo ciclo.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // nunca cachear
export const maxDuration = 60;          // el Lambda tarda ~30s; damos margen

export async function POST() {
  const url = process.env.LAMBDA_URL;
  const key = process.env.LAMBDA_API_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Faltan LAMBDA_URL / LAMBDA_API_KEY en el servidor." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: "{}",
      cache: "no-store",
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = body?.error || `Lambda HTTP ${r.status}`;
      return NextResponse.json({ error: msg }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
