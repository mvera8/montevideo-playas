"use client";

import { useEffect, useRef, useState } from "react";
import { mm, puntoCardinal, type Franja, type Hora } from "@/lib/recomendacion";
import { BadgeCalidad, Motivos } from "./Motivos";
import SeccionPlegable from "./SeccionPlegable";

type Datos = { ahora: string; horas: Hora[]; luz: [string, string][]; mejor: Franja | null };

const HORAS = 24;
// Geometría del gráfico (unidades del viewBox; se escala al ancho del panel).
const W = 340;
const L = 26; // etiquetas del eje Y
const R = 6;
const T1 = 16; // arriba del gráfico de temperatura (deja lugar a la etiqueta de máximo)
const H1 = 84;
const GAP = 22; // entre gráficos (título del segundo)
const H2 = 34;
const XB = 16; // banda del eje X
const ALTO = T1 + H1 + GAP + H2 + XB;
const Y2 = T1 + H1 + GAP;

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const horaNum = (iso: string) => Number(iso.slice(11, 13));
const etiquetaHora = (iso: string) => `${horaNum(iso)} h`;

export default function Pronostico({ slug }: { slug: string }) {
  const [datos, setDatos] = useState<{ slug: string; d: Datos | null } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/pronostico/${slug}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDatos({ slug, d }))
      .catch((e) => e.name !== "AbortError" && setDatos({ slug, d: null }));
    return () => ctrl.abort();
  }, [slug]);

  const d = datos?.slug === slug ? datos.d : undefined;

  return (
    <SeccionPlegable titulo="Mejor horario" resumen={resumenFranja(d)} resumenSoloCerrada>
      {d === undefined && <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-oscuro-3" />}
      {d === null && <p className="text-sm text-slate-500">No pudimos cargar el pronóstico.</p>}
      {d && (
        <>
          <MejorFranja mejor={d.mejor} ahora={d.ahora} />
          <Grafico datos={d} />
        </>
      )}
    </SeccionPlegable>
  );
}

const diaFranja = (mejor: Franja, ahora: string) => (mejor.desde.slice(0, 10) === ahora.slice(0, 10) ? "Hoy" : "Mañana");

function resumenFranja(d: Datos | null | undefined) {
  if (d === undefined) return "Cargando…";
  if (d === null) return "Sin pronóstico";
  if (!d.mejor) return "Sin horas de sol";
  return `${diaFranja(d.mejor, d.ahora)}, ${horaNum(d.mejor.desde)} a ${horaNum(d.mejor.hasta)} h · ${d.mejor.calidad}`;
}

function MejorFranja({ mejor, ahora }: { mejor: Franja | null; ahora: string }) {
  if (!mejor) return <p className="text-sm text-slate-500">No quedan horas de sol en el pronóstico.</p>;
  const dia = diaFranja(mejor, ahora);
  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-semibold">
          {dia}, {horaNum(mejor.desde)} a {horaNum(mejor.hasta)} h
        </p>
        <BadgeCalidad calidad={mejor.calidad} />
      </div>
      {mejor.calidad === "No recomendable" && (
        <p className="text-xs text-slate-500">Es el mejor momento del pronóstico, pero no es día de playa.</p>
      )}
      <Motivos motivos={mejor.motivos} />
    </div>
  );
}

