"use client";

import Link from "next/link";
import type { TotalesMeGusta } from "@/lib/me-gusta";
import { meGustaDisponible, useMeGusta, useTotalesMeGusta } from "@/lib/me-gusta-cliente";

const numero = new Intl.NumberFormat("es-UY");

// Rojo si me gusta, gris si no (mismo criterio en la tarjeta y en el detalle).
const color = (lleno: boolean) => (lleno ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500");

function Corazon({ lleno, className = "h-4 w-4" }: { lleno: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z"
        fill={lleno ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Contador de la tarjeta: ♥ N me gusta, en rojo si me gusta y en gris si no. */
export function ContadorMeGusta({ slug, inicial }: { slug: string; inicial: TotalesMeGusta | null }) {
  const t = useTotalesMeGusta(slug, inicial);
  if (!meGustaDisponible || !t) return null;
  return (
    <span
      className={`flex items-center gap-0.5 whitespace-nowrap text-[11px] tabular-nums ${color(t.meGusta)}`}
      title={t.meGusta ? "Te gusta esta playa" : `${numero.format(t.temporada)} me gusta esta temporada`}
    >
      <Corazon lleno={t.meGusta} className="h-3 w-3" />
      {numero.format(t.temporada)} me gusta
    </span>
  );
}

/** Botón ❤️ al lado del nombre de la playa; con el mouse encima muestra "Me gusta". */
export function BotonMeGusta({ slug, nombre, inicial }: { slug: string; nombre: string; inicial: TotalesMeGusta | null }) {
  const { estado, cargado, alternar } = useMeGusta(slug, inicial);
  if (!meGustaDisponible || !estado) return null;
  const lleno = estado.meGusta;
  return (
    <button
      onClick={alternar}
      disabled={!cargado}
      aria-pressed={lleno}
      aria-label={lleno ? `Sacar me gusta a ${nombre}` : `Me gusta ${nombre}`}
      title={lleno ? "Te gusta" : "Me gusta"}
      className={`group/mg flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium ring-1 transition-transform active:scale-90 disabled:opacity-60 ${
        lleno
          ? "bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900"
          : "text-slate-600 ring-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
      }`}
    >
      <Corazon lleno={lleno} className={`h-4 w-4 ${lleno ? color(true) : ""}`} />
      <span className="hidden pr-1 group-hover/mg:inline group-focus-visible/mg:inline">Me gusta</span>
    </button>
  );
}

/** Totales y aviso de privacidad, debajo del nombre en el detalle. */
export function TotalesDetalle({ slug, inicial }: { slug: string; inicial: TotalesMeGusta | null }) {
  const estado = useTotalesMeGusta(slug, inicial);
  if (!meGustaDisponible || !estado) return null;
  return (
    <div className="mt-2">
      <p className={`flex items-center gap-1 text-xs ${color(estado.meGusta)}`}>
        <Corazon lleno={estado.meGusta} className="h-3 w-3" />
        <span className="font-semibold tabular-nums">{numero.format(estado.temporada)}</span> me gusta esta temporada
        {estado.siempre > estado.temporada && (
          <span className="text-slate-500"> · {numero.format(estado.siempre)} en total</span>
        )}
      </p>
      {estado.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{estado.error}</p>}
      <p className="mt-1 text-[11px] text-slate-500">
        El me gusta se guarda con una cuenta anónima de este navegador, sin pedirte datos. Solo se muestra el total.{" "}
        <Link href="/privacidad#me-gusta" className="underline">
          Privacidad
        </Link>
      </p>
    </div>
  );
}
