"use client";

import { useEffect, useState } from "react";
import type { Opcion, Punto, Tramo } from "@/lib/transporte/planificador";
import type { Llegada } from "@/lib/transporte/tiempo-real";

export type TramoBus = Extract<Tramo, { tipo: "omnibus" }>;
export type LlegadasPorTramo = Record<string, Llegada[]>; // "variante:parada" → llegadas

export const claveTramo = (t: TramoBus) => `${t.variante}:${t.subida.id}`;

const ACTUALIZAR_MS = 20_000;

type Estado =
  | { tipo: "inactivo" }
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "ok"; opciones: Opcion[] };

type Props = {
  destino: Punto;
  origen: Punto | null;
  eligiendoEnMapa: boolean;
  ubicando: boolean;
  errorUbicacion: string | null;
  onUsarUbicacion: () => void;
  onElegirEnMapa: () => void;
  onCambiarOrigen: () => void;
  onOpcion: (opcion: Opcion | null, llegadas: LlegadasPorTramo) => void;
};

export default function ComoIr({
  destino,
  origen,
  eligiendoEnMapa,
  ubicando,
  errorUbicacion,
  onUsarUbicacion,
  onElegirEnMapa,
  onCambiarOrigen,
  onOpcion,
}: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: "inactivo" });
  const [elegida, setElegida] = useState(0);
  const [llegadas, setLlegadas] = useState<LlegadasPorTramo>({});

  // Pedir opciones cuando hay origen y destino.
  useEffect(() => {
    if (!origen) return;
    const ctrl = new AbortController();
    const q = new URLSearchParams({
      desde: `${origen.lat.toFixed(6)},${origen.lon.toFixed(6)}`,
      hasta: `${destino.lat.toFixed(6)},${destino.lon.toFixed(6)}`,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carga de un fetch
    setEstado({ tipo: "cargando" });
    setElegida(0);
    setLlegadas({});
    fetch(`/api/como-ir?${q}`, { signal: ctrl.signal })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Error");
        setEstado({ tipo: "ok", opciones: json.opciones });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setEstado({ tipo: "error", mensaje: e.message });
      });
    return () => ctrl.abort();
  }, [origen, destino]);

  const opciones = estado.tipo === "ok" ? estado.opciones : [];
  const opcion = opciones[elegida] ?? null;
  const tramosBus = (opcion?.tramos.filter((t) => t.tipo === "omnibus") ?? []) as TramoBus[];
  const claves = tramosBus.map(claveTramo).join(",");

  // Tiempo real para los ómnibus de la opción elegida (solo con la pestaña visible).
  useEffect(() => {
    if (!claves) return;
    let vivo = true;
    const actualizar = () => {
      if (document.hidden) return;
      fetch(`/api/omnibus/llegadas?tramos=${claves}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!vivo || !json) return;
          const m: LlegadasPorTramo = {};
          for (const r of json.resultados) m[`${r.variante}:${r.parada}`] = r.llegadas;
          setLlegadas(m);
        })
        .catch(() => {});
    };
    actualizar();
    const id = window.setInterval(actualizar, ACTUALIZAR_MS);
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      vivo = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, [claves]);

  useEffect(() => {
    onOpcion(opcion, llegadas);
  }, [opcion, llegadas, onOpcion]);

  return (
    <section className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        Cómo llegar en ómnibus
      </h3>

      {!origen && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onUsarUbicacion}
              disabled={ubicando}
              className="flex-1 rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {ubicando ? "Ubicando…" : "Usar mi ubicación"}
            </button>
            <button
              onClick={onElegirEnMapa}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ring-1 ${
                eligiendoEnMapa
                  ? "bg-sky-50 text-sky-800 ring-sky-300 dark:bg-sky-950 dark:text-sky-200"
                  : "ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
              }`}
            >
              Elegir en el mapa
            </button>
          </div>
          {eligiendoEnMapa && <p className="text-xs text-sky-700 dark:text-sky-300">Tocá el mapa donde estás.</p>}
          {errorUbicacion && <p className="text-xs text-red-600">{errorUbicacion}</p>}
        </div>
      )}

      {origen && (
        <>
          <button onClick={onCambiarOrigen} className="mb-2 text-xs text-sky-700 underline dark:text-sky-300">
            Cambiar origen
          </button>

          {estado.tipo === "cargando" && (
            <p className="text-sm text-slate-500">Buscando recorridos… (la primera vez carga los horarios del STM)</p>
          )}
          {estado.tipo === "error" && <p className="text-sm text-red-600">{estado.mensaje}</p>}
          {estado.tipo === "ok" && opciones.length === 0 && (
            <p className="text-sm text-slate-500">
              No encontramos ómnibus en la próxima hora con paradas cerca de tu origen y de la playa.
            </p>
          )}

          <ul className="space-y-2">
            {opciones.map((o, i) => (
              <li key={i}>
                <button
                  onClick={() => setElegida(i)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left ring-1 ${
                    i === elegida
                      ? "bg-sky-50 ring-sky-300 dark:bg-slate-800 dark:ring-sky-700"
                      : "ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Resumen tramos={o.tramos} />
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-semibold tabular-nums leading-tight">{o.minutos} min</span>
                      <span className="block text-[11px] text-slate-500">llegás {o.llega}</span>
                    </span>
                  </div>
                </button>
                {i === elegida && <Pasos tramos={o.tramos} llegadas={llegadas} />}
              </li>
            ))}
          </ul>
          {estado.tipo === "ok" && opciones.length > 0 && (
            <p className="mt-2 text-[11px] text-slate-500">
              Horarios del STM (GTFS de la IM). &quot;En vivo&quot; estima la llegada según la posición GPS de cada ómnibus.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Linea({ n }: { n: string }) {
  return (
    <span className="inline-flex min-w-9 justify-center rounded-md bg-sky-700 px-1.5 py-0.5 text-xs font-bold text-white">
      {n}
    </span>
  );
}

function Resumen({ tramos }: { tramos: Tramo[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
      {tramos.map((t, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-slate-400">›</span>}
          {t.tipo === "caminar" ? <span>🚶 {t.minutos}′</span> : <Linea n={t.linea} />}
        </span>
      ))}
    </span>
  );
}

function Pasos({ tramos, llegadas }: { tramos: Tramo[]; llegadas: LlegadasPorTramo }) {
  return (
    <ol className="mt-2 space-y-3 border-l-2 border-sky-200 pl-4 text-sm dark:border-sky-900">
      {tramos.map((t, i) => {
        if (t.tipo === "caminar") {
          const destino = i === tramos.length - 1 ? "la playa" : `la parada ${(tramos[i + 1] as TramoBus).subida.nombre}`;
          return (
            <li key={i}>
              Caminá {t.metros} m ({t.minutos} min) hasta {destino}.
            </li>
          );
        }
        const vivo = llegadas[claveTramo(t)];
        return (
          <li key={i} className="space-y-1">
            <p className="flex items-center gap-2">
              <Linea n={t.linea} /> <span className="text-slate-600 dark:text-slate-300">hacia {t.destino}</span>
            </p>
            <p>
              Subí en <strong>{t.subida.nombre}</strong> (parada {t.subida.id}).
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Pasa {t.sale}
              {t.siguientes.length > 0 && <> · después {t.siguientes.join(", ")}</>}
            </p>
            {vivo === undefined ? null : vivo.length > 0 ? (
              <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                En vivo: {vivo.map((l) => (l.minutos === 0 ? "llegando" : `${l.minutos} min`)).join(" · ")}
                {vivo[0].accesible && <span title="Piso bajo">♿</span>}
                {vivo[0].aire && <span title="Aire acondicionado">❄️</span>}
              </p>
            ) : (
              <p className="text-xs text-slate-500">Sin ómnibus en vivo antes de tu parada.</p>
            )}
            <p className="text-slate-600 dark:text-slate-400">
              {t.paradas} paradas · {t.minutos} min. Bajate en <strong>{t.bajada.nombre}</strong>.
            </p>
          </li>
        );
      })}
    </ol>
  );
}
