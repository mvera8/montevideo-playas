import type { Metadata } from "next";
import Link from "next/link";
import PaginaSitio from "@/components/PaginaSitio";
import RankingFavoritas from "@/components/RankingFavoritas";
import { temporadaMeGusta } from "@/lib/me-gusta-temporada";
import { getPlayas } from "@/lib/playas";
import { SITIO } from "@/lib/sitio";

// Ranking de playas por me gusta (dato propio del sitio, ver src/lib/me-gusta.ts). Usa los mismos
// datos que /playas (getPlayas ya trae los totales, cacheados 5 min), así que no suma pedidos; el
// navegador los vuelve a pedir al cargar (ver `RankingFavoritas`).
export const revalidate = 300;

export const metadata: Metadata = {
  title: `Playas favoritas · ${SITIO.marca}`,
  description: `Las playas de ${SITIO.alcance} con más me gusta esta temporada.`,
};

export default async function FavoritasPage() {
  const { playas } = await getPlayas();
  const disponible = playas.some((p) => p.meGusta);
  const ranking = playas.map((p) => ({ slug: p.slug, nombre: p.nombre, ...(p.meGusta ?? { temporada: 0, siempre: 0 }) }));

  return (
    <PaginaSitio
      titulo="Playas favoritas"
      bajada={`Las playas con más me gusta en la temporada ${temporadaMeGusta()} (cierra el 30 de abril, con la temporada de guardavidas). Tocá una para verla en el mapa.`}
    >
      {!disponible ? (
        <p className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm dark:border-orange-900 dark:bg-orange-950/50">
          Ahora no pudimos cargar los me gusta. Probá de nuevo en unos minutos.
        </p>
      ) : (
        <RankingFavoritas inicial={ranking} />
      )}

      <p className="mt-10 text-xs text-slate-500">
        Los me gusta son de quienes usan el sitio: no son una calificación oficial ni dicen nada sobre la seguridad o la
        calidad del agua. Se actualizan cada pocos minutos.{" "}
        <Link href="/terminos#me-gusta" className="underline">
          Más información
        </Link>
      </p>
    </PaginaSitio>
  );
}
