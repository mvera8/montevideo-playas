import "server-only";

// Mar: temperatura del agua y olas, de modelos de NOAA servidos por ERDDAP (sin API key, datos de
// dominio público / uso y redistribución libres, también comerciales).
//
// - Temperatura del agua: NOAA OISST v2.1 "near real time", diaria, grilla de 0,25°.
//   https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21NrtAgg_LonPM180
//   Se publica con ~1 día de demora (medido: el 04/10 el último dato era del 03/10). Si el último
//   dato tiene más de DIAS_VIGENCIA_SST días no se muestra. Cacheado 6 h.
// - Olas: WaveWatch III global de PacIOOS (Univ. de Hawái / NOAA), hora a hora, 0,5°, 7 días de
//   pronóstico. https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global (longitud 0–360).
//   Cacheado 1 h.
//
// Quirks: ERDDAP pide los corchetes de la consulta codificados (%5B %5D); las celdas de tierra o
// del estuario interior vienen como NaN, por eso se pide una cajita alrededor del punto y se usa la
// celda con dato más cercana. La caja se arma redondeando el punto a la grilla, así todas las playas
// de Montevideo comparten la misma URL (un solo pedido cacheado). Ojo: en el Río de la Plata, a
// 0,5°, la ola es la de afuera de la costa; es orientativa.
//
// Si un servidor ERDDAP no responde (pasa: coastwatch.pfeg.noaa.gov tuvo caídas de conexión), se
// deja de consultar por 5 min (PAUSA_FALLA) y la app sigue sin ese dato.

type Point = { lat: number; lon: number };

export const DIAS_VIGENCIA_SST = 4;
const TIMEOUT = 10_000;

type Celda = { lat: number; lon: number; valor: number };

// Si un servidor no responde (caído, timeout o error 5xx), no lo volvemos a intentar por PAUSA_FALLA:
// los pedidos fallidos no quedan en la caché de datos, así que sin esto cada render esperaría el
// timeout completo de nuevo. En memoria, por servidor (agua y olas son servidores distintos).
const PAUSA_FALLA = 5 * 60_000;
const caidoHasta = new Map<string, number>();

async function erddapCsv(url: string, revalidate: number) {
  const host = new URL(url).host;
  if ((caidoHasta.get(host) ?? 0) > Date.now()) throw new Error(`ERDDAP en pausa tras una falla: ${host}`);
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(TIMEOUT) });
  } catch (e) {
    caidoHasta.set(host, Date.now() + PAUSA_FALLA);
    throw e;
  }
  if (res.status >= 500) caidoHasta.set(host, Date.now() + PAUSA_FALLA);
  if (!res.ok) throw new Error(`ERDDAP falló (${res.status}): ${url}`);
  // Encabezado + fila de unidades, después: time,profundidad,lat,lon,valor
  return (await res.text())
    .trim()
    .split("\n")
    .slice(2)
    .map((l) => {
      const [time, , lat, lon, valor] = l.split(",");
      return { time, lat: Number(lat), lon: Number(lon), valor: Math.round(Number(valor) * 10) / 10 };
    })
    .filter((f) => Number.isFinite(f.valor));
}

const q = (s: string) => encodeURIComponent(`[${s}]`);
const redondear = (v: number, paso: number) => Math.round(v / paso) * paso;

function masCercana<T extends Celda>(celdas: T[], p: Point, lon360 = false) {
  const lon = lon360 ? (p.lon + 360) % 360 : p.lon;
  let mejor: T | null = null;
  let d = Infinity;
  for (const c of celdas) {
    const dc = (c.lat - p.lat) ** 2 + (c.lon - lon) ** 2;
    if (dc < d) [mejor, d] = [c, dc];
  }
  return mejor;
}

// ---------- temperatura del agua ----------

async function sst(p: Point) {
  const lat = redondear(p.lat, 0.5);
  const lon = redondear(p.lon, 0.5);
  const url =
    "https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21NrtAgg_LonPM180.csv?sst" +
    q("(last)") +
    q("(0.0)") +
    q(`(${lat - 0.5}):(${lat + 0.5})`) +
    q(`(${lon - 0.5}):(${lon + 0.5})`);
  const filas = await erddapCsv(url, 21600);
  const c = masCercana(filas, p);
  if (!c) return null;
  const dias = (Date.now() - Date.parse(c.time)) / 86_400_000;
  return dias <= DIAS_VIGENCIA_SST ? c.valor : null;
}

/** Temperatura del agua (°C) para cada punto, o null si no hay dato reciente. Mismo orden. */
export async function getTemperaturaAgua(points: Point[]): Promise<(number | null)[]> {
  return Promise.all(points.map((p) => sst(p).catch(() => null)));
}

// ---------- olas ----------

/** Altura significativa de ola (m) por hora UTC ("YYYY-MM-DDTHH"), desde la hora actual a +`horas`. */
async function olas(p: Point, horas: number) {
  const lat = redondear(p.lat, 0.5);
  const lon = redondear((p.lon + 360) % 360, 0.5);
  const desde = new Date();
  desde.setUTCMinutes(0, 0, 0);
  const hasta = new Date(desde.getTime() + horas * 3_600_000);
  const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z";
  const url =
    "https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global.csv?Thgt" +
    q(`(${iso(desde)}):(${iso(hasta)})`) +
    q("(0.0)") +
    q(`(${lat - 0.5}):(${lat + 0.5})`) +
    q(`(${lon - 0.5}):(${lon + 0.5})`);
  const filas = await erddapCsv(url, 3600);
  const c = masCercana(filas, p, true);
  if (!c) return new Map<string, number>();
  return new Map(filas.filter((f) => f.lat === c.lat && f.lon === c.lon).map((f) => [f.time.slice(0, 13), f.valor]));
}

/** Olas por hora UTC para cada punto (mapa vacío si falla). Mismo orden que `points`. */
export async function getOlas(points: Point[], horas = 48): Promise<Map<string, number>[]> {
  return Promise.all(points.map((p) => olas(p, horas).catch(() => new Map<string, number>())));
}
