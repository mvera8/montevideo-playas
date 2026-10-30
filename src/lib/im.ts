import "server-only";
import { unstable_cache } from "next/cache";
import { HORAS_VIGENCIA_UV, URL_CASILLAS_MOVIL, URL_CLIMA_MOVIL } from "./banderas";

// Casillas y banderas: endpoint público del sitio móvil de la IM,
// https://m.montevideo.gub.uy/playas/api/casillas: GeoJSON sin auth, ~2,7 KB con gzip, ~0,1 s,
// `cache-control: no-cache`, sin ETag. No está documentado. Trae lo mismo que la API oficial, y además los
// vencimientos y la recomendación. `healthFlag` llega como texto ("true"/"false"), no como booleano.
// Por eso las playas no gastan el cupo de la API (429 "Usage limit exceeded", ver README): lo fijo también
// está en src/data/casillas.json, y lo único que cambia en el día son las banderas.
//
// Montevideo API (transporte y `npm run orientaciones`): OAuth2 client_credentials. El token dura ~5 minutos.
// Docs: https://api.montevideo.gub.uy/apidocs/

const DEFAULT_TOKEN_URL =
  "https://mvdapi-auth.montevideo.gub.uy/auth/realms/pci/protocol/openid-connect/token";

export type GeoPoint = { type: "Point"; coordinates: [number, number] | [number, number, number] };

export type SafetyFlag = "red" | "yellow" | "green" | "black" | "noData";

export type ImLifeguardStation = {
  id: string;
  name: string;
  address?: string;
  beach: string;
  healthFlag?: boolean | "true" | "false" | null; // en la práctica, texto
  healthFlagCause?: number | null;
  healthFlagCauseDesc?: string | null;
  healthFlagCauseLongDesc?: string | null;
  healthFlagExpiration?: string | null;
  safetyFlag?: SafetyFlag | null;
  safetyFlagExpiration?: string | null;
  linkComoIr?: string | null;
  location: GeoPoint;
};

export class ImConfigError extends Error {}

// Cada aplicación del portal de la IM está asociada a un solo servicio,
// así que Playas y Transporte usan credenciales distintas.
export type ImServicio = "playas" | "transporte";

const CREDENCIALES: Record<ImServicio, { id: string; secret: string }> = {
  playas: { id: "IM_CLIENT_ID", secret: "IM_CLIENT_SECRET" },
  transporte: { id: "IM_TRANSPORTE_CLIENT_ID", secret: "IM_TRANSPORTE_CLIENT_SECRET" },
};

export function hasImCredentials(servicio: ImServicio = "playas") {
  const c = CREDENCIALES[servicio];
  return Boolean(process.env[c.id] && process.env[c.secret]);
}

const tokens = new Map<ImServicio, { value: string; expiresAt: number }>();

export function invalidarToken(servicio: ImServicio) {
  tokens.delete(servicio);
}

export async function getToken(servicio: ImServicio = "playas"): Promise<string> {
  const cached = tokens.get(servicio);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const c = CREDENCIALES[servicio];
  const clientId = process.env[c.id];
  const clientSecret = process.env[c.secret];
  if (!clientId || !clientSecret) {
    throw new ImConfigError(`Faltan ${c.id} / ${c.secret} en .env.local`);
  }

  const res = await fetch(process.env.IM_TOKEN_URL || DEFAULT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    // Sin `cache: "no-store"`: forzaría render dinámico. Los POST no se cachean igual.
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Token IM falló (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  // Renovamos 30s antes de que expire.
  const ttl = Math.max((json.expires_in ?? 300) - 30, 30) * 1000;
  tokens.set(servicio, { value: json.access_token, expiresAt: Date.now() + ttl });
  return json.access_token;
}

type CasillaMovil = { geometry: GeoPoint; properties: Omit<ImLifeguardStation, "location"> };

async function getCasillasSinCache(): Promise<ImLifeguardStation[]> {
  const res = await fetch(URL_CASILLAS_MOVIL, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`IM casillas (sitio móvil) falló (${res.status})`);
  const { features } = (await res.json()) as { features: CasillaMovil[] };
  if (!Array.isArray(features) || !features.length) throw new Error("IM casillas (sitio móvil): sin casillas");
  return features.map((f) => ({ ...f.properties, location: f.geometry }));
}

// 5 min: la IM cambia la bandera sanitaria en el día (p. ej. tras lluvias). Los errores no se cachean.
const getCasillasCacheado = unstable_cache(getCasillasSinCache, ["im-casillas-v1"], { revalidate: 300 });

// Un solo pedido en curso, y una pausa si falla: el build genera muchas páginas a la vez, y desde Vercel la IM
// no contesta (cada página esperaría el timeout). En globalThis porque cada ruta puede cargar su copia del módulo.
const PAUSA_FALLA = 60_000;
const compartido = globalThis as unknown as { __imCasillas?: { enCurso?: Promise<ImLifeguardStation[]>; pausaHasta: number } };
const casillasIm = (compartido.__imCasillas ??= { pausaHasta: 0 });

/** Casillas con sus banderas (sin filtrar por vigencia, ver `banderasDe`). Falla si la IM no responde. */
export function getImCasillas(): Promise<ImLifeguardStation[]> {
  if (Date.now() < casillasIm.pausaHasta) return Promise.reject(new Error("IM casillas: en pausa tras una falla"));
  casillasIm.enCurso ??= getCasillasCacheado()
    .catch((e) => {
      casillasIm.pausaHasta = Date.now() + PAUSA_FALLA;
      throw e;
    })
    .finally(() => {
      casillasIm.enCurso = undefined;
    });
  return casillasIm.enCurso;
}

// UV medido. Lo usa el sitio móvil de la IM (https://m.montevideo.gub.uy/playas/api/clima): JSON público,
// sin auth ni ETag, 369 B, ~0,05 s, `cache-control: no-cache` (verificado 20/10/2026). Trae
// `ValorIndiceUV { value, dateIssued }` (un solo valor para la ciudad) y también temperatura actual y
// mín/máx del día, que no usamos (el clima sale de MET Norway). No está documentado: si falla o cambia de
// forma, se muestra solo el máximo estimado de MET. Es "TemepraturaActual", con la errata, en la respuesta.
// La URL está en banderas.ts: si el servidor no llega a la IM, la pide el navegador.

export type UvIm = { valor: number; fecha: string };

async function getUvSinCache(): Promise<UvIm | null> {
  const res = await fetch(URL_CLIMA_MOVIL, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`IM clima (sitio móvil) falló (${res.status})`);
  const uv = ((await res.json()) as { ValorIndiceUV?: { value?: unknown; dateIssued?: unknown } }).ValorIndiceUV;
  if (typeof uv?.value !== "number" || typeof uv.dateIssued !== "string" || Number.isNaN(Date.parse(uv.dateIssued))) return null;
  return { valor: uv.value, fecha: uv.dateIssued };
}

// Mismo ritmo que la IM (5 min) y que el ISR de /playas.
const getUvCacheado = unstable_cache(getUvSinCache, ["im-uv-v1"], { revalidate: 300 });

/** UV medido por la IM; null si no responde o si el dato tiene más de `HORAS_VIGENCIA_UV`. */
export async function getImUv(): Promise<UvIm | null> {
  try {
    const uv = await getUvCacheado();
    return uv && Date.now() - Date.parse(uv.fecha) <= HORAS_VIGENCIA_UV * 3_600_000 ? uv : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}
