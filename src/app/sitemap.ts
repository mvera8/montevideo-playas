import type { MetadataRoute } from "next";
import { ENLACES_LEGALES, ENLACES_PRINCIPALES } from "@/lib/navegacion";
import { getNovedades } from "@/lib/novedades";
import { SITIO } from "@/lib/sitio";

// Mismo ritmo que /novedades/[slug]: una nota programada entra al sitemap el día que se publica.
export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  const novedades = getNovedades(); // ya filtradas por fecha y ordenadas de la más nueva a la más vieja
  // Solo se pone `lastModified` donde hay una fecha cierta: /novedades cambia cuando sale una nota.
  // El resto no lleva, porque una fecha inventada hace que Google ignore el campo en todo el sitio.
  const ultimaNovedad = novedades[0]?.fecha;

  const paginas = [...ENLACES_PRINCIPALES, ...ENLACES_LEGALES].map((e) => ({
    url: `${SITIO.url}${e.href === "/" ? "" : e.href}`,
    ...(e.href === "/novedades" && ultimaNovedad ? { lastModified: ultimaNovedad } : {}),
  }));
  const notas = novedades.map((n) => ({
    url: `${SITIO.url}/novedades/${n.slug}`,
    lastModified: n.fecha,
  }));
  return [...paginas, ...notas];
}
