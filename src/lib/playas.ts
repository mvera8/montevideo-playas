import "server-only";
import {
  getImLifeguardStations,
  getImVencimientos,
  hasImCredentials,
  type ImLifeguardStation,
  type SafetyFlag,
  type VencimientoIm,
} from "./im";
import casillasSnapshot from "@/data/casillas.json";
import orientaciones from "@/data/orientaciones.json";
import { banderasDe } from "./banderas";
import { aguasVivasPara, getAguasVivas, type AguasVivasPlaya } from "./aguas-vivas";
import { getCalidadAgua, type CalidadAgua } from "./calidad-agua";
import { getMeGusta, type TotalesMeGusta } from "./me-gusta";
import { orientacionRespaldo } from "./recomendacion";
import { getServicios, serviciosCerca, type Servicio } from "./servicios";
import { getWeatherForPoints, type Weather } from "./weather";

export type Guardavidas = {
  id: string;
  nombre: string;
  direccion: string | null;
  lat: number;
  lon: number;
  comoIr: string | null;
  // Banderas: null cuando no hay dato vigente (expirado o fuera de temporada).
  // Rumbo desde la casilla hacia el agua (0 = norte). Precalculado con la costa de OSM
  // (npm run orientaciones); null si la casilla es nueva y todavía no está calculada.
  orientacion: number | null;
  bandera: Exclude<SafetyFlag, "noData"> | null;
  // Bandera sanitaria (roja con cruz verde, "no apta para baños"): la IM la usa todo el año, p. ej.
  // las 24 h posteriores a lluvias. Se muestra junto con la de seguridad.
  banderaSanitaria: { activa: boolean; causa: string | null; detalle: string | null } | null;
};

export type Playa = {
  slug: string;
  nombre: string;
  descripcion: string | null;
  lat: number;
  lon: number;
  guardavidas: Guardavidas[];
  clima: Weather | null;
  orientacion: number; // hacia dónde mira la playa (promedio circular de sus casillas)
  agua: CalidadAgua | null; // calidad del agua (datos abiertos de la IM)
  servicios: Servicio[]; // baños y bebederos públicos cercanos (IM)
  meGusta: TotalesMeGusta | null; // me gusta del sitio (Supabase); null si la base no responde
  aguasVivas: AguasVivasPlaya | null; // aguas vivas reportadas en iNaturalist; null si no respondió
};

export type PlayasResult = {
  fuente: "im" | "respaldo";
  error: string | null;
  temporada: Temporada;
  playas: Playa[];
};

export type Temporada = { activa: boolean; inicio: string; fin: string; diasParaInicio: number };

