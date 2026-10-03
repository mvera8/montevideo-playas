"use client";

import { useEffect, useMemo, useState } from "react";
import type { Playa, Temporada } from "@/lib/playas";
import { recomendar, type Viaje } from "@/lib/recomendacion";
import type { Punto } from "@/lib/transporte/planificador";
import { BadgeCalidad, Motivos } from "./Motivos";

type Props = {
  playas: Playa[];
  temporada: Temporada;
  origen: Punto | null;
  ubicando: boolean;
  onUsarUbicacion: () => void;
  onElegir: (p: Playa) => void;
};

// "¿A qué playa voy?": ranking con bandera, viento según la orientación de cada playa,
// confort y, si sabemos dónde estás, cuánto tardás en ómnibus.
export default function Recomendador({ playas, temporada, origen, ubicando, onUsarUbicacion, onElegir }: Props) {
  const [info, setInfo] = useState(false);
  const [viajes, setViajes] = useState<{ para: Punto; datos: Record<string, Viaje> } | null>(null);

  useEffect(() => {
    if (!origen) return;
    const ctrl = new AbortController();
    fetch(`/api/viajes?desde=${origen.lat.toFixed(6)},${origen.lon.toFixed(6)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => json && setViajes({ para: origen, datos: json.viajes }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [origen]);

  // Solo usamos viajes calculados para el origen actual.
  const datosViaje = viajes && viajes.para === origen ? viajes.datos : null;
  const calculando = Boolean(origen) && !datosViaje;
  const ranking = useMemo(() => recomendar(playas, temporada, datosViaje), [playas, temporada, datosViaje]);
  const porSlug = useMemo(() => new Map(playas.map((p) => [p.slug, p])), [playas]);

  const [primera, ...resto] = ranking;
  if (!primera) return null;
  const playa = porSlug.get(primera.slug)!;
  // Si ni la mejor llega a "Aceptable", no tiene sentido destacar una playa:
  // decimos que no es momento y mostramos el ranking como secundario.
  const malMomento = primera.puntaje < 40;
  const generales = primera.motivos.filter((m) => m.general);
  const lista = malMomento ? ranking.slice(0, 3) : resto.slice(0, 3);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          ¿A qué playa voy?
          <button
            onClick={() => setInfo((v) => !v)}
            aria-expanded={info}
            aria-label="Cómo se calcula el puntaje"
            className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ring-1 ${
              info
                ? "bg-sky-600 text-white ring-sky-600"
                : "text-slate-500 ring-slate-300 hover:bg-slate-100 dark:ring-slate-600 dark:hover:bg-slate-800"
            }`}
          >
            i
          </button>
        </h2>
        <span className="text-[11px] text-slate-500">Ahora</span>
      </div>

      {info && (
        <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <p>
            Cada playa tiene un <strong>puntaje de 0 a 100</strong> según la bandera vigente, el viento (si le pega de
            frente o queda reparada, según hacia dónde mira la playa), la sensación térmica, la lluvia y las olas. Si
            sumás tu ubicación, también cuenta cuánto tardás en llegar.
          </p>
          <p className="mt-1.5">
            De noche el máximo es 30. <strong>75+</strong> Ideal · <strong>55+</strong> Buena · <strong>40+</strong>{" "}
            Aceptable · menos, No recomendable.
          </p>
        </div>
      )}

      {malMomento ? (
        <div className="mt-2">
          <p className="text-xl font-semibold tracking-tight">Ahora no es momento de playa</p>
          {generales.length > 0 && (
            <div className="mt-2">
              <Motivos motivos={generales} />
            </div>
          )}
        </div>
      ) : (
        <>
          <button onClick={() => onElegir(playa)} className="group mt-2 block w-full text-left">
            <span className="flex items-center justify-between gap-2">
              <span className="text-2xl font-semibold tracking-tight group-hover:text-sky-700 dark:group-hover:text-sky-300">
                {playa.nombre}
              </span>
              <BadgeCalidad calidad={primera.calidad} puntaje={primera.puntaje} />
            </span>
          </button>
          <div className="mt-2">
            <Motivos motivos={primera.motivos} />
          </div>
        </>
      )}

      <div className="mt-3 flex gap-2">
        {!malMomento && (
          <button
            onClick={() => onElegir(playa)}
            className="flex-1 rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Ver playa
          </button>
        )}
        {!origen && (
          <button
            onClick={onUsarUbicacion}
            disabled={ubicando}
            className="flex-1 rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60 dark:ring-slate-700 dark:hover:bg-slate-800"
          >
            {ubicando ? "Ubicando…" : "Sumar mi viaje"}
          </button>
        )}
      </div>
      {calculando && <p className="mt-2 text-xs text-slate-500">Calculando cuánto tardás a cada playa…</p>}

      {lista.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="mb-1 flex justify-between px-1.5 text-[11px] text-slate-500">
            <span>{malMomento ? "Si igual querés ir" : "También"}</span>
            <span>puntaje</span>
          </p>
          <ol className="space-y-1">
            {lista.map((r, i) => {
              const p = porSlug.get(r.slug)!;
              return (
                <li key={r.slug}>
                  <button
                    onClick={() => onElegir(p)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-4 text-xs text-slate-400 tabular-nums">{malMomento ? i + 1 : i + 2}</span>
                      <span className="truncate">{p.nombre}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      {r.viaje && <span className="tabular-nums">{r.viaje.minutos} min</span>}
                      <span className="tabular-nums">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{r.puntaje}</span>/100
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
