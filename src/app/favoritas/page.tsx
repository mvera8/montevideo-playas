import type { Metadata } from "next";
import Link from "next/link";
import PaginaSitio from "@/components/PaginaSitio";
import { temporadaMeGusta } from "@/lib/me-gusta-temporada";
import { getPlayas } from "@/lib/playas";
import { SITIO } from "@/lib/sitio";

// Ranking de playas por me gusta (dato propio del sitio, ver src/lib/me-gusta.ts). Usa los mismos
// datos que /playas (getPlayas ya trae los totales, cacheados 5 min), así que no suma pedidos.
export const revalidate = 300;

export const metadata: Metadata = {
  title: `Playas favoritas · ${SITIO.marca}`,
  description: `Las playas de ${SITIO.alcance} con más me gusta esta temporada.`,
};

const numero = new Intl.NumberFormat("es-UY");
const MEDALLAS = ["🥇", "🥈", "🥉"];

export default async function FavoritasPage() {
  const { playas } = await getPlayas();
  const disponible = playas.some((p) => p.meGusta);
  const ranking = playas
    .map((p) => ({ slug: p.slug, nombre: p.nombre, ...(p.meGusta ?? { temporada: 0, siempre: 0 }) }))
    .sort((a, b) => b.temporada - a.temporada || b.siempre - a.siempre || a.nombre.localeCompare(b.nombre, "es"));
  const conVotos = ranking.filter((p) => p.temporada > 0);
  const sinVotos = ranking.filter((p) => p.temporada === 0);
  const max = conVotos[0]?.temporada ?? 1;

  return (
    <PaginaSitio
      titulo="Playas favoritas"
      bajada={`Las playas con más me gusta en la temporada ${temporadaMeGusta()} (de julio a junio). Tocá una para verla en el mapa.`}
    >
      {!disponible ? (
        <p className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm dark:border-orange-900 dark:bg-orange-950/50">
          Ahora no pudimos cargar los me gusta. Probá de nuevo en unos minutos.
        </p>
      ) : (
        <>
          {conVotos.length === 0 && (
            <p className="mt-8 rounded-2xl border border-sky-200 bg-white p-5 text-sm dark:border-sky-900 dark:bg-slate-900">
              Todavía nadie le dio me gusta a una playa esta temporada. ¡Elegí tu favorita en el{" "}
              <Link href="/playas" className="text-sky-700 underline dark:text-sky-300">
                mapa
              </Link>
              !
            </p>
          )}

          <ol className="mt-8 space-y-2">
            {conVotos.map((p, i) => (
              <li key={p.slug}>
                <Link
                  href={`/playas?playa=${p.slug}`}
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-black/5 hover:ring-sky-300 dark:bg-slate-900 dark:ring-white/10 dark:hover:ring-sky-700"
                >
                  {/* Barra proporcional a los me gusta */}
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-full origin-left bg-rose-50 dark:bg-rose-950/40"
                    style={{ transform: `scaleX(${p.temporada / max})` }}
                  />
                  <span className="relative w-8 shrink-0 text-center text-lg font-semibold tabular-nums text-slate-400">
                    {MEDALLAS[i] ?? i + 1}
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900 group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-300">
                      {p.nombre}
                    </span>
                    {p.siempre > p.temporada && (
                      <span className="block text-xs text-slate-500">{numero.format(p.siempre)} en total</span>
                    )}
                  </span>
                  <span className="relative flex items-center gap-1 text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                      <path
                        d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z"
                        fill="currentColor"
                      />
                    </svg>
                    {numero.format(p.temporada)}
                    <span className="sr-only"> me gusta</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          {sinVotos.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sin me gusta esta temporada</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {sinVotos.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/playas?playa=${p.slug}`}
                      className="block rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-black/5 hover:text-sky-700 hover:ring-sky-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10"
                    >
                      {p.nombre}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
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
