import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppFrame from "@/components/AppFrame";
import { cssVariables } from "@/lib/theme";

// Inter: tipografía diseñada para UI en pantalla, con cifras tabulares. next/font
// la auto-hospeda en el build (sin requests a Google en runtime). Se expone como
// var(--font-sans) para usarla en CSS y en los charts (ver ReactECharts).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "App Monitor",
  description: "Dashboard de recolección — versión Next.js con ECharts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* La paleta sale de lib/theme.ts, que es su única fuente, y se inyecta acá
            —server-side, antes de globals.css— para que los colores estén en el
            primer pintado. El contenido es una constante del módulo, no entrada de
            usuario. */}
        <style dangerouslySetInnerHTML={{ __html: cssVariables() }} />
      </head>
      {/* suppressHydrationWarning: extensiones del navegador (p. ej. ColorZilla con
          cz-shortcut-listen) inyectan atributos en el <body> antes de hidratar. */}
      <body suppressHydrationWarning>
        <ThemeProvider>
          <AppFrame>{children}</AppFrame>
        </ThemeProvider>
      </body>
    </html>
  );
}
