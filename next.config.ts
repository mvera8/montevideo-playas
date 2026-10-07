import type { NextConfig } from "next";

// Dominio principal: montevideo.playas.uy. playas.uy (y www) queda reservado para una futura portada
// de todo Uruguay; mientras tanto redirige al subdominio. En Vercel los tres dominios tienen que
// estar agregados al MISMO proyecto (sin redirección propia de Vercel) para que estas reglas corran.
const PRINCIPAL = "https://montevideo.playas.uy";

const nextConfig: NextConfig = {
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
