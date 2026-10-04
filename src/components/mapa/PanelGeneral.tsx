"use client";

import Link from "next/link";
import { SITIO } from "@/lib/sitio";
import type { Guardavidas, Playa, Temporada } from "@/lib/playas";
import type { Punto } from "@/lib/transporte/planificador";
import type { Weather } from "@/lib/weather";
import ClimaAhora from "./ClimaAhora";
import { ContadorMeGusta } from "./MeGusta";
import Recomendador from "./Recomendador";

export type EstadoBandera = NonNullable<Guardavidas["bandera"]> | "sin-datos";

export const ESTADOS: Record<EstadoBandera, { label: string; color: string; texto: string }> = {
  green: { label: "Verde", color: "#1f9d4c", texto: "Apto para bañarse" },
  yellow: { label: "Amarilla", color: "#f5c518", texto: "Precaución" },
  red: { label: "Roja", color: "#d62828", texto: "No bañarse" },
  black: { label: "Negra", color: "#1b1b1b", texto: "Sin guardavidas" },
  "sin-datos": { label: "Sin datos", color: "#c9ced4", texto: "Sin bandera vigente" },
};

// Si una playa tiene casillas con distintas banderas, manda la más restrictiva.
const SEVERIDAD: EstadoBandera[] = ["red", "black", "yellow", "green"];

export function estadoPlaya(p: Playa): EstadoBandera {
  const banderas = new Set(p.guardavidas.map((g) => g.bandera));
  return SEVERIDAD.find((b) => banderas.has(b as Guardavidas["bandera"])) ?? "sin-datos";
}

