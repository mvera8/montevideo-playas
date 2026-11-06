// Copia de los baños, bebederos y duchas en src/data/servicios.json. Lo usa src/lib/servicios.ts para arrancar
// cada instancia: desde 10/2026 la IM filtra las IP de fuera de Uruguay (Vercel no tiene región acá) y los
// servidores públicos de Overpass se caen seguido, así que sin copia el mapa podía quedar sin servicios.
//
// Correr desde una conexión en Uruguay: `npm run servicios`. Cambian poco: correrlo al empezar cada temporada
// (y cuando la IM avise de baños nuevos). /estado marca la copia como vieja a los 180 días.
// - IM: los zip del servidor GIS tal cual (base64, ~16 KB en total), para procesarlos con el mismo código
//   que en vivo. Antes se pide generar_zip2.php para que el zip de /sit/tmp esté al día.
// - OSM: los elementos de la consulta de servicios.ts (misma consulta), del primer servidor que responda.
// Si una fuente falla se conserva la que ya había en el archivo (y se avisa): fuera de Uruguay se puede
// actualizar igual la parte de OSM.

import { readFile, writeFile } from "node:fs/promises";

const GIS = "https://intgis.montevideo.gub.uy/sit";
const TABLAS = ["v_ep_banios", "v_ep_bebederos"];
// Mismos servidores y consulta que src/lib/servicios.ts (OVERPASS, CONSULTA_OSM).
const OVERPASS = [
  { nombre: "Alemania", url: "https://overpass-api.de/api/interpreter" },
  { nombre: "Francia", url: "https://overpass.openstreetmap.fr/api/interpreter" },
];
const BBOX = "-34.95,-56.45,-34.83,-56.02";
const CONSULTA = `[out:json][timeout:25];nwr["amenity"~"^(toilets|drinking_water|shower)$"](${BBOX});out center meta;`;
const DESTINO = new URL("../src/data/servicios.json", import.meta.url);
const hoy = new Date().toISOString().slice(0, 10);

const anterior = await readFile(DESTINO, "utf8").then(JSON.parse, () => ({ im: null, osm: null }));

async function bajarIm() {
  const zips = {};
  for (const t of TABLAS) {
    await fetch(`${GIS}/php/common/datos/generar_zip2.php?nom_tab=${t}&tipo=gis`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    const res = await fetch(`${GIS}/tmp/${t}.zip`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`${t}: ${res.status}`);
    zips[t] = Buffer.from(await res.arrayBuffer()).toString("base64");
  }
  return { generado: hoy, zips };
}

async function bajarOsm() {
  const errores = [];
  for (const { nombre, url } of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "PlayasUY/1.0 (mapa de playas de Montevideo)" },
        body: new URLSearchParams({ data: CONSULTA }),
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      if (!Array.isArray(json.elements) || !json.elements.length) throw new Error("sin elementos");
      const elementos = json.elements.map(({ type, id, lat, lon, center, timestamp, tags }) => ({ type, id, lat, lon, center, timestamp, tags }));
      return { generado: hoy, servidor: nombre, base: json.osm3s?.timestamp_osm_base ?? null, elementos };
    } catch (e) {
      errores.push(`${nombre}: ${e.message}`);
    }
  }
  throw new Error(errores.join("; "));
}

const [im, osm] = await Promise.allSettled([bajarIm(), bajarOsm()]);
if (im.status === "rejected") console.warn(`IM no respondió (${im.reason.message}); queda la copia del ${anterior.im?.generado ?? "—"}.`);
if (osm.status === "rejected") console.warn(`Overpass no respondió (${osm.reason.message}); queda la copia del ${anterior.osm?.generado ?? "—"}.`);
if (im.status === "rejected" && osm.status === "rejected") process.exit(1);

const datos = {
  im: im.status === "fulfilled" ? im.value : anterior.im,
  osm: osm.status === "fulfilled" ? osm.value : anterior.osm,
};
await writeFile(DESTINO, JSON.stringify(datos) + "\n");
console.log(
  [
    im.status === "fulfilled" && `IM: ${TABLAS.length} capas`,
    osm.status === "fulfilled" && `OSM: ${datos.osm.elementos.length} elementos (${datos.osm.servidor}, datos al ${datos.osm.base ?? "?"})`,
  ]
    .filter(Boolean)
    .join(" · ") + " → src/data/servicios.json",
);
