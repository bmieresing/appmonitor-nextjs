// Cliente de Supabase para el browser (maneja la sesión vía cookies).
// Lo usan el login y el botón de logout. Mismo patrón que app-tareas, pero
// reusando las mismas env que ya lee el resto de la app.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createBrowserClient(url, key);
}
