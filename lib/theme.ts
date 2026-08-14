// Sistema de diseño: tokens de color para tema claro y oscuro.
// La paleta de datos (categórica / status / secuencial) sale de la skill
// `dataviz` (paleta de referencia validada — CVD-safe, contraste chequeado).
// El acento de marca (verde) se usa solo en el chrome, no en los datos.
//
// ESTE ARCHIVO ES LA ÚNICA FUENTE DE LA PALETA. Lo que pinta JavaScript (ECharts,
// semaforo(), los pines del mapa) lee los tokens de acá, y lo que pinta CSS lee las
// custom properties que genera `cssVariables()` al final — del mismo objeto. Antes
// la paleta estaba escrita dos veces, acá y a mano en globals.css, y los valores ya
// habían divergido: `good` en tema oscuro era #0ca30c de un lado y #22c55e del
// otro, y los grises de texto no coincidían en ninguno de los dos temas. Eso hacía
// que dos señales que significan lo mismo —el triángulo de aviso, que pinta CSS, y
// el tanque de al lado, que pinta JS— salieran de distinto color en la misma card.

export type Mode = "light" | "dark";

export interface Tokens {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  grid: string;
  axis: string;
  accent: string;
  accent2: string;
  // status / semáforo
  good: string;
  warning: string;
  serious: string;
  critical: string;
  criticalDark: string;   // rojo profundo: el fallo "de verdad", frente al no alcanzado
  bar: string;            // barra de magnitud (tops de litros del carrusel) — coral
  // categórica (orden fijo, CVD-safe)
  categorical: string[];
  // rampa secuencial de marca (verde, claro→oscuro) para magnitud de litros
  seq: string[];
}

export const THEME: Record<Mode, Tokens> = {
  light: {
    bg: "#f6f8f6",
    surface: "#ffffff",
    surface2: "#fbfcfb",
    text: "#0b0b0b",
    // Los grises de texto son los que tenía globals.css y no los de la paleta
    // original: sobre este fondo claro dan el contraste que los otros no llegaban
    // a dar, y `muted` tiñe etiquetas que hay que poder leer, no decoración.
    textSecondary: "#45443f",
    muted: "#6d6b64",
    border: "rgba(11,11,11,0.10)",
    grid: "#e8ebe8",
    axis: "#c3c2b7",
    accent: "#2d7a2d",
    accent2: "#1a6b8a",
    good: "#0ca30c",
    warning: "#eda100",
    serious: "#ec835a",
    critical: "#d03b3b",
    criticalDark: "#7a1414",
    bar: "#ef5b53",
    categorical: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"],
    seq: ["#cfe6cf", "#9fce9f", "#6bb76b", "#3f9f3f", "#2d7a2d", "#1f5a1f"],
  },
  dark: {
    bg: "#0d0f0d",
    surface: "#181a18",
    surface2: "#1f221f",
    text: "#f4f6f4",
    textSecondary: "#d2d4cb",
    muted: "#a9aea3",
    border: "rgba(255,255,255,0.10)",
    grid: "#2a2d2a",
    axis: "#3a3d3a",
    accent: "#35c46b",
    accent2: "#4bb6d4",
    // Verde más brillante que en claro: el #0ca30c de la paleta sobre el fondo
    // #0d0f0d queda apagado, y es el color del "va bien" de todo el semáforo.
    good: "#22c55e",
    warning: "#fab219",
    serious: "#ec835a",
    critical: "#e05555",
    criticalDark: "#8f1f1f",
    bar: "#ff6b63",
    categorical: ["#3987e5", "#199e70", "#c98500", "#2a9d2a", "#9085e9", "#e66767", "#d55181", "#d95926"],
    seq: ["#1f3a1f", "#2d5a2d", "#3f8a3f", "#4faf4f", "#5fc95f", "#8fe08f"],
  },
};

// ── Puente a CSS ─────────────────────────────────────────────────────────
// Nombre de la custom property de cada token. Solo los escalares: las paletas
// (categorical / seq) las consume JavaScript y no tienen uso en hojas de estilo.
const CSS_VAR: Partial<Record<keyof Tokens, string>> = {
  bg: "--bg",
  surface: "--surface",
  surface2: "--surface-2",
  text: "--text",
  textSecondary: "--text-2",
  muted: "--muted",
  border: "--border",
  grid: "--grid",
  axis: "--axis",
  accent: "--accent",
  accent2: "--accent-2",
  good: "--good",
  warning: "--warning",
  serious: "--serious",
  critical: "--critical",
  criticalDark: "--critical-dark",
  bar: "--bar",
};

function bloqueCss(selector: string, t: Tokens): string {
  const decls = Object.entries(CSS_VAR)
    .map(([token, prop]) => `${prop}:${t[token as keyof Tokens] as string};`)
    .join("");
  return `${selector}{${decls}}`;
}

