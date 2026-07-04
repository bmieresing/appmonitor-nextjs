"use client";
// Contexto de tema claro/oscuro. Inicializa desde localStorage o
// prefers-color-scheme, aplica data-theme en <html> y expone los tokens.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { THEME, Tokens, Mode } from "@/lib/theme";

interface Ctx {
  mode: Mode;
  tokens: Tokens;
  toggle: () => void;
}

const ThemeCtx = createContext<Ctx>({ mode: "light", tokens: THEME.light, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const guardado = (typeof localStorage !== "undefined" && localStorage.getItem("monitor-theme")) as Mode | null;
    const inicial: Mode = guardado ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setMode(inicial);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === "light" ? "dark" : "light";
      try { localStorage.setItem("monitor-theme", next); } catch {}
      return next;
    });
  }, []);

  return <ThemeCtx.Provider value={{ mode, tokens: THEME[mode], toggle }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
