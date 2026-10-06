"use client";

import Link from "next/link";
import { useTotalesAlDia } from "@/lib/me-gusta-cliente";
import type { TotalesMeGusta } from "@/lib/me-gusta-temporada";

// Ranking de /favoritas. Arranca con los totales del HTML (ISR, pueden estar viejos) y se corrige
// con los que pide el navegador al cargar.

type Favorita = TotalesMeGusta & { slug: string; nombre: string };

const numero = new Intl.NumberFormat("es-UY");
const MEDALLAS = ["🥇", "🥈", "🥉"];

export default function RankingFavoritas({ inicial }: { inicial: Favorita[] }) {
  const ranking = [...useTotalesAlDia(inicial)].sort(
    (a, b) => b.temporada - a.temporada || b.siempre - a.siempre || a.nombre.localeCompare(b.nombre, "es"),
  );
  const conVotos = ranking.filter((p) => p.temporada > 0);
  const sinVotos = ranking.filter((p) => p.temporada === 0);
  const max = conVotos[0]?.temporada ?? 1;

  return (
    <>
      {conVotos.length === 0 && (
        <p className="mt-8 rounded-2xl border border-sky-200 bg-white p-5 text-sm">
          Todavía nadie le dio me gusta a una playa esta temporada. ¡Elegí tu favorita en el{" "}
          <Link href="/playas" className="text-sky-700 underline">
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
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-black/5 hover:ring-sky-300"
            >
              {/* Barra proporcional a los me gusta */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-full origin-left bg-rose-50"
                style={{ transform: `scaleX(${p.temporada / max})` }}
              />
              <span className="relative w-8 shrink-0 text-center text-lg font-semibold tabular-nums text-slate-400">
                {MEDALLAS[i] ?? i + 1}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900 group-hover:text-sky-700">
                  {p.nombre}
                </span>
                {p.siempre > p.temporada && (
                  <span className="block text-xs text-slate-500">{numero.format(p.siempre)} en total</span>
                )}
              </span>
              <span className="relative flex items-center gap-1 text-sm font-semibold tabular-nums text-rose-600">
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
          <h2 className="text-sm font-semibold text-slate-900">Sin me gusta esta temporada</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {sinVotos.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/playas?playa=${p.slug}`}
                  className="block rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-black/5 hover:text-sky-700 hover:ring-sky-300"
                >
                  {p.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
