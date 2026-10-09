import type { NextConfig } from "next";

// Dominio principal: montevideo.playas.uy. playas.uy (y www) queda reservado para una futura portada
// de todo Uruguay; mientras tanto redirige al subdominio. En Vercel los tres dominios tienen que
// estar agregados al MISMO proyecto (sin redirección propia de Vercel) para que estas reglas corran.
const PRINCIPAL = "https://montevideo.playas.uy";

// Headers de seguridad para todas las respuestas. HSTS no va acá: Vercel ya lo agrega en sus dominios.
// Permissions-Policy: la ubicación la usa el mapa ("Cerca mío"); la cámara no hace falta porque la foto
// de playa usa <input type="file" capture>, que abre la app de cámara del sistema y no pasa por esta política.
const HEADERS_SEGURIDAD = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
