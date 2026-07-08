"use client";
// Dropdown para filtrar los choferes de Regiones por centro de acopio. Cada opción
// muestra el puntito de color del centro (mismo mapeo que las cards). "Todos"
// quita el filtro. Se cierra al clickear afuera o con Escape.
import { useEffect, useRef, useState } from "react";

export default function FiltroCentro({ centros, valor, onChange, colorDe }: {
  centros: string[];
  valor: string;
  onChange: (centro: string) => void;
  colorDe: (c: string | null | undefined) => string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (c: string) => { onChange(c); setOpen(false); };

  return (
    <div className="fc" ref={ref}>
      <span className="fc-label">Centro de acopio</span>
      <button className={`fc-trigger${valor ? " activo" : ""}`} onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox" aria-expanded={open}>
        {valor ? (
          <>
            <span className="fc-dot" style={{ background: colorDe(valor) ?? "var(--muted)" }} />
            <span className="fc-txt">{valor}</span>
          </>
        ) : (
          <span className="fc-txt fc-todos">Todos los centros</span>
        )}
        <span className="fc-chev">▾</span>
      </button>
      {valor && (
        <button className="fc-clear" onClick={() => onChange("")} title="Quitar filtro" aria-label="Quitar filtro">✕</button>
      )}
      {open && (
        <div className="fc-menu" role="listbox">
          <button className={`fc-item${!valor ? " sel" : ""}`} onClick={() => pick("")}>
            <span className="fc-dot fc-dot-all" />
            <span className="fc-txt">Todos los centros</span>
            {!valor && <span className="fc-check">✓</span>}
          </button>
          {centros.map((c) => (
            <button key={c} className={`fc-item${valor === c ? " sel" : ""}`} onClick={() => pick(c)}>
              <span className="fc-dot" style={{ background: colorDe(c) ?? "var(--muted)" }} />
              <span className="fc-txt">{c}</span>
              {valor === c && <span className="fc-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
