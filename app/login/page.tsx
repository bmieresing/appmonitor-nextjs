"use client";
// Login de Supabase Auth (email + password). Portado del login de app-tareas,
// reestilado con los tokens de diseño del monitor (var(--surface), etc.).
// Los usuarios se crean a mano en el panel de Supabase; no hay registro.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Credenciales incorrectas. Intentá de nuevo.");
      setLoading(false);
      return;
    }

    router.push("/global");
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="login-logo">🛢️</span>
          <div>
            <div className="login-title">App Monitor</div>
            <div className="login-sub">Recolección · en vivo</div>
          </div>
        </div>

        <label className="login-label">
          Correo electrónico
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="login-input"
            placeholder="tu@correo.com"
          />
        </label>

        <label className="login-label">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="login-input"
            placeholder="••••••••"
          />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={loading} className="login-btn">
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
