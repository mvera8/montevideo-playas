import "server-only";

import { getOlas, getTemperaturaAgua } from "./mar";
import type { Hora } from "./recomendacion";

// Clima vía MET Norway (Instituto Meteorológico de Noruega), Locationforecast 2.0 "complete".
// La IM no publica una API de clima.
//
// - URL: https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=..&lon=.. (JSON, un punto
//   por pedido, máx. 4 decimales). Sin API key, gratis y con uso comercial permitido (datos CC BY 4.0,
//   hay que citar a MET Norway). Términos: https://api.met.no/doc/TermsOfService
// - Exige un User-Agent que identifique la app y un contacto (si no, responde 403). Pide no pasar de
//   20 pedidos/s y respetar `Expires` (~30 min): cacheamos 30 min y redondeamos los puntos a 0,05°
//   para que varias playas compartan pedido (la grilla global del modelo es de ~9 km).
// - Trae ~60 h hora a hora y después cada 6 h, con horas en UTC (las pasamos a hora de Montevideo).
// - Fuera de Noruega NO trae: ráfagas, probabilidad de lluvia (sí milímetros por hora), UV real (solo
//   `ultraviolet_index_clear_sky`, el UV con cielo despejado: es el máximo posible), mar ni
//   amanecer/atardecer. El mar sale de NOAA (ver `mar.ts`); amanecer y atardecer se calculan acá.
// - El estado del cielo viene como `symbol_code` ("partlycloudy_day"); lo traducimos a códigos WMO
//   para que el resto de la app no dependa del proveedor.

export const MONTEVIDEO = { lat: -34.9011, lon: -56.1645 };
const TZ = "America/Montevideo";
const USER_AGENT = "PlayasUY/0.1 (+https://github.com/mvera8/montevideo-playas)";

export type Weather = {
  time: string;
  airTemp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windDirectionLabel: string;
  uvIndex: number;
  weatherCode: number;
  description: string;
  isDay: boolean;
  min: number;
  max: number;
  waterTemp: number | null;
  waveHeight: number | null;
};

type Point = { lat: number; lon: number };

type MetPaso = {
  time: string; // UTC
  data: {
    instant: {
      details: {
        air_temperature: number;
        apparent_air_temperature?: number;
        relative_humidity: number;
        wind_speed: number; // m/s
        wind_from_direction: number;
        ultraviolet_index_clear_sky?: number;
      };
    };
    next_1_hours?: { summary: { symbol_code: string }; details: { precipitation_amount?: number } };
    next_6_hours?: { summary: { symbol_code: string }; details: { precipitation_amount?: number } };
  };
};

type MetResponse = { properties: { timeseries: MetPaso[] } };

const WMO: Record<number, string> = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla con escarcha",
  51: "Llovizna leve",
  53: "Llovizna",
  55: "Llovizna intensa",
  61: "Lluvia leve",
  63: "Lluvia",
  65: "Lluvia intensa",
  71: "Nevada leve",
  73: "Nevada",
  75: "Nevada intensa",
  80: "Chaparrones leves",
  81: "Chaparrones",
  82: "Chaparrones fuertes",
  95: "Tormenta",
  96: "Tormenta con granizo",
  99: "Tormenta fuerte con granizo",
};

// symbol_code de MET (sin _day/_night) → código WMO. Aguanieve se trata como lluvia.
const SIMBOLO: Record<string, number> = {
  clearsky: 0,
  fair: 1,
  partlycloudy: 2,
  cloudy: 3,
  fog: 45,
  lightrain: 61,
  rain: 63,
  heavyrain: 65,
  lightsleet: 61,
  sleet: 63,
  heavysleet: 65,
  lightsnow: 71,
  snow: 73,
  heavysnow: 75,
  lightrainshowers: 80,
  rainshowers: 81,
  heavyrainshowers: 82,
  lightsleetshowers: 80,
  sleetshowers: 81,
  heavysleetshowers: 82,
  lightsnowshowers: 71,
  snowshowers: 73,
  heavysnowshowers: 75,
};

function codigoWmo(symbol: string | undefined) {
  if (!symbol) return 3;
  const base = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (base.includes("thunder")) return 95;
  return SIMBOLO[base] ?? 3;
}

const DIRS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

function windLabel(deg: number) {
  return DIRS[Math.round(deg / 45) % 8];
}

const kmh = (ms: number) => Math.round(ms * 36) / 10;

/** Fecha/hora UTC → ISO local de Montevideo "YYYY-MM-DDTHH:mm". */
const fmtLocal = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const local = (d: Date | number) => fmtLocal.format(d).replace(" ", "T");

// ---------- amanecer y atardecer (cálculo local, ±1 min) ----------
// Ecuación del amanecer (https://en.wikipedia.org/wiki/Sunrise_equation), con refracción.

const RAD = Math.PI / 180;

