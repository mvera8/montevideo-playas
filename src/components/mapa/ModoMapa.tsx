import type { Map as MapLibreMap } from "maplibre-gl";
import type { ReactNode } from "react";

// Lo que comparten los modos del mapa que dibuja la capa 3D (Viento.tsx, Olas.tsx): botón, leyenda y
// etiquetas de texto (capa de símbolos de MapLibre, oculta hasta que se activa el modo).

/** Capa de etiquetas. La ubica la capa 3D: ver `onVientoMovido` y `onOlasMovido`. */
export function agregarCapaEtiquetas(map: MapLibreMap, id: string) {
  map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id,
    type: "symbol",
    source: id,
    layout: {
      visibility: "none",
      "text-field": ["get", "texto"],
      "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 15, 13],
    },
    paint: { "text-color": "#0f3a52", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
  });
}

export function etiquetas(puntos: { lngLat: [number, number]; texto: string }[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: puntos.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p.lngLat },
      properties: { texto: p.texto },
    })),
  };
}

/** Botón que prende y apaga el modo (arriba a la derecha, junto al menú; en móvil, del mismo tamaño). */
export function BotonModoMapa({
  activo,
  onCambiar,
  etiqueta,
  icono,
}: {
  activo: boolean;
  onCambiar: (v: boolean) => void;
  etiqueta: string;
  icono: ReactNode;
}) {
  return (
    <button
      onClick={() => onCambiar(!activo)}
      aria-pressed={activo}
      title={`${activo ? "Ocultar" : "Ver"} ${etiqueta.toLowerCase()}`}
      className={`flex h-10 w-10 items-center justify-center gap-2 rounded-xl text-sm font-medium shadow-lg ring-1 backdrop-blur md:h-12 md:w-auto md:rounded-2xl md:px-4 ${
        activo
          ? "bg-sky-700 text-white ring-sky-800/20"
          : "bg-white/95 text-slate-700 ring-black/5 hover:text-slate-900 dark:bg-oscuro-1/95 dark:text-neutral-200 dark:ring-white/10"
      }`}
    >
      {icono}
      <span className="max-md:sr-only">{etiqueta}</span>
    </button>
  );
}

export type Nivel = { hasta: number; color: string; label: string };

/** Referencia de colores con los cortes entre niveles; sin `titulo`, avisa que no hay datos recientes. */
export function LeyendaNiveles({
  titulo,
  niveles,
  nota,
  sinDatos,
  corte = String,
}: {
  titulo: string | null;
  niveles: Nivel[];
  nota: string;
  sinDatos: string;
  corte?: (hasta: number) => string;
}) {
  return (
    <div className="pointer-events-auto w-60 animate-[aparecer_150ms_ease-out] rounded-2xl bg-white/95 px-3 py-2.5 text-xs text-slate-600 shadow-lg ring-1 ring-black/5 backdrop-blur motion-reduce:animate-none dark:bg-oscuro-1/95 dark:text-neutral-300 dark:ring-white/10">
      {titulo ? (
        <>
          <p className="font-medium text-slate-900 dark:text-white">{titulo}</p>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full">
            {niveles.map((n) => (
              <span key={n.label} className="flex-1" style={{ background: n.color }} title={n.label} />
            ))}
          </div>
          {/* Cortes entre niveles, alineados con los bordes de cada tramo. */}
          <div className="relative mt-1 h-4 tabular-nums text-slate-400" aria-label={niveles.map((n) => n.label).join(", ")}>
            {niveles.slice(0, -1).map((n, i) => (
              <span key={n.hasta} className="absolute -translate-x-1/2" style={{ left: `${((i + 1) / niveles.length) * 100}%` }}>
                {corte(n.hasta)}
              </span>
            ))}
          </div>
          <p className="text-slate-400">{nota}</p>
        </>
      ) : (
        <p className="font-medium text-slate-900 dark:text-white">{sinDatos}</p>
      )}
    </div>
  );
}
