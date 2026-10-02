import "server-only";

// Clima vía Open-Meteo (gratis, sin API key). La IM no publica una API de clima.
// Forecast: temperatura del aire, viento, UV. Marine: temperatura del agua y olas.

export const MONTEVIDEO = { lat: -34.9011, lon: -56.1645 };
const TZ = "America/Montevideo";

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

type ForecastResponse = {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    weather_code: number;
    uv_index: number;
    is_day: number;
  };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
};

type MarineResponse = {
  current: { sea_surface_temperature: number | null; wave_height: number | null };
};

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
  80: "Chaparrones leves",
  81: "Chaparrones",
  82: "Chaparrones fuertes",
  95: "Tormenta",
  96: "Tormenta con granizo",
  99: "Tormenta fuerte con granizo",
};

const DIRS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

function windLabel(deg: number) {
  return DIRS[Math.round(deg / 45) % 8];
}

// Open-Meteo devuelve un objeto para 1 punto y un array para varios.
async function openMeteo<T>(base: string, points: Point[], params: Record<string, string>) {
  const qs = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(4)).join(","),
    longitude: points.map((p) => p.lon.toFixed(4)).join(","),
    timezone: TZ,
    ...params,
  });
  const res = await fetch(`${base}?${qs}`, { next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`Open-Meteo falló (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as T | T[];
  return Array.isArray(json) ? json : [json];
}

/** Clima para varios puntos en 2 requests (forecast + marine). Mismo orden que `points`. */
export async function getWeatherForPoints(points: Point[]): Promise<Weather[]> {
  if (points.length === 0) return [];

  const [forecasts, marines] = await Promise.all([
    openMeteo<ForecastResponse>("https://api.open-meteo.com/v1/forecast", points, {
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,uv_index,is_day",
      daily: "temperature_2m_max,temperature_2m_min",
      forecast_days: "1",
    }),
    // Si la API marina falla, seguimos sin temperatura del agua.
    openMeteo<MarineResponse>("https://marine-api.open-meteo.com/v1/marine", points, {
      current: "sea_surface_temperature,wave_height",
    }).catch(() => [] as MarineResponse[]),
  ]);

  return forecasts.map((f, i) => {
    const c = f.current;
    const m = marines[i]?.current;
    return {
      time: c.time,
      airTemp: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      windDirection: c.wind_direction_10m,
      windDirectionLabel: windLabel(c.wind_direction_10m),
      uvIndex: c.uv_index,
      weatherCode: c.weather_code,
      description: WMO[c.weather_code] ?? "—",
      isDay: c.is_day === 1,
      min: f.daily.temperature_2m_min[0],
      max: f.daily.temperature_2m_max[0],
      waterTemp: m?.sea_surface_temperature ?? null,
      waveHeight: m?.wave_height ?? null,
    };
  });
}

export async function getMontevideoWeather() {
  const [w] = await getWeatherForPoints([MONTEVIDEO]);
  return w;
}
