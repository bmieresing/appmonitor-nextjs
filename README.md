# App Monitor · versión Next.js (desplegable en Vercel)

Dashboard de recolección en **Next.js fullstack** (App Router) — versión
**mejorada** del App Monitor original: gráficos con **ECharts**, **tema claro/
oscuro** con toggle, sidebar de navegación y un sistema de diseño propio
(paleta validada CVD-safe de la skill `dataviz`).

Esta carpeta (`nextjs/`) es **solo la app** — es lo que se despliega en Vercel
(Root Directory = `App Monitor Next Supabase/nextjs`). Los Lambdas (publisher y
GPS) viven aparte, en la carpeta hermana **`../lambda/`**, y corren en AWS.

## Cómo obtiene los datos

```
  Supabase (snapshot, historial, GPS)  ──clave secreta──▶  rutas /api  ──▶  UI (poll 60 s)
  (lo rellena el trigger del cron)                         (middleware: sesión o IP oficina)
```

**Solo datos reales.** Las rutas `/api` (`lib/db.ts`) leen con
**`@supabase/supabase-js`** y la **clave secreta** `SUPABASE_SECRET_KEY`, que solo
existe en el servidor. La anon key (`NEXT_PUBLIC_…`) es pública —viaja en el
bundle— y solo la usan el login, el botón Actualizar (`force_refresh`), Parámetros
(colores y mapeo) y el zoom por usuario; con ella no se lee ni el snapshot ni el
GPS. Si faltan las env o todavía no hay fila, la app muestra **"no hay datos"** —
no hay modo demo.

> El **publisher no corre en Vercel** (deps pesadas + RDS privadas + Google
> Sheets). Es un **Lambda** que calcula el snapshot y lo devuelve; el **cron de
> Supabase** le pega cada 5 min y rellena `monitor_snapshot` con esa respuesta. La
> app en Vercel solo lee la tabla.

## Estructura

```
app/
  layout.tsx  middleware.ts (raíz)    # middleware: sesión o IP de la oficina
  api/snapshot · api/gps · api/gps/estado · api/gps/alarmas · api/gps/odometro
  global|santiago|regiones|recolecciones|carrusel|carrusel-zonas|mapa|
  estadisticas|alertas|flota|parametros|pantalla|login/
components/  Shell · ThemeProvider · ReactECharts · KpiRow · ZoneView · CarruselView · Mapa* …
lib/
  theme.ts charts.ts                  # tokens + builders ECharts (theme-aware)
  db.ts types.ts format.ts            # db.ts = Supabase con la clave secreta (solo servidor)

../lambda/                            # publisher + Lambda GPS (AWS), fuera de Vercel
../supabase/                          # SQL de tablas, RLS, cron, trigger y RPC
```

## Correr local

```bash
npm install
cp .env.example .env.local   # URL, anon key, clave secreta y OFFICE_IPS (ver el archivo)
npm run dev                  # → http://localhost:3004 (reiniciar tras editar .env.local)
```

Para que haya datos, el Lambda + el cron de Supabase deben estar andando (ver
`../supabase/`); con la tabla vacía la app muestra "no hay datos".

## Desplegar en Vercel (+ Supabase)

1. **Root Directory** del proyecto Vercel = `App Monitor Next Supabase/nextjs`.
2. Framework: Next.js (autodetectado). Build: `next build`.
3. **Env vars** (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la anon key del proyecto.
   - `SUPABASE_SECRET_KEY` = la clave secreta (Settings → API Keys). **Sin**
     `NEXT_PUBLIC`: salta la RLS y no puede llegar al navegador.
   - `OFFICE_IPS` = IPs públicas de la oficina, separadas por coma (la tele).
4. **Datos**: tablas, RLS, cron y trigger ya están creados (`../supabase/`). Los
   Lambdas (`../lambda/`) + el cron rellenan las filas.

Como Vercel usa `nextjs/` de Root Directory, las carpetas hermanas `../lambda/` y
`../supabase/` quedan automáticamente fuera del build.

## Diseño

- **Gráficos**: ECharts (anillos KPI con tooltip, barras, donut de desglose,
  barras apiladas de efectividad), todos leyendo los tokens del tema.
- **Mapa**: Leaflet con carga dinámica (toca `window`) y tiles de OpenStreetMap;
  en el tema oscuro se invierten con un filtro CSS (`.mapa-tiles`). CARTO se dejó
  el 24-09-2026: desde el 23-09 estampa "API KEY REQUIRED" en las tiles sin key.
- **Paleta**: categórica CVD-safe + status de la skill `dataviz` (validada).
- **Tema**: toggle 🌙/☀️; recuerda la preferencia y arranca según el sistema.

Puerto local 3004 (`rendering-docs` ocupa el 3003). Las vistas repollan
`/api/snapshot` cada 60 s.