/**
 * La paleta como CSS. La inyecta el layout en el <head> (server-side, así los
 * colores ya están en el primer pintado y no hay parpadeo antes de que hidrate
 * React), y es lo que evita tener que repetir un solo valor a mano en globals.css.
 */
export function cssVariables(): string {
  return [
    bloqueCss(':root,[data-theme="light"]', THEME.light),
    bloqueCss('[data-theme="dark"]', THEME.dark),
  ].join("");
}

// Color de marca fijo por producto. Es presentación pura (antes viajaba en cada
// snapshot desde el Lambda); vive acá con el resto del sistema de diseño. Lo usa
// la barra "Productos" de las vistas de zona; el resto del dashboard pinta con la
// paleta categórica.
export const PRODUCT_COLORS: Record<string, string> = {
  "Aceite": "#2d7a2d",           // verde marca
  "Latas": "#7f8c8d",            // gris
  "Grasa Vegetal": "#8bc34a",    // verde claro
  "Grasa Animal": "#a0522d",     // café
  "Mantequilla": "#e6b400",      // ámbar
  "Aceite de Oliva": "#6b8e23",  // oliva
  "Aceite de pescado": "#1a6b8a", // azul petróleo
  "Desengrasante": "#8e44ad",    // morado
};
const PRODUCT_COLOR_DEFAULT = "#95a5a6"; // producto nuevo sin color asignado

export function productColor(nombre: string): string {
  return PRODUCT_COLORS[nombre] ?? PRODUCT_COLOR_DEFAULT;
}

// EL semáforo del dashboard. Uno solo para todo lo que sea "% de la meta": litros
// sobre lo esperado, locales realizados, prioridad Alta, emergencias, avance de una
// ruta. Verde desde 80, ámbar desde 50, rojo abajo.
//
// Antes había una segunda escala (100 / 70) solo para litros, y el mismo "voy por la
// mitad" salía rojo en un balde y ámbar en el de al lado. Dos varas para la misma
// pregunta es lo que hacía ilegible la fila de baldes: si hace falta cambiar los
// cortes, se cambian acá y cambian en todas las vistas a la vez.
export function semaforo(pct: number, t: Tokens): string {
  if (pct >= 80) return t.good;
  if (pct >= 50) return t.warning;
  return t.critical;
}

// El mismo semáforo sobre fondo oscuro (el hero del carrusel, que es un degradado
// verde-petróleo en los dos temas): mismos cortes, tonos claros. El verde de marca
// (#0ca30c) sobre ese fondo queda casi negro y el rojo pierde toda la alarma, así
// que los tokens del tema no sirven acá.
const SEMAFORO_ON_DARK = { good: "#8fe08f", warning: "#ffd166", critical: "#ff9e9e" };

export function semaforoOnDark(pct: number): string {
  if (pct >= 80) return SEMAFORO_ON_DARK.good;
  if (pct >= 50) return SEMAFORO_ON_DARK.warning;
  return SEMAFORO_ON_DARK.critical;
}

// Color del estado de un local: verde realizado · rojo el no alcanzado · rojo
// profundo el fallido (el fallo "de verdad": se pasó y no se pudo recolectar,
// frente a la ruta que no alcanzó a llegar) · gris pendiente. Lo comparten la
// tabla de detalle del carrusel y los pines del mapa: el mismo estado se ve del
// mismo color en las dos vistas.
export function estadoColor(estado: string, t: Tokens): string {
  if (estado === "Realizado") return t.good;
  if (estado === "Fallido") return t.criticalDark;
  if (estado === "No alcanzado") return t.critical;
  // Pendiente: gris, pero el de texto y no el `muted`. Sobre el mapa claro un
  // gris pálido directamente desaparece, y los pendientes son mayoría del día.
  return t.textSecondary;
}

// Color de la PRIORIDAD del local: rojo alta · naranja media · azul baja/normal.
// Una emergencia manda sobre la prioridad y se pinta morada. Es la segunda
// dimensión de la vista: en el mapa va en el borde del punto (el relleno lleva el
// estado), así un punto dice a la vez qué tan urgente es y cómo terminó.
export function prioridadColor(prioridad: string, emergencia: boolean | undefined, t: Tokens): string {
  if (emergencia) return t.categorical[4]; // morado
  if (prioridad === "Alta") return t.critical;
  if (prioridad === "Media") return t.serious;
  if (prioridad === "Baja" || prioridad === "Normal") return t.accent2;
  return t.muted; // prioridad no cargada ("—")
}

// Orden de la leyenda / los selects. Fijo: primero lo hecho, después lo que
// requiere acción; las prioridades de mayor a menor urgencia.
export const ESTADOS = ["Realizado", "Pendiente", "No alcanzado", "Fallido"] as const;
export const PRIORIDADES = ["Alta", "Media", "Baja"] as const;
