// MapLibre v6 carga su web worker como un módulo aparte. Lo copiamos a /public
// para servirlo como archivo estático (ver setWorkerUrl en Mapa.tsx).
import { cpSync, mkdirSync } from "node:fs";

const dist = "node_modules/maplibre-gl/dist";
const destino = "public/maplibre";
mkdirSync(destino, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(`${dist}/${f}`, `${destino}/${f}`);
}
