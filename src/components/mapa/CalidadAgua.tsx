"use client";

import { useState } from "react";
import type { CalidadAgua as Datos, Muestra, PuntoAgua } from "@/lib/calidad-agua";

// Mismos valores que en el servidor (Decreto 226/025); se repiten para no importar código server-only.
const LIMITE_MEDIA = 200;
const LIMITE_MUESTRA = 500;
const DIAS_VIGENCIA = 21; // ver DIAS_VIGENCIA en lib/calidad-agua.ts

const haceDias = (n: number) => (n <= 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`);

const fecha = (s: string) => {
  const [a, m, d] = s.slice(0, 10).split("-");
  return `${Number(d)}/${Number(m)}${a !== String(new Date().getFullYear()) ? `/${a.slice(2)}` : ""}`;
};

const ESTADO = {
  apta: { texto: "Dentro de los límites", clase: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  "no-apta": { texto: "Supera el límite", clase: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  "sin-datos": { texto: "Sin muestreo reciente", clase: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
} as const;

export default function CalidadAgua({ agua }: { agua: Datos | null }) {
  return (
    <section className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Calidad del agua</h3>

      {!agua ? (
        <p className="text-sm text-slate-500">La IM no tiene muestreos recientes de esta playa.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO[agua.estado].clase}`}>
              {ESTADO[agua.estado].texto}
            </span>
            {agua.ultimaFecha && (
              <span className="text-xs text-slate-500">
                Último análisis: {fecha(agua.ultimaFecha)}
                {agua.diasDesdeUltimo != null && ` (${haceDias(agua.diasDesdeUltimo)})`}
              </span>
            )}
          </div>
          {agua.estado === "sin-datos" && (
            <p className="text-xs text-slate-500">
              La IM no muestreó esta playa en los últimos {DIAS_VIGENCIA} días (lo hace cada 4 a 7 días), así que no
              podemos decir cómo está el agua hoy.
            </p>
          )}

          <Cianobacterias ciano={agua.ciano} />

          {agua.puntos.map((p) => (
            <Punto key={p.codigo} punto={p} varios={agua.puntos.length > 1} />
          ))}

          <p className="text-[11px] leading-relaxed text-slate-500">
            Criterio del Decreto 226/025: la media de las últimas 5 muestras no debe superar {LIMITE_MEDIA} enterococos/100 ml
            y ninguna muestra puede superar {LIMITE_MUESTRA}. La habilitación oficial la decide la IM (bandera sanitaria en la
            casilla). Fuente: monitoreo de playas de la IM, datos abiertos.
          </p>
        </div>
      )}
    </section>
  );
}

function Cianobacterias({ ciano }: { ciano: Datos["ciano"] }) {
  if (!ciano) return null;
  const info = {
    ausencia: { icono: "✓", tono: "text-emerald-700 dark:text-emerald-400", texto: "Sin cianobacterias visibles" },
    presencia: { icono: "!", tono: "text-orange-700 dark:text-orange-400", texto: "Floración incipiente de cianobacterias: evitá tragar agua" },
    espuma: { icono: "!", tono: "text-red-700 dark:text-red-400", texto: "Floración de cianobacterias (espuma): evitá el contacto con el agua" },
  }[ciano];
  return (
    <p className="flex items-start gap-1.5 text-sm">
      <span className={`font-bold ${info.tono}`} aria-hidden>
        {info.icono}
      </span>
      {info.texto}
    </p>
  );
}

