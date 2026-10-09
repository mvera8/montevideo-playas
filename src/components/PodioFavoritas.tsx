"use client";

import { Heart } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useTotalesAlDia } from "@/lib/me-gusta-cliente";
import type { TotalesMeGusta } from "@/lib/me-gusta-temporada";

// Podio de la home: las 3 playas con más me gusta en la temporada. Arranca con los totales del HTML
// (ISR, pueden estar viejos) y se corrige con los que pide el navegador al cargar.

type Favorita = TotalesMeGusta & { slug: string; nombre: string };

const numero = new Intl.NumberFormat("es-UY");
const MEDALLAS = ["🥇", "🥈", "🥉"];

export default function PodioFavoritas({ inicial, errorServidor }: { inicial: Favorita[]; errorServidor: boolean }) {
  const playas = useTotalesAlDia(inicial);
  const error = errorServidor && playas === inicial; // el servidor falló y el navegador todavía no trajo nada
  const podio = playas
    .filter((p) => p.temporada > 0)
    .sort((a, b) => b.temporada - a.temporada || a.slug.localeCompare(b.slug, "es"))
    .slice(0, 3);

  if (error || podio.length === 0) {
    return (
      <div className="rounded-3xl bg-white/10 p-6 text-center ring-1 ring-white/20 backdrop-blur">
        <p className="text-4xl" aria-hidden>
          🏖️
        </p>
        <p className="mt-3 text-lg font-semibold">
          {error ? "Ahora no pudimos cargar el ranking" : "Todavía nadie votó esta temporada"}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {error ? "Probá de nuevo en unos minutos." : "Abrí el mapa y dale el primer me gusta a tu playa."}
        </p>
      </div>
    );
  }
  return (
    <ol className="space-y-3">
      {podio.map((p, i) => (
        <li key={p.slug}>
          <Link
            href={`/playas?playa=${p.slug}`}
            className="flex items-center gap-4 rounded-2xl bg-white/10 px-6 py-4 ring-1 ring-white/20 backdrop-blur transition-colors duration-700 ease-fluido hover:bg-white/15"
          >
            <span className="text-2xl" aria-hidden>
              {MEDALLAS[i]}
            </span>
            <span className="min-w-0 flex-1 truncate text-lg font-semibold">
              <span className="sr-only">{i + 1}.º </span>
              {p.nombre}
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold tabular-nums text-rose-300">
              <Heart weight="fill" className="h-4 w-4" aria-hidden />
              {numero.format(p.temporada)}
              <span className="sr-only"> me gusta</span>
            </span>
          </Link>
        </li>
      ))}
      {/* Puestos libres: el podio siempre muestra 3 lugares */}
      {MEDALLAS.slice(podio.length).map((m) => (
        <li
          key={m}
          className="flex items-center gap-4 rounded-2xl px-6 py-4 border border-dashed border-white/30 text-white/60"
        >
          <span className="text-2xl opacity-60" aria-hidden>
            {m}
          </span>
          <span className="text-sm">Puesto libre: puede ser tu playa</span>
        </li>
      ))}
    </ol>
  );
}
