// Sistema de diseño: tokens de color para tema claro y oscuro.
// La paleta de datos (categórica / status / secuencial) sale de la skill
// `dataviz` (paleta de referencia validada — CVD-safe, contraste chequeado).
// El acento de marca (verde) se usa solo en el chrome, no en los datos.

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
    textSecondary: "#52514e",
    muted: "#898781",
    border: "rgba(11,11,11,0.10)",
    grid: "#e8ebe8",
    axis: "#c3c2b7",
    accent: "#2d7a2d",
    accent2: "#1a6b8a",
    good: "#0ca30c",
    warning: "#eda100",
    serious: "#ec835a",
    critical: "#d03b3b",
    categorical: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"],
    seq: ["#cfe6cf", "#9fce9f", "#6bb76b", "#3f9f3f", "#2d7a2d", "#1f5a1f"],
  },
  dark: {
    bg: "#0d0f0d",
    surface: "#181a18",
    surface2: "#1f221f",
    text: "#f4f6f4",
    textSecondary: "#c3c2b7",
    muted: "#8f938c",
    border: "rgba(255,255,255,0.10)",
    grid: "#2a2d2a",
    axis: "#3a3d3a",
    accent: "#35c46b",
    accent2: "#4bb6d4",
    good: "#0ca30c",
    warning: "#fab219",
    serious: "#ec835a",
    critical: "#e05555",
    categorical: ["#3987e5", "#199e70", "#c98500", "#2a9d2a", "#9085e9", "#e66767", "#d55181", "#d95926"],
    seq: ["#1f3a1f", "#2d5a2d", "#3f8a3f", "#4faf4f", "#5fc95f", "#8fe08f"],
  },
};

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

// Semáforo general (locales, litros relativos, prioridad alta).
export function semaforo(pct: number, t: Tokens): string {
  if (pct >= 80) return t.good;
  if (pct >= 50) return t.warning;
  return t.critical;
}

// Semáforo de la comparativa litros-vs-esperado (umbral 100 / 70).
export function semaforoComp(pct: number, t: Tokens): string {
  if (pct >= 100) return t.good;
  if (pct >= 70) return t.warning;
  return t.critical;
}
