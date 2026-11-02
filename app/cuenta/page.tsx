"use client";
// Cambiar la contraseña propia (menú de usuario → Mi contraseña). Antes no había
// forma de hacerlo sin pasar por el panel de Supabase. Usa la sesión iniciada:
// supabase.auth.updateUser solo toca al usuario logueado. weak_password lo devuelve
// Supabase si no cumple los requisitos del proyecto (y, en plan Pro con la
// protección de contraseñas filtradas activa, si aparece en filtraciones públicas).
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MINIMO = 8;

// Mensajes por código de error de Supabase Auth; el resto cae al genérico.
function mensajeError(code: string | undefined): string {
  switch (code) {
    case "weak_password":
      return "Esa contraseña es muy débil. Elige otra.";
    case "same_password":
      return "La contraseña nueva tiene que ser distinta de la actual.";
    case "reauthentication_needed":
      return "Por seguridad, cierra sesión, vuelve a entrar y cámbiala de inmediato.";
    default:
      return "No se pudo cambiar la contraseña. Inténtalo de nuevo.";
  }
}

export default function CuentaPage() {
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setListo(false);
    if (nueva.length < MINIMO) { setError(`Usa al menos ${MINIMO} caracteres.`); return; }
    if (nueva !== repetida) { setError("Las dos contraseñas no coinciden."); return; }

    setGuardando(true);
    const { error } = await createClient().auth.updateUser({ password: nueva });
    setGuardando(false);
    if (error) { setError(mensajeError(error.code)); return; }
    setNueva("");
    setRepetida("");
    setListo(true);
  }

  return (
    <div style={{ display: "grid", placeItems: "start center", padding: "24px 16px" }}>
      <form className="login-card" onSubmit={handleSubmit}>
        <div>
          <div className="login-title">Mi contraseña</div>
          <div className="login-sub">Cambia la contraseña con la que entras al monitor.</div>
        </div>

        <label className="login-label">
          Contraseña nueva
          <input
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            required
            minLength={MINIMO}
            autoComplete="new-password"
            className="login-input"
          />
        </label>

        <label className="login-label">
          Repite la contraseña nueva
          <input
            type="password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            required
            autoComplete="new-password"
            className="login-input"
          />
        </label>

        {error && <p className="login-error">{error}</p>}
        {listo && <p className="status-ok" style={{ margin: 0, fontSize: 13 }}>✅ Contraseña cambiada. La próxima vez entra con la nueva.</p>}

        <button type="submit" disabled={guardando} className="login-btn">
          {guardando ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}