const grados = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}°`);

const fechaFmt = new Intl.DateTimeFormat("es-UY", {
  day: "numeric",
  month: "long",
  timeZone: "America/Montevideo",
});

type Props = {
  playas: Playa[]; // ya filtradas por búsqueda y bandera
  todas: Playa[];
  temporada: Temporada;
  fuente: "im" | "respaldo";
  error: string | null;
  climaCiudad: Weather | null;
  busqueda: string;
  filtro: EstadoBandera | null;
  onFiltro: (f: EstadoBandera | null) => void;
  onElegir: (p: Playa) => void;
  origen: Punto | null;
  ubicando: boolean;
  onUsarUbicacion: () => void;
};

export default function PanelGeneral({
  playas,
  todas,
  temporada,
  fuente,
  error,
  climaCiudad,
  busqueda,
  filtro,
  onFiltro,
  onElegir,
  origen,
  ubicando,
  onUsarUbicacion,
}: Props) {
  return (
    <div className="space-y-3">
      {climaCiudad && <ClimaAhora clima={climaCiudad} ciudad={SITIO.alcance} />}
      {!temporada.activa && <FueraDeTemporada temporada={temporada} />}
      {fuente === "respaldo" && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800">
          <strong>Sin datos de la Intendencia.</strong> Se muestran playas de respaldo.
          {error && <span className="mt-1 block text-xs opacity-80">{error}</span>}
        </div>
      )}
      <Recomendador
        playas={todas}
        temporada={temporada}
        origen={origen}
        ubicando={ubicando}
        onUsarUbicacion={onUsarUbicacion}
        onElegir={onElegir}
      />
      {/* Fuera de temporada no hay banderas: el resumen vuelve el 15/11. */}
      {temporada.activa && <ResumenBanderas playas={todas} filtro={filtro} onFiltro={onFiltro} />}

      <div className="flex items-center justify-between px-1 pt-1">
        <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Playas <span className="tabular-nums">({playas.length})</span>
        </h2>
        {filtro && (
          <button
            onClick={() => onFiltro(null)}
            className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: ESTADOS[filtro].color }} />
            {ESTADOS[filtro].label} ✕
          </button>
        )}
      </div>

      {playas.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10">
          {busqueda ? `Ninguna playa coincide con “${busqueda}”.` : "Ninguna playa con esa bandera."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5">
          {playas.map((p) => (
            <li key={p.slug}>
              <TarjetaPlaya playa={p} temporadaActiva={temporada.activa} onClick={() => onElegir(p)} />
            </li>
          ))}
        </ul>
      )}

      <footer className="px-1 pb-2 pt-1 text-[11px] leading-relaxed text-slate-500">
        Información orientativa: {SITIO.nombre} no es un sitio oficial. En la playa, seguí siempre a los guardavidas.{" "}
        <Link href="/terminos" className="underline">
          Términos y fuentes
        </Link>{" "}
        ·{" "}
        <Link href="/privacidad" className="underline">
          Privacidad
        </Link>
      </footer>
    </div>
  );
}

function FueraDeTemporada({ temporada }: { temporada: Temporada }) {
  return (
    <div className="rounded-2xl bg-red-600 p-4 text-white shadow-sm dark:bg-red-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden>
            <path d="M12 2 1 21h22L12 2Zm0 6 .01 0c.55 0 1 .45 1 1v5a1 1 0 1 1-2 0V9c0-.55.45-1 1-1Zm0 10.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
          </svg>
          <p className="font-semibold">Fuera de temporada</p>
        </div>
        <p className="text-right leading-none">
          <span className="text-3xl font-semibold tabular-nums">{temporada.diasParaInicio}</span>
          <span className="ml-1 text-xs text-red-100">días</span>
        </p>
      </div>
      <p className="mt-2 text-sm text-red-50">
        Las playas no tienen guardavidas. El servicio comienza el {fechaFmt.format(new Date(temporada.inicio))}, de 8 a
        20 h.
      </p>
    </div>
  );
}

function ResumenBanderas({
  playas,
  filtro,
  onFiltro,
}: {
  playas: Playa[];
  filtro: EstadoBandera | null;
  onFiltro: (f: EstadoBandera | null) => void;
}) {
  const conteo = Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, 0])) as Record<EstadoBandera, number>;
  for (const p of playas) conteo[estadoPlaya(p)]++;
  const casillas = playas.reduce((t, p) => t + p.guardavidas.length, 0);
  const orden: EstadoBandera[] = ["green", "yellow", "red", "black", "sin-datos"];

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Banderas ahora</h2>
        <p className="text-xs text-slate-500 tabular-nums">
          {playas.length} playas · {casillas} casillas
        </p>
      </div>

      {/* Barra proporcional */}
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {orden.map((e) =>
          conteo[e] ? (
            <span key={e} style={{ width: `${(conteo[e] / playas.length) * 100}%`, background: ESTADOS[e].color }} />
          ) : null,
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {orden.slice(0, 4).map((e) => (
          <BotonEstado key={e} estado={e} n={conteo[e]} activo={filtro === e} onClick={() => onFiltro(filtro === e ? null : e)} />
        ))}
      </div>
      {conteo["sin-datos"] > 0 && (
        <button
          onClick={() => onFiltro(filtro === "sin-datos" ? null : "sin-datos")}
          className={`mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm ring-1 transition ${
            filtro === "sin-datos"
              ? "bg-slate-100 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600"
              : "ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
          }`}
        >
          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ESTADOS["sin-datos"].color }} />
            Sin bandera vigente
          </span>
          <span className="font-semibold tabular-nums">{conteo["sin-datos"]}</span>
        </button>
      )}
    </section>
  );
}

function BotonEstado({ estado, n, activo, onClick }: { estado: EstadoBandera; n: number; activo: boolean; onClick: () => void }) {
  const e = ESTADOS[estado];
  return (
    <button
      onClick={onClick}
      disabled={n === 0}
      title={e.texto}
      className={`rounded-xl px-2 py-2 text-left ring-1 transition disabled:opacity-40 ${
        activo
          ? "bg-slate-100 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600"
          : "ring-slate-200 enabled:hover:bg-slate-50 dark:ring-slate-700 dark:enabled:hover:bg-slate-800"
      }`}
    >
      <span className="block h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/20" style={{ background: e.color }} />
      <span className="mt-1.5 block text-xl font-semibold leading-none tabular-nums">{n}</span>
      <span className="mt-1 block text-[11px] text-slate-500">{e.label}</span>
    </button>
  );
}

const AGUA = {
  apta: { label: "Agua ok", color: "#1f9d4c", titulo: "Agua dentro de los límites (último análisis de la IM)" },
  "no-apta": { label: "Agua ✗", color: "#ea580c", titulo: "El agua supera el límite del Decreto 226/025" },
  "sin-datos": { label: "Sin análisis", color: "#c9ced4", titulo: "Sin muestreo reciente de la IM" },
} as const;

function TarjetaPlaya({ playa, temporadaActiva, onClick }: { playa: Playa; temporadaActiva: boolean; onClick: () => void }) {
  const estado = estadoPlaya(playa);
  const agua = playa.agua?.estado ?? "sin-datos";
  const c = playa.clima;
  const n = playa.guardavidas.length;
  return (
    <button
      onClick={onClick}
      className="group flex h-full w-full flex-col rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 dark:ring-white/10"
    >
      <div className="flex w-full items-start justify-between gap-1">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{playa.nombre}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {n} {n === 1 ? "casilla" : "casillas"}
            <ContadorMeGusta slug={playa.slug} inicial={playa.meGusta} />
          </span>
        </span>
        <span className="text-slate-400 transition group-hover:text-sky-600" aria-hidden>
          ↗
        </span>
      </div>

      <IconoCasilla color={ESTADOS[estado].color} />

      <div className="mt-auto flex w-full items-end justify-between">
        <span>
          <span className="block text-lg font-semibold leading-none tabular-nums">{grados(c?.airTemp)}</span>
          <span className="block text-[11px] text-slate-500">agua {grados(playa.agua?.temperatura?.valor ?? c?.waterTemp)}</span>
        </span>
        {/* Fuera de temporada no hay banderas: mostramos la calidad del agua. */}
        {temporadaActiva ? (
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ESTADOS[estado].color }} />
            {ESTADOS[estado].label}
            <GotaAgua estado={agua} />
          </span>
        ) : (
          <span
            title={AGUA[agua].titulo}
            className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <GotaAgua estado={agua} />
            {AGUA[agua].label}
          </span>
        )}
      </div>
    </button>
  );
}

function GotaAgua({ estado }: { estado: keyof typeof AGUA }) {
  return (
    <svg viewBox="0 0 10 12" className="h-2.5 w-2" aria-label={AGUA[estado].titulo} role="img">
      <path d="M5 0.5C5 0.5 1 5.2 1 7.6a4 4 0 0 0 8 0C9 5.2 5 0.5 5 0.5Z" fill={AGUA[estado].color} />
    </svg>
  );
}

// Mini casilla de guardavidas (misma silueta que el modelo 3D) con la bandera del estado.
function IconoCasilla({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 40" className="my-2 h-10 w-full" aria-hidden>
      <g stroke="#9aa1a8" strokeWidth="1.5">
        <line x1="22" y1="26" x2="22" y2="38" />
        <line x1="38" y1="26" x2="38" y2="38" />
        <line x1="22" y1="26" x2="38" y2="38" />
        <line x1="38" y1="26" x2="22" y2="38" />
      </g>
      <line x1="10" y1="38" x2="20" y2="26" stroke="#d8bf94" strokeWidth="2" />
      <rect x="18" y="24.5" width="26" height="2" rx="1" fill="#9aa1a8" />
      <rect x="21" y="11" width="18" height="13.5" rx="1" fill="#f7e39a" />
      <rect x="22.5" y="14" width="15" height="5" fill="#3c4a55" />
      <path d="M17 11h26l-3-3H20z" fill="#e9e2d0" />
      <line x1="47" y1="4" x2="47" y2="26" stroke="#c9ced4" strokeWidth="1.2" />
      <path d="M47 4.5h9l-1.5 2.5 1.5 2.5h-9z" fill={color} />
    </svg>
  );
}
