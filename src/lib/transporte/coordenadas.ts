export type PuntoValido = { lat: number; lon: number };

// Punto válido solo si cae en el área metropolitana de Montevideo.
export function validarPunto(v: unknown): PuntoValido | null {
  if (!v || typeof v !== "object") return null;
  const { lat, lon } = v as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -35.0 || lat > -34.6 || lon < -56.55 || lon > -55.85) return null;
  return { lat, lon };
}

/**
 * Lee el cuerpo JSON de una solicitud con coordenadas.
 * Las ubicaciones viajan en el cuerpo (POST), nunca en la URL, para que no queden
 * en registros de acceso, historiales ni cachés.
 */
export async function leerCuerpo(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const json = await req.json();
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

// Respuestas que dependen de la ubicación: nunca cachear.
export const SIN_CACHE = { "Cache-Control": "no-store" };
