import "server-only";
import { unstable_cache } from "next/cache";
import { getToken, invalidarToken } from "../im";
import { getIndice, type Patron } from "./gtfs";

// El endpoint `upcomingbuses` de la IM devuelve vacío en la práctica, así que estimamos
// la llegada proyectando la posición en vivo de cada ómnibus sobre el recorrido de su
// variante y usando los tiempos entre paradas del horario.

const BUSES = "https://api.montevideo.gub.uy/api/transportepublico/buses";
const CACHE_MS = 15_000; // una sola llamada con todos los ómnibus, compartida por todos los usuarios
// Si la copia compartida tiene más que esto (nadie la pidió en un rato), se pide de nuevo en el momento.
const COMPARTIDO_MAX_MS = 60_000;
const VIEJO_MS = 5 * 60_000;

type BusIm = {
  busId: number;
  line: string;
  lineVariantId: number;
  timestamp: string;
  access?: string;
  thermalConfort?: string;
  location: { coordinates: [number, number] };
};

export type Llegada = {
  busId: number;
  minutos: number;
  lat: number;
  lon: number;
  accesible: boolean;
  aire: boolean;
};

const g = globalThis as unknown as { __buses?: { datos: BusIm[]; hora: number; promesa?: Promise<BusIm[]> } };
g.__buses ??= { datos: [], hora: 0 };
const cache = g.__buses;

async function traerBuses(): Promise<{ hora: number; datos: BusIm[] }> {
  const res = await fetch(BUSES, {
    headers: { Authorization: `Bearer ${await getToken("transporte")}` },
    cache: "no-store",
  });
  if (res.status === 401) invalidarToken("transporte");
  if (!res.ok) throw new Error(`Buses IM falló (${res.status})`);
  return { hora: Date.now(), datos: await res.json() };
}

// Cache compartido entre todas las instancias del servidor (Data Cache de Next; en Vercel es global).
// No alcanza con `next: { revalidate }` en el fetch: el header Authorization es parte de la clave y
// cada instancia tiene su propio token, así que cada una cacheaba aparte. La respuesta pesa ~460 KB
// (1.232 ómnibus, medido 08/10/2026), dentro del tope de 2 MB por entrada. Los errores no se cachean.
const busesCompartidos = unstable_cache(traerBuses, ["im-buses-v1"], { revalidate: CACHE_MS / 1000 });

async function getBuses(): Promise<BusIm[]> {
  if (Date.now() - cache.hora < CACHE_MS) return cache.datos;
  cache.promesa ??= (async () => {
    try {
      let r = await busesCompartidos();
      // unstable_cache devuelve lo viejo y revalida de fondo: si hace rato que nadie pedía, eso
      // puede tener horas y no sirve para estimar llegadas.
      if (Date.now() - r.hora > COMPARTIDO_MAX_MS) r = await traerBuses();
      cache.datos = r.datos;
      cache.hora = r.hora;
      return cache.datos;
    } catch (e) {
      // Ante un error (p. ej. límite de uso), devolvemos lo último que tengamos.
      console.error(e);
      return cache.datos;
    } finally {
      cache.promesa = undefined;
    }
  })();
  return cache.promesa;
}

// La IM manda la zona como "-03" (sin minutos), que Date no entiende.
const fechaIm = (s: string) => new Date(s.replace(/([+-]\d{2})$/, "$1:00")).getTime();

const M_LAT = 110_540;
const M_LON = 111_320 * Math.cos((-34.9 * Math.PI) / 180);

/** Distancia a lo largo de la forma del punto más cercano, y qué tan lejos está de ella. */
function proyectar(p: Patron, lat: number, lon: number) {
  let mejor = Infinity, dist = 0;
  const px = lon * M_LON, py = lat * M_LAT;
  for (let j = 0; j < p.distForma.length - 1; j++) {
    const ax = p.forma[j * 2] * M_LON, ay = p.forma[j * 2 + 1] * M_LAT;
    const vx = p.forma[j * 2 + 2] * M_LON - ax, vy = p.forma[j * 2 + 3] * M_LAT - ay;
    const len2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
    const d = Math.hypot(ax + vx * t - px, ay + vy * t - py);
    if (d < mejor) {
      mejor = d;
      dist = p.distForma[j] + t * (p.distForma[j + 1] - p.distForma[j]);
    }
  }
  return { dist, desvio: mejor };
}

/** Minutos de horario equivalentes a una distancia recorrida (interpolando entre paradas). */
function minutoEn(p: Patron, dist: number) {
  const d = p.distParadas;
  if (dist <= d[0]) return 0;
  for (let i = 1; i < d.length; i++)
    if (dist <= d[i]) {
      const t = d[i] > d[i - 1] ? (dist - d[i - 1]) / (d[i] - d[i - 1]) : 0;
      return p.minutos[i - 1] + t * (p.minutos[i] - p.minutos[i - 1]);
    }
  return p.minutos[p.minutos.length - 1];
}

/** Próximos ómnibus de una variante que todavía no pasaron por la parada. */
export async function llegadas(variante: number, paradaId: string): Promise<Llegada[]> {
  const [ix, buses] = await Promise.all([getIndice(), getBuses()]);
  const pi = ix.porVariante.get(variante);
  if (pi === undefined) return [];
  const p = ix.patrones[pi];
  const pos = p.paradas.findIndex((s) => ix.paradas[s].id === paradaId);
  if (pos < 0) return [];

  const ahora = Date.now();
  return buses
    .filter((b) => b.lineVariantId === variante && ahora - fechaIm(b.timestamp) < VIEJO_MS)
    .map((b) => {
      const [lon, lat] = b.location.coordinates;
      const { dist, desvio } = proyectar(p, lat, lon);
      return { b, lat, lon, dist, desvio };
    })
    .filter((x) => x.desvio < 150 && x.dist < p.distParadas[pos] - 30)
    .map((x) => ({
      busId: x.b.busId,
      minutos: Math.max(0, Math.round(p.minutos[pos] - minutoEn(p, x.dist))),
      lat: x.lat,
      lon: x.lon,
      accesible: /bajo/i.test(x.b.access ?? ""),
      aire: /aire/i.test(x.b.thermalConfort ?? ""),
    }))
    .sort((a, b) => a.minutos - b.minutos)
    .slice(0, 3);
}
