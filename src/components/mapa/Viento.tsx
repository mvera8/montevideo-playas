import { Wind } from "@phosphor-icons/react/dist/ssr";
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { Playa } from "@/lib/playas";

// Modo "Viento" del mapa: una flecha por playa que apunta hacia donde sopla, con color e intensidad
// según la velocidad. Usa el mismo clima que ya trae cada playa (MET Norway, ver `src/lib/weather.ts`):
// no hace pedidos nuevos. Es el viento a 10 m del paso horario actual del modelo, no una medición.
// Las flechas son íconos planos sobre el suelo (`icon-pitch-alignment: map`), así acompañan el 3D.

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

/** Flechas (una por nivel) dibujadas en SVG a 2x, apuntando al norte; la capa las rota. */
function cargarFlechas(map: MapLibreMap) {
  NIVELES_VIENTO.forEach((n, i) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><path d="M32 5 52 31H39v27H25V31H12Z" fill="${n.color}" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>`;
    const img = new Image(64, 64);
    img.onload = () => {
      if (!map.hasImage(`viento-${i}`)) map.addImage(`viento-${i}`, img, { pixelRatio: 2 });
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Fuente y capa del viento (ocultas hasta que se activa el modo). */
export function agregarCapaViento(map: MapLibreMap, antesDe?: string) {
  cargarFlechas(map);
  map.addSource("viento", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  // Más grande cuanto más sopla (de 0,75x en calma a 1,35x desde 48 km/h).
  const escala: ExpressionSpecification = ["+", 0.75, ["/", ["min", ["get", "kmh"], 48], 80]];
  map.addLayer(
    {
      id: "viento",
      type: "symbol",
      source: "viento",
      layout: {
        visibility: "none",
        "icon-image": ["concat", "viento-", ["get", "nivel"]],
        // El viento se informa "desde" dónde viene; la flecha apunta hacia donde va.
        "icon-rotate": ["+", ["get", "desde"], 180],
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, ["*", 1.1, escala], 15, ["*", 2, escala]],
        "icon-allow-overlap": true,
        "text-field": ["concat", ["get", "kmh"], " km/h"],
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 15, 13],
        // Debajo de la flecha, sobre el agua (arriba chocaba con las casillas).
        "text-anchor": "top",
        "text-offset": [0, 1.6],
        "text-optional": true,
      },
      paint: {
        "icon-translate": ["interpolate", ["linear"], ["zoom"], 10, ["literal", [0, 34]], 13.5, ["literal", [0, 0]]],
        "icon-translate-anchor": "viewport",
        "text-translate": ["interpolate", ["linear"], ["zoom"], 10, ["literal", [0, 34]], 13.5, ["literal", [0, 0]]],
        "text-translate-anchor": "viewport",
        "text-color": "#0f3a52",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6,
      },
    },
    antesDe,
  );
}

// Las flechas van sobre el agua, corridas desde la playa según su orientación (rumbo hacia el agua):
// en el punto de la playa quedaban tapadas por las casillas 3D.
// De lejos las casillas se agrandan y el corrimiento queda chico: ahí la capa además baja las flechas
// unos píxeles en pantalla (`icon-translate`; la costa mira al sur, o sea hacia abajo).
const CORRIMIENTO_GRADOS = 0.0035; // ≈ 380 m

function sobreElAgua(p: Playa): [number, number] {
  if (p.orientacion == null) return [p.lon, p.lat];
  const r = (p.orientacion * Math.PI) / 180;
  return [
    p.lon + (CORRIMIENTO_GRADOS * Math.sin(r)) / Math.cos((p.lat * Math.PI) / 180),
    p.lat + CORRIMIENTO_GRADOS * Math.cos(r),
  ];
}

/** Puntos del viento: solo playas con clima vigente. */
export function datosViento(playas: Playa[], ahora = Date.now()): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: playas
      .filter((p) => p.clima && vientoVigente(p.clima.time, ahora))
      .map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: sobreElAgua(p) },
        properties: {
          desde: p.clima!.windDirection,
          kmh: Math.round(p.clima!.windSpeed),
          nivel: nivel(p.clima!.windSpeed),
        },
      })),
  };
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
