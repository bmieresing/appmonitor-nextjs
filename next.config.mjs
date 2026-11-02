// Headers de seguridad para todas las rutas. No hay CSP completa: Leaflet, ECharts
// y los estilos inline de React necesitarían una lista larga de excepciones; lo que
// sí se cierra es que otro sitio embeba el monitor en un iframe (clickjacking). La
// tele de la oficina abre /pantalla como página principal del WebView, no en un
// iframe, así que no le afecta.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
