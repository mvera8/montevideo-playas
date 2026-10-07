import type { Metadata } from "next";
import PaginaSitio from "@/components/PaginaSitio";
import TarjetaNovedad from "@/components/TarjetaNovedad";
import { getNovedades } from "@/lib/novedades";
import { SITIO } from "@/lib/sitio";

// Notas escritas a mano (src/lib/novedades.ts). Se regenera cada hora para que una nota con fecha
// futura aparezca sola el día que corresponde.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Novedades",
  description: `Novedades de la temporada de playas en ${SITIO.nombre} y del sitio.`,
  alternates: { canonical: "/novedades" },
};

export default function NovedadesPage() {
  const novedades = getNovedades();
  return (
    <PaginaSitio
      titulo="Novedades"
      anchoCompleto
      bajada="La temporada de playas, cambios en el sitio y consejos para aprovechar el mapa."
    >
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {novedades.map((n) => (
          <li key={n.slug}>
            <TarjetaNovedad novedad={n} />
          </li>
        ))}
      </ul>
    </PaginaSitio>
  );
}
