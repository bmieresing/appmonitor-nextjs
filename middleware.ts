// Gatea toda la app con sesión de Supabase (mismo enfoque que el proxy.ts de
// app-tareas, adaptado a la convención `middleware.ts` de Next 15).
// - Páginas sin sesión → redirect a /login.
// - /api/* sin sesión → 401 JSON (así nadie lee el snapshot sin loguearse).
// - Con sesión en /login → redirect a la vista principal.
// Los usuarios se crean a mano en el panel de Supabase (Authentication → Users);
// no hay página de registro.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