// Temporada de guardavidas en Montevideo: 15 de noviembre a fin de abril (aprox.).
// Fuera de temporada la IM no actualiza las banderas.
export function getTemporada(now = new Date()): Temporada {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  // Si estamos en ene-abr la temporada empezó el año anterior.
  const startYear = m <= 4 ? y - 1 : y;
  const inicio = new Date(Date.UTC(startYear, 10, 15, 11)); // 15/11 08:00 UY
  const fin = new Date(Date.UTC(startYear + 1, 3, 30, 23)); // 30/04 20:00 UY
  const proximoInicio = now > fin ? new Date(Date.UTC(y, 10, 15, 11)) : inicio;
  return {
    activa: now >= inicio && now <= fin,
    inicio: proximoInicio.toISOString(),
    diasParaInicio: Math.max(0, Math.ceil((proximoInicio.getTime() - now.getTime()) / 86_400_000)),
    fin: fin.toISOString(),
  };
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^playa\s+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// La IM identifica la playa de cada casilla con un código (`beach`).
// Al agregar una playa, sumarla también a la tabla `playas` de Supabase (README → "Me gusta").
const NOMBRES_PLAYA: Record<string, string> = {
  puntaespinillo: "Punta Espinillo",
  lacolorada: "La Colorada",
  pajasblancas: "Pajas Blancas",
  zabala: "Zabala",
  loscilindros: "Los Cilindros",
  puntayeguas: "Punta Yeguas",
  santacatalina: "Santa Catalina",
  delnacional: "Playa del Nacional",
  delcerro: "Playa del Cerro",
  ramirez: "Ramírez",
  pocitos: "Pocitos",
  buceo: "Buceo",
  malvin: "Malvín",
  brava: "Playa Brava",
  honda: "Playa Honda",
  delosingleses: "Los Ingleses",
  verde: "Playa Verde",
  lamulata: "La Mulata",
  carrasco: "Carrasco",
};

/** Nombre de una playa a partir de su slug (sin pedir nada a la IM), p. ej. para los me gusta. */
export function nombrePlayaPorSlug(slug: string) {
  const nombre = Object.values(NOMBRES_PLAYA).find((n) => slugify(n) === slug);
  return nombre ?? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
}

/** Todas las playas conocidas (slug y nombre), sin pedir nada a la IM. */
export function playasConocidas() {
  return Object.values(NOMBRES_PLAYA).map((nombre) => ({ slug: slugify(nombre), nombre }));
}

function nombrePlaya(codigo: string) {
  return NOMBRES_PLAYA[codigo] ?? codigo.charAt(0).toUpperCase() + codigo.slice(1);
}

// Algunos registros de la IM traen la longitud con signo positivo.
function coordenadas(s: ImLifeguardStation): [number, number] {
  const [lon, lat] = s.location.coordinates;
  return [-Math.abs(lon), -Math.abs(lat)];
}

// `venc`: vencimientos del sitio móvil de la IM (la API no los trae; ver src/lib/im.ts). `null`: sin
// banderas (casillas del snapshot; las completa el navegador, ver banderas-cliente.ts).
function toGuardavidas(s: ImLifeguardStation, temporadaActiva: boolean, venc: VencimientoIm | undefined | null): Guardavidas {
  const [lon, lat] = coordenadas(s);
  const { bandera, banderaSanitaria } =
    venc === null ? { bandera: null, banderaSanitaria: null } : banderasDe(s, temporadaActiva, venc);
  return {
    id: s.id,
    nombre: s.name,
    direccion: s.address ?? null,
    lat,
    lon,
    comoIr: s.linkComoIr ?? null,
    orientacion: (orientaciones.casillas as Record<string, { rumbo: number }>)[s.id]?.rumbo ?? null,
    bandera,
    banderaSanitaria,
  };
}

// Respaldo para cuando no hay credenciales de la IM o la API no responde (desde 10/2026 la IM filtra las
// IP de fuera de Uruguay y Vercel no tiene región acá): las mismas casillas, de un snapshot del repo
// (src/data/casillas.json, `npm run casillas` desde Uruguay), sin banderas. Así el mapa tiene las playas
// reales con su clima, agua y servicios, y el navegador completa las banderas pidiéndoselas a la IM.
const CASILLAS_SNAPSHOT = casillasSnapshot.casillas as ImLifeguardStation[];

/** Promedio de ángulos (rumbos en grados): el promedio común falla cerca de 0°/360°. */
function promedioCircular(rumbos: (number | null)[]): number | null {
  const v = rumbos.filter((r): r is number => r != null);
  if (!v.length) return null;
  const rad = v.map((r) => (r * Math.PI) / 180);
  const x = rad.reduce((t, r) => t + Math.sin(r), 0);
  const y = rad.reduce((t, r) => t + Math.cos(r), 0);
  return Math.round(((Math.atan2(x, y) * 180) / Math.PI + 360) % 360);
}

// Suma clima (MET Norway y NOAA), calidad del agua y servicios cercanos (IM), me gusta (Supabase) y
// aguas vivas (iNaturalist) a cada playa, en paralelo.
async function withClima(playas: Omit<Playa, "clima" | "agua" | "servicios" | "orientacion" | "meGusta" | "aguasVivas">[]): Promise<Playa[]> {
  const [clima, agua, servicios, meGusta, aguasVivas] = await Promise.all([
    getWeatherForPoints(playas.map((p) => ({ lat: p.lat, lon: p.lon }))).catch((e) => {
      console.error(e);
      return [] as Weather[];
    }),
    getCalidadAgua(),
    getServicios(),
    getMeGusta(),
    getAguasVivas(),
  ]);
  return playas.map((p, i) => ({
    ...p,
    clima: clima[i] ?? null,
    agua: agua.get(p.slug) ?? null,
    orientacion: promedioCircular(p.guardavidas.map((g) => g.orientacion)) ?? orientacionRespaldo(p.slug),
    servicios: serviciosCerca(servicios, p.guardavidas.length ? p.guardavidas : [p]),
    meGusta: meGusta ? (meGusta.get(p.slug) ?? { temporada: 0, siempre: 0 }) : null,
    aguasVivas: aguasVivasPara(aguasVivas, p),
  }));
}

/** Agrupa las casillas por su código de playa (el endpoint de la IM devuelve casillas, no playas). */
function armarPlayas(
  stations: ImLifeguardStation[],
  temporadaActiva: boolean,
  vencimientos: Record<string, VencimientoIm> | null | "sin-banderas",
) {
  const porPlaya = new Map<string, Guardavidas[]>();
  for (const s of stations) {
    const codigo = s.beach || "sin-playa";
    const venc = vencimientos === "sin-banderas" ? null : vencimientos?.[s.id];
    porPlaya.set(codigo, [...(porPlaya.get(codigo) ?? []), toGuardavidas(s, temporadaActiva, venc)]);
  }
  return (
    [...porPlaya.entries()]
      .map(([codigo, guardavidas]) => {
        const nombre = nombrePlaya(codigo);
        guardavidas.sort((a, b) => a.lon - b.lon);
        return {
          slug: slugify(nombre),
          nombre,
          descripcion: guardavidas.length > 1 ? guardavidas.map((g) => g.nombre).join(" · ") : guardavidas[0].direccion,
          lat: guardavidas.reduce((t, g) => t + g.lat, 0) / guardavidas.length,
          lon: guardavidas.reduce((t, g) => t + g.lon, 0) / guardavidas.length,
          guardavidas,
        };
      })
      // Oeste a este, como se recorre la costa.
      .sort((a, b) => a.lon - b.lon)
  );
}

function respaldo(temporadaActiva: boolean) {
  return armarPlayas(CASILLAS_SNAPSHOT, temporadaActiva, "sin-banderas");
}

export async function getPlayas(): Promise<PlayasResult> {
  const temporada = getTemporada();

  if (!hasImCredentials()) {
    return {
      fuente: "respaldo",
      error: "Faltan IM_CLIENT_ID / IM_CLIENT_SECRET en .env.local",
      temporada,
      playas: await withClima(respaldo(temporada.activa)),
    };
  }

  try {
    const [stations, vencimientos] = await Promise.all([getImLifeguardStations(), getImVencimientos()]);
    return { fuente: "im", error: null, temporada, playas: await withClima(armarPlayas(stations, temporada.activa, vencimientos)) };
  } catch (e) {
    console.error(e);
    return {
      fuente: "respaldo",
      error: e instanceof Error ? e.message : String(e),
      temporada,
      playas: await withClima(respaldo(temporada.activa)),
    };
  }
}

export async function getPlaya(slug: string) {
  const { playas, ...rest } = await getPlayas();
  const playa = playas.find((p) => p.slug === slug) ?? null;
  return { ...rest, playa };
}
