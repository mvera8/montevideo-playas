"use client";

import { IconAlertTriangle, IconRipple } from "@tabler/icons-react";
import type { AguasVivasPlaya, AvistamientoPlaya } from "@/lib/aguas-vivas";
import SeccionPlegable from "./SeccionPlegable";

// Mismos valores que en el servidor; se repiten para no importar código server-only.
const DIAS_VIGENCIA = 10; // ver DIAS_VIGENCIA en lib/aguas-vivas.ts
const KM_CERCA = 5; // ver KM_CERCA en lib/aguas-vivas.ts

const haceDias = (n: number) => (n <= 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`);

const fecha = (s: string) => {
  const [a, m, d] = s.split("-");
  return `${Number(d)}/${Number(m)}${a !== String(new Date().getFullYear()) ? `/${a.slice(2)}` : ""}`;
};

const km = (n: number) => (n < 1 ? "a menos de 1 km" : `a ${n.toFixed(n < 10 ? 1 : 0)} km`);

const CHIP = {
  cerca: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  lejos: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
} as const;

export const ANCLA_AGUAS_VIVAS = "seccion-aguas-vivas";

/** Reportes vigentes a menos de KM_CERCA: el chip "reportes cerca" y el agua viva 3D del mapa. */
export const reportesCerca = (datos: AguasVivasPlaya | null) => datos?.recientes.filter((a) => a.km <= KM_CERCA) ?? [];

// Avistamientos de aguas vivas que la comunidad subió a iNaturalist: los de los últimos DIAS_VIGENCIA
// días en la costa, del más cercano a la playa al más lejano. Sin reportes vigentes (o si iNaturalist no
// respondió) la sección no se muestra: con tan pocos reportes por año, casi siempre estaría vacía.
export default function AguasVivas({ datos }: { datos: AguasVivasPlaya | null }) {
  if (!datos?.recientes.length) return null;
  const cerca = reportesCerca(datos);
  const [chip, texto] = cerca.length
    ? (["cerca", cerca.length === 1 ? "1 reporte cerca" : `${cerca.length} reportes cerca`] as const)
    : (["lejos", `En la costa, ${km(datos.recientes[0].km)}`] as const);

  return (
    <SeccionPlegable
      titulo="Aguas vivas"
      ancla={ANCLA_AGUAS_VIVAS}
      resumen={<span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${CHIP[chip]}`}>{texto}</span>}
    >
      <div className="space-y-2">
        <ul className="space-y-1">
          {datos.recientes.map((a) => (
            <Reporte key={a.id} a={a} />
          ))}
        </ul>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Reportes voluntarios de la comunidad en iNaturalist de los últimos {DIAS_VIGENCIA} días, no un monitoreo
          oficial. Se reportan pocas (unas pocas por temporada), así que <strong>en las playas sin reportes también
          puede haber aguas vivas</strong>: mirá el agua y preguntale al guardavidas. Si te pica, enjuagá con agua de mar
          (no dulce) y consultá en la casilla.
        </p>
      </div>
    </SeccionPlegable>
  );
}

function Reporte({ a }: { a: AvistamientoPlaya }) {
  return (
    <li>
      <a
        href={a.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-3 rounded-xl px-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
            a.peligrosa ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          }`}
          aria-hidden
        >
          {a.peligrosa ? <IconAlertTriangle className="h-3.5 w-3.5" stroke={2} /> : <IconRipple className="h-3.5 w-3.5" stroke={2} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{a.nombre}</span>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">{km(a.km)}</span>
          </span>
          {a.peligrosa && (
            <span className="block text-xs font-medium text-red-700 dark:text-red-400">Pica fuerte: no la toques, ni varada en la arena</span>
          )}
          <span className="block text-xs text-slate-500">
            {fecha(a.fecha)} ({haceDias(a.dias)}){a.lugar && ` · ${a.lugar}`}
          </span>
          <span className="block text-[11px] text-slate-400">
            iNaturalist · {a.confirmada ? "identificación confirmada" : "identificación sin confirmar"}
          </span>
        </span>
      </a>
    </li>
  );
}
