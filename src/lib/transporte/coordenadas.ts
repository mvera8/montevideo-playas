// "lat,lon" → punto, solo si cae en el área metropolitana de Montevideo.
export function parsePunto(valor: string | null) {
  const [lat, lon] = (valor ?? "").split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -35.0 || lat > -34.6 || lon < -56.55 || lon > -55.85) return null;
  return { lat, lon };
}
