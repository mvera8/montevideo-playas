import "server-only";
import { unstable_cache } from "next/cache";

// Cliente de Montevideo API (Intendencia de Montevideo).
// Docs: https://api.montevideo.gub.uy/apidocs/beaches
// Auth: OAuth2 client_credentials. El token dura ~5 minutos.

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
  healthFlag?: boolean | null;
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
