import "server-only";
import {
  getImLifeguardStations,
  hasImCredentials,
  type ImLifeguardStation,
  type SafetyFlag,
} from "./im";
import orientaciones from "@/data/orientaciones.json";
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
  banderaSanitaria: { activa: boolean; causa: string | null } | null;
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

// Si la IM informa vencimiento, se respeta; si no lo informa, el dato solo
// se considera válido durante la temporada (fuera de ella no se actualiza).
function vigente(expiration: string | null | undefined, temporadaActiva: boolean) {
  if (expiration) return new Date(expiration).getTime() > Date.now();
  return temporadaActiva;
}

// La IM identifica la playa de cada casilla con un código (`beach`).
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

function nombrePlaya(codigo: string) {
  return NOMBRES_PLAYA[codigo] ?? codigo.charAt(0).toUpperCase() + codigo.slice(1);
}

// Algunos registros de la IM traen la longitud con signo positivo.
function coordenadas(s: ImLifeguardStation): [number, number] {
  const [lon, lat] = s.location.coordinates;
  return [-Math.abs(lon), -Math.abs(lat)];
}

function toGuardavidas(s: ImLifeguardStation, temporadaActiva: boolean): Guardavidas {
  const [lon, lat] = coordenadas(s);
  const bandera =
    s.safetyFlag &&
    s.safetyFlag !== "noData" &&
    vigente(s.safetyFlagExpiration, temporadaActiva)
      ? s.safetyFlag
      : null;
  const banderaSanitaria =
    s.healthFlag != null && vigente(s.healthFlagExpiration, temporadaActiva)
      ? { activa: s.healthFlag, causa: s.healthFlagCauseDesc ?? null }
      : null;
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

// Lista de respaldo (coordenadas aproximadas) para cuando no hay credenciales
// de la IM o la API no responde. Permite seguir mostrando el clima por playa.
const RESPALDO: { nombre: string; lat: number; lon: number }[] = [
  { nombre: "Pajas Blancas", lat: -34.8605, lon: -56.3415 },
  { nombre: "Santa Catalina", lat: -34.8735, lon: -56.2955 },
  { nombre: "Playa del Cerro", lat: -34.8915, lon: -56.2525 },
  { nombre: "Ramírez", lat: -34.9145, lon: -56.1715 },
  { nombre: "Pocitos", lat: -34.9115, lon: -56.1505 },
  { nombre: "Buceo", lat: -34.9075, lon: -56.1355 },
  { nombre: "Malvín", lat: -34.8965, lon: -56.1085 },
  { nombre: "Honda", lat: -34.8935, lon: -56.0985 },
  { nombre: "Verde", lat: -34.8905, lon: -56.0885 },
  { nombre: "Los Ingleses", lat: -34.8885, lon: -56.0805 },
  { nombre: "Carrasco", lat: -34.8875, lon: -56.0555 },
  { nombre: "Miramar", lat: -34.8775, lon: -56.0355 },
];

/** Promedio de ángulos (rumbos en grados): el promedio común falla cerca de 0°/360°. */
function promedioCircular(rumbos: (number | null)[]): number | null {
  const v = rumbos.filter((r): r is number => r != null);
  if (!v.length) return null;
  const rad = v.map((r) => (r * Math.PI) / 180);
  const x = rad.reduce((t, r) => t + Math.sin(r), 0);
  const y = rad.reduce((t, r) => t + Math.cos(r), 0);
  return Math.round(((Math.atan2(x, y) * 180) / Math.PI + 360) % 360);
}

// Suma clima (Open-Meteo), calidad del agua y servicios cercanos (IM) y me gusta (Supabase) a cada
// playa, en paralelo.
async function withClima(playas: Omit<Playa, "clima" | "agua" | "servicios" | "orientacion" | "meGusta">[]): Promise<Playa[]> {
  const [clima, agua, servicios, meGusta] = await Promise.all([
    getWeatherForPoints(playas.map((p) => ({ lat: p.lat, lon: p.lon }))).catch((e) => {
      console.error(e);
      return [] as Weather[];
    }),
    getCalidadAgua(),
    getServicios(),
    getMeGusta(),
  ]);
  return playas.map((p, i) => ({
    ...p,
    clima: clima[i] ?? null,
    agua: agua.get(p.slug) ?? null,
    orientacion: promedioCircular(p.guardavidas.map((g) => g.orientacion)) ?? orientacionRespaldo(p.slug),
    servicios: serviciosCerca(servicios, p.guardavidas.length ? p.guardavidas : [p]),
    meGusta: meGusta ? (meGusta.get(p.slug) ?? { temporada: 0, siempre: 0 }) : null,
  }));
}

function respaldo(): Omit<Playa, "clima" | "agua" | "servicios" | "orientacion" | "meGusta">[] {
  return RESPALDO.map((b) => ({
    slug: slugify(b.nombre),
    nombre: b.nombre,
    descripcion: null,
    lat: b.lat,
    lon: b.lon,
    guardavidas: [],
  }));
}

export async function getPlayas(): Promise<PlayasResult> {
  const temporada = getTemporada();

  if (!hasImCredentials()) {
    return {
      fuente: "respaldo",
      error: "Faltan IM_CLIENT_ID / IM_CLIENT_SECRET en .env.local",
      temporada,
      playas: await withClima(respaldo()),
    };
  }

  try {
    // El endpoint /beaches de la IM devuelve casillas, no playas: las playas se
    // arman agrupando las casillas por su código de playa.
    const stations = await getImLifeguardStations();

    const porPlaya = new Map<string, Guardavidas[]>();
    for (const s of stations) {
      const codigo = s.beach || "sin-playa";
      porPlaya.set(codigo, [...(porPlaya.get(codigo) ?? []), toGuardavidas(s, temporada.activa)]);
    }

    const playas = [...porPlaya.entries()]
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
      .sort((a, b) => a.lon - b.lon);

    return { fuente: "im", error: null, temporada, playas: await withClima(playas) };
  } catch (e) {
    console.error(e);
    return {
      fuente: "respaldo",
      error: e instanceof Error ? e.message : String(e),
      temporada,
      playas: await withClima(respaldo()),
    };
  }
}

export async function getPlaya(slug: string) {
  const { playas, ...rest } = await getPlayas();
  const playa = playas.find((p) => p.slug === slug) ?? null;
  return { ...rest, playa };
}
