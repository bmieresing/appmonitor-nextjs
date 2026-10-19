"use client";
// Menú de usuario de la barra superior: junta lo que se toca una vez y queda
// (zoom del tablero, parámetros, tema, cerrar sesión) para que la barra no baje a una segunda
// fila. Se cierra con clic afuera o con Escape.
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { ZoomControl } from "./Zoom";
import { createClient } from "@/lib/supabase/client";

export default function MenuUsuario() {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { mode, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="menu-usr" ref={ref}>
      <button className={`icon-btn${abierto ? " active" : ""}`} onClick={() => setAbierto((v) => !v)}
        title="Usuario" aria-label="Menú de usuario" aria-expanded={abierto} aria-haspopup="menu">
        👤
      </button>
      {abierto && (
        <div className="menu-usr-pop" role="menu">
          <div className="menu-usr-fila">
            <span>Zoom</span>
            <ZoomControl />
          </div>
          <Link href="/parametros" className={`menu-usr-item${pathname === "/parametros" ? " active" : ""}`}
            role="menuitem" onClick={() => setAbierto(false)}>
            <span className="ic">⚙️</span> Parámetros
          </Link>
          <button className="menu-usr-item" role="menuitem" onClick={toggle}>
            <span className="ic">{mode === "light" ? "🌙" : "☀️"}</span>
            {mode === "light" ? "Modo oscuro" : "Modo claro"}
          </button>
          <button className="menu-usr-item peligro" role="menuitem" onClick={logout}>
            <span className="ic">⏻</span> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
