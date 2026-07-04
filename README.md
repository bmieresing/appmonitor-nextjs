# App Monitor · versión Next.js (desplegable en Vercel)

Dashboard de recolección en **Next.js fullstack** (App Router) — versión
**mejorada** del App Monitor original: gráficos con **ECharts**, **tema claro/
oscuro** con toggle, sidebar de navegación y un sistema de diseño propio
(paleta validada CVD-safe de la skill `dataviz`).

Esta carpeta (`nextjs/`) es **solo la app** — es lo que se despliega en Vercel
(Root Directory = `App Monitor Next Supabase/nextjs`). El publisher Python vive
aparte, en la carpeta hermana **`../supabase/`**, y corre fuera de Vercel.

## Cómo obtiene los datos

```
                     ┌────────────────────────── Vercel ──────────────────────────┐
  Supabase Cron ─▶   Supabase              ──▶   app Next (cliente Supabase)   ──▶  UI
  POST al Lambda,    public.monitor_snapshot     lee con anon key (RLS solo      (polling
  rellena con su JSON (el cron la rellena)        lectura) vía Data API)          60 s)
                     (connection string)
```

**Solo datos reales.** La app lee `public.monitor_snapshot` con
**`@supabase/supabase-js`** usando `NEXT_PUBLIC_SUPABASE_URL` +
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (mismo patrón que app-tareas; la anon key es
pública y por RLS **solo lee**). Si faltan las env o todavía no hay fila, la app
muestra **"no hay datos"** — no hay modo demo.

> El **publisher no corre en Vercel** (deps pesadas + RDS privadas + Google
> Sheets). Es un **Lambda** que calcula el snapshot y lo devuelve; el **cron de
> Supabase** le pega cada 5 min y rellena `monitor_snapshot` con esa respuesta. La
> app en Vercel solo lee la tabla. Build del Lambda: `../lambda/build_lambda.ps1`.

## Estructura

```
app/
  layout.tsx  api/snapshot/route.ts   # sirve el snapshot como JSON (503 si no hay datos)
  global|santiago|regiones|recolecciones|rendimiento|carrusel|carrusel-zonas|parametros/
components/  Shell · ThemeProvider · ReactECharts · KpiRow · MetricBar · ZoneView · CarruselView …
lib/
  theme.ts charts.ts                  # tokens + builders ECharts (theme-aware)
  db.ts types.ts format.ts            # db.ts = cliente Supabase (anon key)

../lambda/                            # el publisher Python (backend), fuera de Vercel
../supabase/                          # SQL de la tabla, cron y RLS
```

## Correr local

```bash
npm install
cp .env.example .env.local   # completar con la URL + anon key del proyecto Supabase
npm run dev                  # → http://localhost:3003 (reiniciar tras editar .env.local)
```

Para que haya datos, el Lambda + el cron de Supabase deben estar andando (ver
`../supabase/`); con la tabla vacía la app muestra "no hay datos".

## Desplegar en Vercel (+ Supabase)

1. **Root Directory** del proyecto Vercel = `App Monitor Next Supabase/nextjs`.
2. Framework: Next.js (autodetectado). Build: `next build`.
3. **Env vars** (obligatorias, Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la anon key del proyecto.
4. **Datos**: la tabla `public.monitor_snapshot` + RLS ya están creadas
   (`../supabase/snapshot_schema.sql` + `../supabase/supabase_rls.sql`). El Lambda
   (`../lambda/`, build con `../lambda/build_lambda.ps1`) + el cron
   (`../supabase/supabase_cron.sql`) rellenan las filas cada 5 min.

Como Vercel usa `nextjs/` de Root Directory, las carpetas hermanas `../lambda/` y
`../supabase/` quedan automáticamente fuera del build.

## Diseño

- **Gráficos**: ECharts (anillos KPI con tooltip, barras, donut de desglose,
  barras apiladas de efectividad), todos leyendo los tokens del tema.
- **Paleta**: categórica CVD-safe + status de la skill `dataviz` (validada).
- **Tema**: toggle 🌙/☀️; recuerda la preferencia y arranca según el sistema.

Puerto local 3003. Las 8 vistas repollan `/api/snapshot` cada 60 s.
