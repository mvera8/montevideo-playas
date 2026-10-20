import { Wind } from "@phosphor-icons/react/dist/ssr";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Playa } from "@/lib/playas";
import type { VientoMapa } from "./capa-casillas";

// Modo "Viento" del mapa: por cada playa, flechas 3D que flotan sobre el agua y avanzan hacia donde
// sopla, con color, tamaño y velocidad de la animación según la intensidad (las dibuja `CapaCasillas`,
// todas en un draw call, animadas en el vertex shader). Encima, una etiqueta de km/h (capa de símbolos
// de MapLibre). Usa el mismo clima que ya trae cada playa (MET Norway, ver `src/lib/weather.ts`): no
// hace pedidos nuevos. Es el viento a 10 m del paso horario actual del modelo, no una medición.

/** Si el paso horario del pronóstico tiene más de esto, no se muestran flechas (dato vencido). */
export const HORAS_VIGENCIA_VIENTO = 3;

// Escala en km/h (aprox. Beaufort): calma, suave, moderado, fresco, fuerte.
export const NIVELES_VIENTO = [
  { hasta: 12, color: "#38bdf8", label: "Calma" },
  { hasta: 20, color: "#22c55e", label: "Suave" },
  { hasta: 29, color: "#eab308", label: "Moderado" },
  { hasta: 39, color: "#f97316", label: "Fresco" },
  { hasta: Infinity, color: "#ef4444", label: "Fuerte" },
];

const nivel = (kmh: number) => NIVELES_VIENTO.findIndex((n) => kmh < n.hasta);

/** `time` es hora local de Montevideo ("YYYY-MM-DDTHH:mm"; UTC−3 fijo, sin horario de verano). */
export function vientoVigente(time: string | undefined, ahora = Date.now()) {
  if (!time) return false;
  return ahora - Date.parse(`${time}:00-03:00`) < HORAS_VIGENCIA_VIENTO * 3_600_000;
}

/** Capa de etiquetas de km/h (oculta hasta que se activa el modo). La ubica la capa 3D: ver `onVientoMovido`. */
export function agregarCapaViento(map: MapLibreMap) {
  map.addSource("viento", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: "viento",
    type: "symbol",
    source: "viento",
    layout: {
      visibility: "none",
      "text-field": ["concat", ["get", "kmh"], " km/h"],
      "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 15, 13],
    },
    paint: { "text-color": "#0f3a52", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
  });
}

/** Etiquetas de km/h en los puntos que calculó la capa 3D. */
export function etiquetasViento(puntos: { lngLat: [number, number]; kmh: number }[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: puntos.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p.lngLat },
      properties: { kmh: Math.round(p.kmh) },
    })),
  };
}

/** Viento de cada playa para la capa 3D: solo playas con clima vigente. */
export function vientosMapa(playas: Playa[], ahora = Date.now()): VientoMapa[] {
  return playas
    .filter((p) => p.clima && vientoVigente(p.clima.time, ahora))
    .map((p) => ({
      lng: p.lon,
      lat: p.lat,
      orientacion: p.orientacion,
      desde: p.clima!.windDirection,
      kmh: p.clima!.windSpeed,
      color: NIVELES_VIENTO[nivel(p.clima!.windSpeed)].color,
    }));
}

/** Botón que prende y apaga el modo viento (arriba a la derecha, junto al menú; en móvil, del mismo tamaño). */
export function BotonViento({ activo, onCambiar }: { activo: boolean; onCambiar: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onCambiar(!activo)}
      aria-pressed={activo}
      title={activo ? "Ocultar viento" : "Ver viento"}
      className={`flex h-10 w-10 items-center justify-center gap-2 rounded-xl text-sm font-medium shadow-lg ring-1 backdrop-blur md:h-12 md:w-auto md:rounded-2xl md:px-4 ${
        activo
          ? "bg-sky-600 text-white ring-sky-700/20"
          : "bg-white/95 text-slate-700 ring-black/5 hover:text-slate-900 dark:bg-oscuro-1/95 dark:text-neutral-200 dark:ring-white/10"
      }`}
    >
      <Wind className="h-5 w-5" weight={activo ? "bold" : "regular"} aria-hidden />
      <span className="max-md:sr-only">Viento</span>
    </button>
  );
}

const horaFmt = (time: string) => time.slice(11, 16);

/** Referencia de colores y hora del pronóstico; avisa si no hay datos recientes. */
export function LeyendaViento({ time, vigente }: { time: string | null; vigente: boolean }) {
  return (
    <div className="pointer-events-auto w-60 animate-[aparecer_150ms_ease-out] rounded-2xl bg-white/95 px-3 py-2.5 text-xs text-slate-600 shadow-lg ring-1 ring-black/5 backdrop-blur motion-reduce:animate-none dark:bg-oscuro-1/95 dark:text-neutral-300 dark:ring-white/10">
      {vigente && time ? (
        <>
          <p className="font-medium text-slate-900 dark:text-white">Viento a las {horaFmt(time)} · km/h</p>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full">
            {NIVELES_VIENTO.map((n) => (
              <span key={n.label} className="flex-1" style={{ background: n.color }} title={n.label} />
            ))}
          </div>
          {/* Cortes entre niveles, alineados con los bordes de cada tramo. */}
          <div className="relative mt-1 h-4 tabular-nums text-slate-400" aria-label="Calma, suave, moderado, fresco y fuerte">
            {NIVELES_VIENTO.slice(0, -1).map((n, i) => (
              <span key={n.hasta} className="absolute -translate-x-1/2" style={{ left: `${((i + 1) / NIVELES_VIENTO.length) * 100}%` }}>
                {n.hasta}
              </span>
            ))}
          </div>
          <p className="text-slate-400">Pronóstico de MET Norway, no es una medición.</p>
        </>
      ) : (
        <p className="font-medium text-slate-900 dark:text-white">Sin datos recientes de viento</p>
      )}
    </div>
  );
}
