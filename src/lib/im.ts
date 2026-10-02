import "server-only";

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

export function hasImCredentials() {
  return Boolean(process.env.IM_CLIENT_ID && process.env.IM_CLIENT_SECRET);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const clientId = process.env.IM_CLIENT_ID;
  const clientSecret = process.env.IM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ImConfigError(
      "Faltan IM_CLIENT_ID / IM_CLIENT_SECRET en .env.local",
    );
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
  cachedToken = { value: json.access_token, expiresAt: Date.now() + ttl };
  return json.access_token;
}

async function imGet<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (res.status === 401) cachedToken = null;
  if (!res.ok) {
    throw new Error(`IM ${path} falló (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function getImLifeguardStations() {
  return imGet<ImLifeguardStation[]>("/beaches/lifeguardstations");
}
