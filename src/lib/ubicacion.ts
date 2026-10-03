// Redondea a 3 decimales (~100 m): alcanza para planificar y minimiza el dato que se envía.
export const redondear = (p: { lat: number; lon: number }) => ({
  lat: Math.round(p.lat * 1000) / 1000,
  lon: Math.round(p.lon * 1000) / 1000,
});

export function postJson(url: string, cuerpo: unknown, signal?: AbortSignal) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal,
  });
}
