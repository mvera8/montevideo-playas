"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Playa, Temporada } from "@/lib/playas";
import { recomendar, type Viaje } from "@/lib/recomendacion";
import type { Punto } from "@/lib/transporte/planificador";
import { postJson, redondear } from "@/lib/ubicacion";
import Modal from "@/components/Modal";
import BotonUbicacion, { Ocupado } from "./BotonUbicacion";
import { BotonInfo, TarjetaInfo } from "./Info";
import { BadgeCalidad, Motivos } from "./Motivos";

type Props = {
  playas: Playa[];
  temporada: Temporada;
  /** UV medido por la IM (`clima.uvIm`), si está vigente. */
  uvMedido: number | null;
  origen: Punto | null;
  ubicando: boolean;
  onUsarUbicacion: () => void;
  onElegir: (p: Playa) => void;
};

type Viajes = { para: Punto; datos: Record<string, Viaje> };
type Falla = { para: Punto; tipo: "fuera" | "error" };

// El panel se desmonta al abrir una playa: guardamos el último cálculo fuera del componente para no
// volver a pedir /api/viajes (el pedido más caro) al cerrar la playa con el mismo origen. Los horarios
// de ómnibus cambian, así que pasado un rato se recalcula.
const VIGENCIA_VIAJES_MS = 10 * 60_000;
let ultimo: { viajes: Viajes | null; falla: Falla | null; en: number } | null = null;
const vigente = () => (ultimo && Date.now() - ultimo.en < VIGENCIA_VIAJES_MS ? ultimo : null);

// "¿A qué playa voy?": ranking con bandera, viento según la orientación de cada playa,
// confort y, si sabemos dónde estás, cuánto tardás en ómnibus.
export default function Recomendador({ playas, temporada, uvMedido, origen, ubicando, onUsarUbicacion, onElegir }: Props) {
  const [info, setInfo] = useState(false);
  const [viajes, setViajes] = useState<Viajes | null>(() => vigente()?.viajes ?? null);
  // Si no se pudo calcular: fuera de Montevideo (400) o falla del servidor/red. Se muestra en un modal.
  const [falla, setFalla] = useState<Falla | null>(() => vigente()?.falla ?? null);
  const [verFalla, setVerFalla] = useState(false);

  useEffect(() => {
    if (!origen) return;
    const previo = vigente();
    if (previo && (previo.viajes?.para === origen || previo.falla?.para === origen)) return;
    const ctrl = new AbortController();
    const fallar = (tipo: "fuera" | "error") => {
      const f = { para: origen, tipo };
      ultimo = { viajes: null, falla: f, en: Date.now() };
      setFalla(f);
      setVerFalla(true);
    };
    postJson("/api/viajes", { desde: redondear(origen) }, ctrl.signal)
      .then(async (r) => {
        if (!r.ok) return fallar(r.status === 400 ? "fuera" : "error");
        const v = { para: origen, datos: (await r.json()).viajes };
        ultimo = { viajes: v, falla: null, en: Date.now() };
        setViajes(v);
      })
      .catch((e) => e.name !== "AbortError" && fallar("error"));
    return () => ctrl.abort();
  }, [origen]);

  // Solo usamos viajes (o fallas) del origen actual.
  const datosViaje = viajes && viajes.para === origen ? viajes.datos : null;
  const fallaActual = falla && falla.para === origen ? falla.tipo : null;
  const calculando = Boolean(origen) && !datosViaje && !fallaActual;
  const ranking = useMemo(() => recomendar(playas, temporada, datosViaje, uvMedido), [playas, temporada, datosViaje, uvMedido]);
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
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-oscuro-1 dark:ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          ¿A qué playa voy?
          <BotonInfo abierto={info} onClick={() => setInfo((v) => !v)} etiqueta="Cómo se calcula el puntaje" />
        </h2>
        <span className="text-xs text-slate-500">Ahora</span>
      </div>

      {info && (
        <TarjetaInfo>
          <p>
            Cada playa tiene un <strong>puntaje de 0 a 100</strong> según la bandera vigente, el viento (si le pega de
            frente o queda reparada, según hacia dónde mira la playa), la sensación térmica, la lluvia y las olas. Si
            sumás tu ubicación, también cuenta cuánto tardás en llegar.
          </p>
          <p className="mt-2">
            De noche el máximo es 30. <strong>75+</strong> Ideal · <strong>55+</strong> Buena · <strong>40+</strong>{" "}
            Aceptable · menos, No recomendable.
          </p>
        </TarjetaInfo>
      )}

      {calculando ? (
        <EsqueletoRecomendador />
      ) : (
        <>
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
                className="flex-1 rounded-xl bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800"
              >
                Ver playa
              </button>
            )}
            {!origen && (
              <BotonUbicacion texto="Sumar mi viaje" ubicando={ubicando} onClick={onUsarUbicacion} />
            )}
          </div>
          {!origen && (
            <p className="mt-2 text-xs text-slate-500">
              Tu ubicación se usa solo para calcular el viaje y no se guarda.{" "}
              <Link href="/privacidad#ubicacion" className="underline">
                Privacidad
              </Link>
            </p>
          )}
          {fallaActual && (
            <p className="mt-2 text-xs text-slate-500">
              {fallaActual === "fuera" ? "Estás fuera de Montevideo: el ranking no suma el viaje." : "No pudimos sumar el viaje."}
            </p>
          )}
        </>
      )}

      <Modal
        abierto={verFalla && Boolean(fallaActual)}
        onCerrar={() => setVerFalla(false)}
        titulo={fallaActual === "fuera" ? "Estás fuera de Montevideo" : "No pudimos calcular el viaje"}
      >
        {fallaActual === "fuera" ? (
          <p>
            El viaje en ómnibus solo se calcula desde dentro de Montevideo. El ranking sigue funcionando con la bandera, el
            clima y el viento.
          </p>
        ) : (
          <p>Hubo un problema al consultar los horarios de ómnibus. Probá de nuevo en un rato; el ranking sigue funcionando.</p>
        )}
      </Modal>

      {!calculando && lista.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-neutral-800">
          <p className="mb-1 flex justify-between px-2 text-xs text-slate-500">
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
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-slate-50 dark:hover:bg-oscuro-3"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-4 text-xs text-slate-400 tabular-nums">{malMomento ? i + 1 : i + 2}</span>
                      <span className="truncate">{p.nombre}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      {r.viaje && <span className="tabular-nums">{r.viaje.minutos} min</span>}
                      <span className="tabular-nums">
                        <span className="font-semibold text-slate-700 dark:text-neutral-200">{r.puntaje}</span>/100
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

// Mientras se calcula el viaje a cada playa el ranking puede cambiar entero: en vez de mostrar una
// playa que quizás deja de ser la primera, el aviso de carga y un esqueleto de la lista.
function EsqueletoRecomendador() {
  const tono = "animate-pulse bg-slate-100 motion-reduce:animate-none dark:bg-oscuro-3";
  return (
    <div role="status" className="mt-2">
      <p className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
        <Ocupado className="h-3.5 w-3.5" />
        Calculando playa…
      </p>
      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-neutral-800">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-6 rounded-lg ${tono}`} />
        ))}
      </div>
    </div>
  );
}
