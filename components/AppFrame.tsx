"use client";
// Decide si envolver la página con el Shell (sidebar + header + snapshot) o
// mostrarla desnuda. El /login va sin Shell: no debe cargar el snapshot ni la
// navegación. El resto de las rutas van con Shell.
import { usePathname } from "next/navigation";
import Shell from "./Shell";

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  return <Shell>{children}</Shell>;
}
