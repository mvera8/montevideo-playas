import type { NextConfig } from "next";

// Dominio principal: montevideo.playas.uy. playas.uy (y www) queda reservado para una futura portada
// de todo Uruguay; mientras tanto redirige al subdominio. En Vercel los tres dominios tienen que
// estar agregados al MISMO proyecto (sin redirección propia de Vercel) para que estas reglas corran.
const PRINCIPAL = "https://montevideo.playas.uy";

// Headers de seguridad para todas las respuestas. HSTS no va acá: Vercel ya lo agrega en sus dominios.
// Permissions-Policy: la ubicación la usa el mapa ("Cerca mío"); la cámara no hace falta porque la foto
// de playa usa <input type="file" capture>, que abre la app de cámara del sistema y no pasa por esta política.
//
// Content-Security-Policy: qué puede cargar el navegador y desde dónde. Va sin nonces (guía de Next,
// "Without Nonces"): con nonces todas las páginas pasan a ser dinámicas y se pierde el ISR. Por eso
// los scripts y estilos en línea quedan permitidos ('unsafe-inline': Next los usa para hidratar, GA para
// arrancar, inlineCss y MapLibre para los estilos); lo que sí corta es cargar scripts o mandar datos a
// cualquier otro dominio, plugins, <base> y formularios hacia afuera. Dominios que usa el navegador:
// - tiles.openfreemap.org: estilo, mosaicos, sprites y tipografías del mapa (MapLibre los pide con fetch).
// - Supabase (NEXT_PUBLIC_SUPABASE_URL): totales y me gusta, login anónimo.
// - Google Analytics 4: los dominios que pide Google (developers.google.com/tag-platform/security/guides/csp).
// - blob: el worker de MapLibre y la foto de playa (canvas → blob). El worker vive en /maplibre/ ('self').
// Si se suma un servicio que corre en el navegador, agregarlo acá o el navegador lo bloquea.
// MODO: empieza en Report-Only (avisa en la consola, no bloquea). Cuando en producción no aparezcan
// avisos "[Report Only] Refused to…" al usar el mapa, la foto, los me gusta y GA, cambiar el header de
// abajo a "Content-Security-Policy" (los checks avisan mientras siga en reporte).
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
const GA = "https://*.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";
const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' solo en desarrollo (React lo usa para mostrar errores).
  `script-src 'self' 'unsafe-inline' https://*.googletagmanager.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://tiles.openfreemap.org ${GA}`,
  "font-src 'self'",
  `connect-src 'self' https://tiles.openfreemap.org ${SUPABASE} ${GA}`.replace(/\s+/g, " "),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const HEADERS_SEGURIDAD = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Content-Security-Policy-Report-Only", value: CSP },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // CSS dentro del HTML (<style>) en vez de <link>: saca el CSS (15 KB con Tailwind) de la ruta crítica,
    // que PageSpeed marcaba como "Solicitudes que bloquean el renderizado" (cadena HTML → CSS de 683 ms
    // en celular). Contra: no se cachea aparte, cada página nueva lo vuelve a traer con el HTML; al
    // navegar entre páginas prerenderizadas Next sigue usando <link>. Experimental; solo en build.
    inlineCss: true,
  },
  images: {
    // Los de Next más 1440: con los de fábrica, una foto a lo ancho (sizes="100vw") en una notebook de
    // 1350–1440 px saltaba de 1200 a 1920: la portada de la home bajaba 183 KB (a 1200 son 96 KB; a 1440
    // se estiman ~130 KB). Lo marcaba PageSpeed en "Mejorar la entrega de imágenes". Medido el 2026-10-09.
    // Cada ancho nuevo es una transformación más en Vercel.
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920, 2048, 3840],
  },
  async headers() {
    return [{ source: "/:ruta*", headers: HEADERS_SEGURIDAD }];
  },
  async redirects() {
    return [
      // playas.uy/montevideo/... (desde cualquier host) → montevideo.playas.uy/...
      { source: "/montevideo", destination: `${PRINCIPAL}/`, permanent: true },
      { source: "/montevideo/:ruta*", destination: `${PRINCIPAL}/:ruta*`, permanent: true },
      // playas.uy y www.playas.uy → montevideo.playas.uy, conservando la ruta.
      ...["playas.uy", "www.playas.uy"].map((host) => ({
        source: "/:ruta*",
        has: [{ type: "host" as const, value: host }],
        destination: `${PRINCIPAL}/:ruta*`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
