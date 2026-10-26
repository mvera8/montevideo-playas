// Snapshot de las casillas de guardavidas (ubicación, nombre, playa; SIN banderas) en src/data/casillas.json.
// Lo usa src/lib/playas.ts cuando el servidor no llega a la IM (desde 10/2026 la IM filtra las IP de fuera
// de Uruguay y Vercel no tiene región acá): el mapa arma igual las playas reales y el navegador completa las
// banderas pidiéndolas a la IM (src/lib/banderas-cliente.ts).
//
// Correr desde una conexión en Uruguay: `npm run casillas`. Volver a correrlo si la IM agrega, saca o
// mueve casillas (pasa poco, alguna vez por temporada) y después `npm run orientaciones` si hay nuevas.
// Fuente: https://m.montevideo.gub.uy/playas/api/casillas (GeoJSON público, sin auth, ~3 KB; mismos `id`
// que la API oficial).

import { writeFile } from "node:fs/promises";

const URL_CASILLAS = "https://m.montevideo.gub.uy/playas/api/casillas";
const DESTINO = new URL("../src/data/casillas.json", import.meta.url);

const res = await fetch(URL_CASILLAS, { signal: AbortSignal.timeout(15_000) });
if (!res.ok) throw new Error(`La IM respondió ${res.status}`);
const { features } = await res.json();
if (!Array.isArray(features) || features.length === 0) throw new Error("La IM no devolvió casillas");

const casillas = features
  .map(({ properties: p, geometry: g }) => ({
    id: p.id,
    name: p.name,
    address: p.address || null,
    beach: p.beach,
    linkComoIr: p.linkComoIr || null,
    location: { type: "Point", coordinates: g.coordinates.slice(0, 2) },
  }))
  .sort((a, b) => a.id.localeCompare(b.id, "es", { numeric: true }));

const generado = new Date().toISOString().slice(0, 10);
await writeFile(DESTINO, JSON.stringify({ generado, fuente: URL_CASILLAS, casillas }, null, 2) + "\n");
console.log(`${casillas.length} casillas → src/data/casillas.json (${generado})`);
