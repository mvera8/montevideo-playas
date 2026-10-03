import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { Weather } from "@/lib/weather";

// Temas del mapa según el tiempo. Recolorean el estilo "positron" de OpenFreeMap:
// - soleado: claro y saturado, agua brillante (estilo Google Maps)
// - nublado: monocromo apagado, calles como líneas finas (estilo póster)
// - noche:   fondo negro, avenidas ámbar con resplandor y edificios como luces

export type Tema = "soleado" | "nublado" | "noche";

export const TEMAS: Record<Tema, { label: string; icono: string }> = {
  soleado: { label: "Soleado", icono: "☀️" },
  nublado: { label: "Nublado", icono: "☁️" },
  noche: { label: "Noche", icono: "🌙" },
};

export function temaPorClima(c: Weather | null): Tema {
  if (!c) return "soleado";
  if (!c.isDay) return "noche";
  return c.weatherCode <= 2 ? "soleado" : "nublado"; // 3 = cubierto; 45+ niebla, llovizna, lluvia
}

type Paleta = {
  fondo: string;
  residencial: string;
  parque: string;
  bosque: string;
  agua: string;
  edificio: string;
  edificioBorde: string;
  sendero: string;
  viaMenor: string;
  viaMayor: string;
  viaMayorBorde: string;
  autopista: string;
  autopistaBorde: string;
  tren: string;
  limite: string;
  texto: string;
  textoCalle: string;
  textoAgua: string;
  halo: string;
  resplandor: number; // line-blur de los bordes de avenidas (glow nocturno)
  // capas propias
  etiqueta: string;
  etiquetaHalo: string;
};

const PALETAS: Record<Tema, Paleta> = {
  soleado: {
    fondo: "#eef0f2",
    residencial: "#e8eaed",
    parque: "#bfe6b6",
    bosque: "#b3dea8",
    agua: "#6ec6ff",
    edificio: "#e1e3e8",
    edificioBorde: "#d3d6dc",
    sendero: "#f7f7f7",
    viaMenor: "#ffffff",
    viaMayor: "#ffe49a",
    viaMayorBorde: "#f3c867",
    autopista: "#ffd36b",
    autopistaBorde: "#f1b63f",
    tren: "#c4c9d1",
    limite: "#9aa0a6",
    texto: "#3c4043",
    textoCalle: "#5f6368",
    textoAgua: "#0f5f9e",
    halo: "#ffffff",
    resplandor: 0,
    etiqueta: "#0f3a52",
    etiquetaHalo: "#ffffff",
  },
  nublado: {
    fondo: "#f3f3f1",
    residencial: "#efefed",
    parque: "#e5e7e2",
    bosque: "#e1e3de",
    agua: "#c2cbd4",
    edificio: "#e9e9e7",
    edificioBorde: "#d9d9d7",
    sendero: "#e6e6e4",
    viaMenor: "#cfcfcd",
    viaMayor: "#a9a9a7",
    viaMayorBorde: "#f3f3f1",
    autopista: "#7d7d7b",
    autopistaBorde: "#f3f3f1",
    tren: "#b5b5b3",
    limite: "#a3a3a1",
    texto: "#3f3f3f",
    textoCalle: "#6f6f6d",
    textoAgua: "#5b6876",
    halo: "#f3f3f1",
    resplandor: 0,
    etiqueta: "#2f3a44",
    etiquetaHalo: "#f3f3f1",
  },
  noche: {
    fondo: "#0a0b0e",
    residencial: "#0e0f13",
    parque: "#0d1310",
    bosque: "#0c110e",
    agua: "#05070b",
    edificio: "#241b0c",
    edificioBorde: "#3d2e12",
    sendero: "#1c1d21",
    viaMenor: "#2e2f34",
    viaMayor: "#c8913a",
    viaMayorBorde: "rgba(255,170,60,0.28)",
    autopista: "#ffcf73",
    autopistaBorde: "rgba(255,180,70,0.45)",
    tren: "#24252a",
    limite: "#3a3a40",
    texto: "#cdb27a",
    textoCalle: "#8c7a55",
    textoAgua: "#5d6b80",
    halo: "#000000",
    resplandor: 4,
    etiqueta: "#ffd98a",
    etiquetaHalo: "#000000",
  },
};

