"use client";

import type { Servicio } from "@/lib/servicios";
import { AVISO_VIEJO, SERVICIO, textoFecha } from "./servicios-mapa";

const metros = (m?: number) => (m == null ? "" : m < 1000 ? `a ${Math.round(m / 10) * 10} m` : `a ${(m / 1000).toFixed(1)} km`);

// Baños, bebederos y duchas a menos de 600 m de las casillas de la playa.
export default function ServiciosCerca({
  servicios,
  onVer,
}: {
  servicios: Servicio[];
  onVer: (s: Servicio) => void;
}) {
  const conteo = (t: Servicio["tipo"]) => servicios.filter((s) => s.tipo === t).length;

  return (
    <section className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
      <h3 className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-500">
        Servicios cerca
        {servicios.length > 0 && (
          <span className="font-normal normal-case tracking-normal">
            {(["bano", "bebedero", "ducha"] as const)
              .filter((t) => conteo(t))
              .map((t) => `${SERVICIO[t].icono} ${conteo(t)}`)
              .join("  ")}
          </span>
        )}
      </h3>

      {servicios.length === 0 ? (
        <p className="text-sm text-slate-500">No hay baños, bebederos ni duchas públicos registrados a menos de 600 m.</p>
      ) : (
        <ul className="space-y-1">
          {servicios.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onVer(s)}
                className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs"
                  style={{ background: `${SERVICIO[s.tipo].color}1f` }}
                  aria-hidden
                >
                  {SERVICIO[s.tipo].icono}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{s.detalle}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">{metros(s.metros)}</span>
                  </span>
                  {s.horario && <span className="block text-xs text-slate-500">{s.horario}</span>}
                  <span className="block text-[11px] text-slate-400">
                    {s.accesible ? "♿ Accesible · " : ""}
                    {s.fuente === "IM" ? "Intendencia" : "OpenStreetMap"}
                    {s.actualizado && ` · ${textoFecha(s, true)}`}
                  </span>
                  {s.viejo && <span className="block text-[11px] font-medium text-orange-700 dark:text-orange-400">{AVISO_VIEJO}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