/** [amanecer, atardecer] en ms UTC para el día local `fecha` ("YYYY-MM-DD"). */
function sol(fecha: string, { lat, lon }: Point): [number, number] {
  const jdMediodia = Date.parse(`${fecha}T12:00:00Z`) / 86_400_000 + 2440587.5;
  const n = Math.round(jdMediodia - 2451545 + 0.0008);
  const j = n - lon / 360;
  const m = (357.5291 + 0.98560028 * j) % 360;
  const c = 1.9148 * Math.sin(m * RAD) + 0.02 * Math.sin(2 * m * RAD) + 0.0003 * Math.sin(3 * m * RAD);
  const l = (m + c + 180 + 102.9372) % 360;
  const transito = 2451545 + j + 0.0053 * Math.sin(m * RAD) - 0.0069 * Math.sin(2 * l * RAD);
  const dec = Math.asin(Math.sin(l * RAD) * Math.sin(23.4397 * RAD));
  const w = Math.acos(
    (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(dec)) / (Math.cos(lat * RAD) * Math.cos(dec)),
  );
  const ms = (jd: number) => (jd - 2440587.5) * 86_400_000;
  return [ms(transito - w / (2 * Math.PI)), ms(transito + w / (2 * Math.PI))];
}

// ---------- MET Norway ----------

const redondear = (v: number) => (Math.round(v * 20) / 20).toFixed(2);

async function met(p: Point) {
  const qs = new URLSearchParams({ lat: redondear(p.lat), lon: redondear(p.lon) });
  const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/complete?${qs}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`MET Norway falló (${res.status}): ${await res.text()}`);
  return ((await res.json()) as MetResponse).properties.timeseries;
}

/** El paso de la hora actual (el último que ya empezó), o el primero. */
function pasoActual(ts: MetPaso[], ahora: number) {
  let actual = ts[0];
  for (const t of ts) {
    if (Date.parse(t.time) > ahora) break;
    actual = t;
  }
  return actual;
}

/** Clima actual para varios puntos. Mismo orden que `points`. */
export async function getWeatherForPoints(points: Point[]): Promise<Weather[]> {
  if (points.length === 0) return [];

  const ahora = Date.now();
  const [series, agua, olas] = await Promise.all([
    Promise.all(points.map(met)),
    // Si el mar falla, seguimos sin temperatura del agua ni olas.
    getTemperaturaAgua(points),
    getOlas(points, 1),
  ]);
  const hoy = local(ahora).slice(0, 10);

  return series.map((ts, i) => {
    const t = pasoActual(ts, ahora);
    const d = t.data.instant.details;
    const code = codigoWmo(t.data.next_1_hours?.summary.symbol_code ?? t.data.next_6_hours?.summary.symbol_code);
    // Mín/máx de lo que queda de hoy (MET no trae las horas que ya pasaron).
    const temps = ts.filter((x) => local(Date.parse(x.time)).startsWith(hoy)).map((x) => x.data.instant.details.air_temperature);
    temps.push(d.air_temperature);
    const [sale, pone] = sol(hoy, points[i]);
    return {
      time: local(Date.parse(t.time)),
      airTemp: d.air_temperature,
      feelsLike: d.apparent_air_temperature ?? d.air_temperature,
      humidity: Math.round(d.relative_humidity),
      windSpeed: kmh(d.wind_speed),
      windDirection: d.wind_from_direction,
      windDirectionLabel: windLabel(d.wind_from_direction),
      uvIndex: d.ultraviolet_index_clear_sky ?? 0,
      weatherCode: code,
      description: WMO[code] ?? "—",
      isDay: ahora >= sale && ahora < pone,
      min: Math.min(...temps),
      max: Math.max(...temps),
      waterTemp: agua[i],
      waveHeight: olas[i].get(new Date(ahora).toISOString().slice(0, 13)) ?? null,
    };
  });
}

export async function getMontevideoWeather() {
  const [w] = await getWeatherForPoints([MONTEVIDEO]);
  return w;
}

// ---------- pronóstico por hora (una playa) ----------

export type Pronostico = {
  ahora: string; // ISO local Montevideo, "YYYY-MM-DDTHH:mm"
  horas: Hora[];
  luz: [string, string][]; // [amanecer, atardecer] por día
};

/** Hoy y mañana, hora a hora, para un punto. Cacheado 30 min. */
export async function getPronostico(lat: number, lon: number): Promise<Pronostico> {
  const p = { lat, lon };
  const [ts, [olas]] = await Promise.all([met(p), getOlas([p], 48)]);

  const ahora = local(Date.now());
  const hoy = ahora.slice(0, 10);
  const manana = local(Date.parse(`${hoy}T12:00:00Z`) + 86_400_000).slice(0, 10);

  const horas: Hora[] = ts
    .filter((t) => t.data.next_1_hours && local(Date.parse(t.time)).slice(0, 10) <= manana)
    .map((t) => {
      const d = t.data.instant.details;
      return {
        hora: local(Date.parse(t.time)),
        temp: d.air_temperature,
        sensacion: d.apparent_air_temperature ?? d.air_temperature,
        lluvia: t.data.next_1_hours!.details.precipitation_amount ?? 0,
        uv: d.ultraviolet_index_clear_sky ?? 0,
        viento: kmh(d.wind_speed),
        vientoDesde: d.wind_from_direction,
        code: codigoWmo(t.data.next_1_hours!.summary.symbol_code),
        olas: olas.get(t.time.slice(0, 13)) ?? null,
      };
    });

  return {
    ahora,
    horas,
    luz: [hoy, manana].map((f) => sol(f, p).map((ms) => local(ms)) as [string, string]),
  };
}
