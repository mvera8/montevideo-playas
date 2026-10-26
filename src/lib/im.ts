import "server-only";
import { unstable_cache } from "next/cache";

// Cliente de Montevideo API (Intendencia de Montevideo).
// Docs: https://api.montevideo.gub.uy/apidocs/beaches
// Auth: OAuth2 client_credentials. El token dura ~5 minutos.
//
// Vencimientos de las banderas: la API oficial NO trae `healthFlagExpiration` ni
// `safetyFlagExpiration` (verificado 08/10/2026). Se toman del endpoint que usa el sitio móvil de la IM,
// https://m.montevideo.gub.uy/playas/api/casillas: GeoJSON público (sin auth), ~2,7 KB con gzip,
// ~0,1 s, `cache-control: no-cache`, sin ETag. Mismos `id` de casilla que la API. No está documentado:
// si falla o cambia, se sigue con la API sola (sin vencimientos → solo vale la temporada).
// `healthFlag` llega como texto ("true"/"false") en ambos endpoints, no como booleano.

const API_BASE = "https://api.montevideo.gub.uy/api/environment";
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

async function imGetSinCache(path: string): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 401) invalidarToken("playas");
  if (!res.ok) {
    throw new Error(`IM ${path} falló (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// 5 min compartidos entre todas las instancias. Con `next: { revalidate }` en el fetch el token
// (header Authorization) quedaba en la clave del cache: cada instancia y cada token nuevo (~5 min)
// era un pedido más a la IM. Los errores no se cachean.
const imGetCacheado = unstable_cache(imGetSinCache, ["im-get-v1"], { revalidate: 300 });

function imGet<T>(path: string): Promise<T> {
  return imGetCacheado(path) as Promise<T>;
}

export function getImLifeguardStations() {
  return imGet<ImLifeguardStation[]>("/beaches/lifeguardstations");
}

export const URL_CASILLAS_MOVIL = "https://m.montevideo.gub.uy/playas/api/casillas";

export type VencimientoIm = {
  healthFlagExpiration: string | null;
  healthFlagCauseLongDesc: string | null; // "Se recomienda no bañarse en las 24hs posteriores a lluvias."
  safetyFlagExpiration: string | null;
};

type CasillaMovil = { properties: { id: string } & Partial<Record<keyof VencimientoIm, string | null>> };

async function getVencimientosSinCache(): Promise<Record<string, VencimientoIm>> {
  const res = await fetch(URL_CASILLAS_MOVIL, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`IM casillas (sitio móvil) falló (${res.status})`);
  const { features } = (await res.json()) as { features: CasillaMovil[] };
  return Object.fromEntries(
    features.map(({ properties: p }) => [
      p.id,
      {
        healthFlagExpiration: p.healthFlagExpiration ?? null,
        healthFlagCauseLongDesc: p.healthFlagCauseLongDesc || null,
        safetyFlagExpiration: p.safetyFlagExpiration ?? null,
      },
    ]),
  );
}

// Mismo TTL que la API (5 min): la IM cambia la bandera sanitaria en el día (p. ej. tras lluvias).
const getVencimientosCacheado = unstable_cache(getVencimientosSinCache, ["im-vencimientos-v1"], { revalidate: 300 });

/** Vencimientos de las banderas por id de casilla; null si el sitio móvil de la IM no responde. */
export async function getImVencimientos(): Promise<Record<string, VencimientoIm> | null> {
  try {
    return await getVencimientosCacheado();
  } catch (e) {
    console.error(e);
    return null;
  }
}

// UV medido. Lo usa el sitio móvil de la IM (https://m.montevideo.gub.uy/playas/api/clima): JSON público,
// sin auth ni ETag, 369 B, ~0,05 s, `cache-control: no-cache` (verificado 20/10/2026). Trae
// `ValorIndiceUV { value, dateIssued }` (un solo valor para la ciudad) y también temperatura actual y
// mín/máx del día, que no usamos (el clima sale de MET Norway). No está documentado: si falla o cambia de
// forma, se muestra solo el máximo estimado de MET. Es "TemepraturaActual", con la errata, en la respuesta.
export const URL_CLIMA_MOVIL = "https://m.montevideo.gub.uy/playas/api/clima";
/** Un UV con más horas que esto no se muestra como actual (la IM lo actualiza cada 5 min, medido 20/10/2026). */
export const HORAS_VIGENCIA_UV = 1;

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