function Grafico({ datos }: { datos: Datos }) {
  const horas = datos.horas.slice(0, HORAS);
  const ref = useRef<SVGSVGElement>(null);
  const [activo, setActivo] = useState<number | null>(null);
  if (horas.length < 2) return null;

  const n = horas.length;
  const paso = (W - L - R) / n;
  const x = (i: number) => L + (i + 0.5) * paso;

  // Sensación térmica: dominio con margen y 3 marcas redondas.
  const vals = horas.map((h) => h.sensacion);
  const min = Math.floor(Math.min(...vals)) - 1;
  const max = Math.ceil(Math.max(...vals)) + 1;
  const y1 = (v: number) => T1 + H1 - ((v - min) / (max - min)) * H1;
  const marcas = [min, Math.round((min + max) / 2), max];
  const linea = horas.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y1(h.sensacion).toFixed(1)}`).join("");
  const iMax = vals.indexOf(Math.max(...vals));
  const iMin = vals.indexOf(Math.min(...vals));
  // Escala de lluvia: hasta 2 mm/h fija, para que una llovizna no parezca un diluvio.
  const topeLluvia = Math.max(2, Math.ceil(Math.max(...horas.map((h) => h.lluvia))));

  const deNoche = (iso: string) => !datos.luz.some(([sale, pone]) => iso >= sale.slice(0, 13) && iso < pone.slice(0, 13));
  const enMejor = (iso: string) => datos.mejor != null && iso >= datos.mejor.desde && iso < datos.mejor.hasta;

  // Corridas contiguas (noche / mejor franja) → un rect por corrida.
  const corridas = (pred: (iso: string) => boolean) => {
    const out: [number, number][] = [];
    horas.forEach((h, i) => {
      if (!pred(h.hora)) return;
      const ult = out[out.length - 1];
      if (ult && ult[1] === i - 1) ult[1] = i;
      else out.push([i, i]);
    });
    return out;
  };

  const mover = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    setActivo(Math.max(0, Math.min(n - 1, Math.floor((vx - L) / paso))));
  };

  const h = activo != null ? horas[activo] : null;

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${ALTO}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="Sensación térmica y lluvia por hora"
        onPointerMove={mover}
        onPointerDown={mover}
        onPointerLeave={() => setActivo(null)}
      >
        {/* Noche y mejor franja, detrás de todo y en ambos gráficos */}
        {corridas(deNoche).map(([a, b]) => (
          <rect key={`n${a}`} x={L + a * paso} y={T1} width={(b - a + 1) * paso} height={Y2 + H2 - T1} className="fill-slate-500/[0.07] dark:fill-neutral-400/[0.08]" />
        ))}
        {corridas(enMejor).map(([a, b]) => (
          <g key={`m${a}`}>
            <rect x={L + a * paso} y={T1} width={(b - a + 1) * paso} height={Y2 + H2 - T1} className="fill-emerald-500/[0.12]" />
            <text x={L + ((a + b + 1) / 2) * paso} y={T1 - 5} textAnchor="middle" className="fill-emerald-700 text-[10px] font-semibold dark:fill-emerald-400">
              Mejor
            </text>
          </g>
        ))}

        {/* Sensación térmica */}
        <text x={0} y={9} className="fill-slate-500 text-[10px]">
          Sensación térmica (°C)
        </text>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={L} x2={W - R} y1={y1(m)} y2={y1(m)} className="stroke-slate-200 dark:stroke-neutral-700" strokeWidth={0.5} />
            <text x={L - 4} y={y1(m) + 3} textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">
              {m}
            </text>
          </g>
        ))}
        <path d={linea} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-sky-700 dark:stroke-sky-300" />
        {[iMax, iMin].map((i, k) => (
          <text
            key={k}
            x={x(i)}
            y={k === 0 ? y1(vals[i]) - 6 : y1(vals[i]) + 12}
            textAnchor="middle"
            className="fill-slate-700 text-xs font-semibold tabular-nums dark:fill-neutral-200"
          >
            {Math.round(vals[i])}°
          </text>
        ))}

        {/* Lluvia */}
        <text x={0} y={Y2 - 8} className="fill-slate-500 text-[10px]">
          Lluvia (mm)
        </text>
        <line x1={L} x2={W - R} y1={Y2 + H2} y2={Y2 + H2} className="stroke-slate-200 dark:stroke-neutral-700" strokeWidth={0.5} />
        <text x={L - 4} y={Y2 + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
          {topeLluvia}
        </text>
        {horas.map((hh, i) =>
          hh.lluvia >= 0.05 ? (
            <rect
              key={hh.hora}
              x={L + i * paso + 1}
              y={Y2 + H2 - (hh.lluvia / topeLluvia) * H2}
              width={paso - 2}
              height={(hh.lluvia / topeLluvia) * H2}
              rx={1.5}
              className="fill-sky-400 dark:fill-sky-500"
            />
          ) : null,
        )}

        {/* Eje X: cada 3 horas; a medianoche, el día */}
        {horas.map((hh, i) =>
          horaNum(hh.hora) % 3 === 0 ? (
            <text key={hh.hora} x={x(i)} y={ALTO - 3} textAnchor="middle" className="fill-slate-400 text-[10px]">
              {horaNum(hh.hora) === 0 ? DIAS[new Date(`${hh.hora.slice(0, 10)}T12:00`).getDay()] : etiquetaHora(hh.hora)}
            </text>
          ) : null,
        )}

        {/* Crosshair */}
        {activo != null && (
          <g pointerEvents="none">
            <line x1={x(activo)} x2={x(activo)} y1={T1} y2={Y2 + H2} className="stroke-slate-400" strokeWidth={0.75} />
            <circle cx={x(activo)} cy={y1(vals[activo])} r={4} strokeWidth={2} className="fill-sky-700 stroke-white dark:fill-sky-300 dark:stroke-neutral-900" />
          </g>
        )}
      </svg>

      {h && activo != null && (
        <div
          className="pointer-events-none absolute top-6 z-10 w-40 rounded-xl bg-slate-900/95 px-3 py-2 text-xs text-white shadow-lg dark:bg-white/95 dark:text-neutral-900"
          // Del lado opuesto a la línea, para no tapar el punto que se está mirando.
          style={
            x(activo) > W / 2
              ? { right: `calc(${100 - (x(activo) / W) * 100}% + 10px)` }
              : { left: `calc(${(x(activo) / W) * 100}% + 10px)` }
          }
        >
          <p className="font-semibold">{etiquetaHora(h.hora)}</p>
          <p>
            {Math.round(h.temp)}° · sensación {Math.round(h.sensacion)}°
          </p>
          <p>Lluvia {mm(h.lluvia)} mm · UV {Math.round(h.uv)}</p>
          <p>
            Viento {Math.round(h.viento)} km/h del {puntoCardinal(h.vientoDesde)}
          </p>
          {h.olas != null && <p>Olas {h.olas.toFixed(1)} m</p>}
        </div>
      )}

      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-slate-500">Ver tabla</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-slate-500">
            <tr>
              <th className="font-normal">Hora</th>
              <th className="font-normal">ST</th>
              <th className="font-normal">Lluvia (mm)</th>
              <th className="font-normal">UV</th>
              <th className="font-normal">Viento</th>
            </tr>
          </thead>
          <tbody>
            {horas.map((hh) => (
              <tr key={hh.hora} className={enMejor(hh.hora) ? "font-semibold" : ""}>
                <td>{etiquetaHora(hh.hora)}</td>
                <td>{Math.round(hh.sensacion)}°</td>
                <td>{mm(hh.lluvia)}</td>
                <td>{Math.round(hh.uv)}</td>
                <td>
                  {Math.round(hh.viento)} {puntoCardinal(hh.vientoDesde)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
