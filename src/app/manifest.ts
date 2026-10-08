import type { MetadataRoute } from "next";
import { SITIO } from "@/lib/sitio";

// Lo que usan Android/Chrome (y en parte iOS) al "Agregar a pantalla de inicio". Los PNG salen de
// scripts/generar-iconos.mjs; el ícono de iOS es src/app/apple-icon.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITIO.marca,
    // Nombre debajo del ícono (iOS lo toma de appleWebApp.title en layout.tsx).
    short_name: `${SITIO.nombre} ${SITIO.alcance}`,
    description: `Playas, guardavidas, calidad del agua y clima en ${SITIO.nombre}.`,
    lang: "es-UY",
    start_url: "/",
    display: "standalone",
    theme_color: "#0b1620",
    background_color: "#0b1620",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