function Punto({ punto, varios }: { punto: PuntoAgua; varios: boolean }) {
  const u = punto.ultima;
  const motivo =
    punto.estado !== "no-apta"
      ? null
      : u?.enterococos != null && u.enterococos > LIMITE_MUESTRA
        ? `Última muestra: ${u.enterococos} (máximo ${LIMITE_MUESTRA})`
        : `Media de 5 muestras: ${Math.round(punto.media!.valor)} (límite ${LIMITE_MEDIA})`;

  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      {varios && (
        <p className="mb-1 flex items-center justify-between text-sm font-medium">
          {punto.nombre}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTADO[punto.estado].clase}`}>
            {ESTADO[punto.estado].texto}
          </span>
        </p>
      )}
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-500">Media últimas 5</dt>
          <dd className="text-base font-semibold tabular-nums">
            {punto.media ? Math.round(punto.media.valor) : "—"}
            <span className="ml-1 text-[11px] font-normal text-slate-500">/ {LIMITE_MEDIA}</span>
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Última muestra</dt>
          <dd className="text-base font-semibold tabular-nums">
            {u?.enterococos ?? "—"}
            <span className="ml-1 text-[11px] font-normal text-slate-500">/ {LIMITE_MUESTRA}</span>
          </dd>
        </div>
      </dl>
      {motivo && <p className="mt-1 text-xs text-orange-700 dark:text-orange-400">{motivo}</p>}
      {punto.historial.length > 1 && <Grafico muestras={punto.historial} />}
    </div>
  );
}

// Enterococos por muestra con los dos límites del decreto como referencia.
function Grafico({ muestras }: { muestras: Muestra[] }) {
  const [activa, setActiva] = useState<number | null>(null);
  const W = 300, L = 4, R = 50, T = 8, H = 56, XB = 14;
  const vals = muestras.map((m) => m.enterococos ?? 0);
  const max = Math.max(LIMITE_MUESTRA * 1.15, ...vals);
  const y = (v: number) => T + H - (v / max) * H;
  const paso = (W - L - R) / muestras.length;
  const m = activa != null ? muestras[activa] : null;

  return (
    <div className="relative mt-2">
      <p className="mb-0.5 text-[10px] text-slate-500">Enterococos por muestra (UFC/100 ml)</p>
      <svg
        viewBox={`0 0 ${W} ${T + H + XB}`}
        className="w-full"
        role="img"
        aria-label="Enterococos en las últimas muestras"
        onPointerLeave={() => setActiva(null)}
      >
        {[LIMITE_MEDIA, LIMITE_MUESTRA].map((lim) => (
          <g key={lim}>
            <line x1={L} x2={W - R} y1={y(lim)} y2={y(lim)} strokeWidth={0.75} strokeDasharray="3 3" className="stroke-slate-400" />
            <text x={W - R + 4} y={y(lim) + 3} className="fill-slate-500 text-[9px]">
              {lim === LIMITE_MEDIA ? "200 media" : "500 máx."}
            </text>
          </g>
        ))}
        {muestras.map((mu, i) => {
          const v = mu.enterococos;
          const alto = v == null ? 0 : Math.max(1.5, (v / max) * H);
          const supera = v != null && v > LIMITE_MUESTRA;
          return (
            <g key={mu.fecha} onPointerEnter={() => setActiva(i)} onPointerDown={() => setActiva(i)}>
              <rect x={L + i * paso} y={T} width={paso} height={H} fill="transparent" />
              <rect
                x={L + i * paso + 1}
                y={T + H - alto}
                width={paso - 2}
                height={alto}
                rx={1.5}
                opacity={mu.representativa ? 1 : 0.45}
                className={supera ? "fill-orange-600 dark:fill-orange-500" : "fill-sky-400 dark:fill-sky-500"}
              />
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={T + H} y2={T + H} strokeWidth={0.5} className="stroke-slate-300 dark:stroke-slate-600" />
        <text x={L} y={T + H + XB - 2} className="fill-slate-400 text-[9px]">
          {fecha(muestras[0].fecha)}
        </text>
        <text x={W - R} y={T + H + XB - 2} textAnchor="end" className="fill-slate-400 text-[9px]">
          {fecha(muestras[muestras.length - 1].fecha)}
        </text>
      </svg>
      {m && activa != null && (
        <div
          className="pointer-events-none absolute top-3 z-10 rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-[11px] text-white shadow-lg dark:bg-white/95 dark:text-slate-900"
          style={
            activa > muestras.length / 2
              ? { right: `calc(${100 - ((L + activa * paso) / W) * 100}% + 6px)` }
              : { left: `calc(${((L + (activa + 1) * paso) / W) * 100}% + 6px)` }
          }
        >
          <p className="font-semibold">{fecha(m.fecha)}</p>
          <p>{m.enterococos ?? "—"} UFC/100 ml</p>
          {!m.representativa && <p>Con lluvia previa</p>}
          {m.ciano && m.ciano !== "ausencia" && <p>Cianobacterias: {m.ciano}</p>}
        </div>
      )}
    </div>
  );
}