type Pinturas = Record<string, string | number>;

// Colores por capa del estilo base (por id) y de nuestras capas de texto.
function pinturas(id: string, p: Paleta): Pinturas | null {
  if (id === "background") return { "background-color": p.fondo };
  if (id === "park") return { "fill-color": p.parque };
  if (id === "water") return { "fill-color": p.agua };
  if (id.startsWith("landcover_ice") || id === "landcover_glacier") return { "fill-color": p.fondo };
  if (id === "landuse_residential") return { "fill-color": p.residencial };
  if (id === "landcover_wood") return { "fill-color": p.bosque };
  if (id === "waterway") return { "line-color": p.agua };
  if (id === "building") return { "fill-color": p.edificio, "fill-outline-color": p.edificioBorde };
  if (id === "road_area_pier") return { "fill-color": p.fondo };
  if (id === "road_pier") return { "line-color": p.fondo };
  if (id === "aeroway-area") return { "fill-color": p.viaMenor };
  if (id.startsWith("aeroway")) return { "line-color": p.viaMenor };
  if (id === "highway_path") return { "line-color": p.sendero };
  if (id === "highway_minor") return { "line-color": p.viaMenor };
  if (id === "highway_major_casing") return { "line-color": p.viaMayorBorde, "line-blur": p.resplandor };
  if (id === "highway_major_inner" || id === "highway_major_subtle") return { "line-color": p.viaMayor };
  if (id.includes("motorway") && id.endsWith("casing"))
    return { "line-color": p.autopistaBorde, "line-blur": p.resplandor };
  if (id.includes("motorway")) return { "line-color": p.autopista };
  if (id.startsWith("railway")) return { "line-color": id.endsWith("dashline") ? p.fondo : p.tren };
  if (id.startsWith("boundary")) return { "line-color": p.limite };
  if (id === "waterway_line_label" || id.startsWith("water_name"))
    return { "text-color": p.textoAgua, "text-halo-color": p.halo };
  if (id.startsWith("highway-name")) return { "text-color": p.textoCalle, "text-halo-color": p.halo };
  if (id === "airport" || id.startsWith("label_")) return { "text-color": p.texto, "text-halo-color": p.halo };
  if (id === "playas-nombres" || id === "casillas-nombres")
    return { "text-color": p.etiqueta, "text-halo-color": p.etiquetaHalo };
  if (id === "ruta-paradas-nombres") return { "text-halo-color": p.etiquetaHalo };
  return null;
}

/** Para `setStyle(..., { transformStyle })`: el mapa arranca ya con el tema, sin parpadeo. */
export function estiloConTema(estilo: StyleSpecification, tema: Tema): StyleSpecification {
  const p = PALETAS[tema];
  return {
    ...estilo,
    transition: { duration: 800, delay: 0 }, // fundido al cambiar de tema
    layers: estilo.layers.map((l) => {
      const extra = pinturas(l.id, p);
      return extra && "paint" in l ? ({ ...l, paint: { ...l.paint, ...extra } } as typeof l) : l;
    }),
  };
}

/** Cambia de tema en caliente (sin recargar el estilo ni perder las capas propias). */
export function aplicarTema(map: MapLibreMap, tema: Tema) {
  const p = PALETAS[tema];
  for (const l of map.getStyle().layers) {
    const extra = pinturas(l.id, p);
    if (!extra) continue;
    for (const [prop, valor] of Object.entries(extra))
      map.setPaintProperty(l.id, prop as Parameters<MapLibreMap["setPaintProperty"]>[1], valor);
  }
}
