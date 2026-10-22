// Gatea toda la app con sesión de Supabase (mismo enfoque que el proxy.ts de
// app-tareas, adaptado a la convención `middleware.ts` de Next 15).
// - Páginas sin sesión → redirect a /login.
// - /api/* sin sesión → 401 JSON (así nadie lee el snapshot sin loguearse).
// - Con sesión en /login → redirect a la vista principal.
// - Excepción: desde la IP de la oficina (OFFICE_IPS) el Carrusel Zonas se ve sin
//   sesión, para la tele de la oficina (app android-tv). Solo esa página y las APIs
//   que consume; el resto pide login igual.
// Los usuarios se crean a mano en el panel de Supabase (Authentication → Users);
// no hay página de registro.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLICO_OFICINA = ["/carrusel-zonas", "/api/snapshot", "/api/gps/estado"];

// IP pública del cliente. Vercel pisa estos headers con la IP real, así que el
// cliente no puede falsificarlos.
function desdeOficina(request: NextRequest): boolean {
  const permitidas = (process.env.OFFICE_IPS ?? "").split(",").map((ip) => ip.trim()).filter(Boolean);
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  return !!ip && permitidas.includes(ip);
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() y no getUser(): este middleware corre en CADA request, incluido el
  // poll de /api/snapshot cada 60 s de cada pantalla. getUser() valida el token
  // contra el servidor de Auth, o sea un round-trip de red por poll y por pantalla,
  // en el camino crítico del dato. El proyecto firma los JWT con ES256 (claves
  // asimétricas), así que getClaims() los verifica LOCALMENTE con WebCrypto contra
  // el JWKS cacheado — sin red, y con la misma garantía criptográfica. Igual que
  // getUser(), refresca la sesión si el token está por expirar, así que las cookies
  // se siguen renovando por el setAll de acá arriba.
  const { data: verificado } = await supabase.auth.getClaims();
  const autenticado = !!verificado?.claims?.sub;

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";

  if (!autenticado && PUBLICO_OFICINA.includes(path) && desdeOficina(request)) {
    return supabaseResponse;
  }

  if (!autenticado && !isLogin) {
    if (path.startsWith("/api")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (autenticado && isLogin) {
    return NextResponse.redirect(new URL("/global", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
