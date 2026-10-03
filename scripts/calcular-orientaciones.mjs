// Calcula hacia dónde está el agua desde cada casilla de guardavidas y lo guarda en
// src/data/orientaciones.json. La costa no cambia, así que se corre a mano (no en runtime):
//
//   npm run orientaciones
//
// Correrlo de nuevo si la IM agrega o mueve casillas (las nuevas usan la tabla por playa
// de src/lib/recomendacion.ts como respaldo hasta entonces).
//
// Método: línea de costa de OpenStreetMap (natural=coastline). Por convención de OSM el
// agua queda a la DERECHA del sentido del trazo, así que la normal derecha del tramo más
// cercano a la casilla apunta al agua.

import { writeFileSync, mkdirSync } from "node:fs";

const TOKEN_URL = "https://mvdapi-auth.montevideo.gub.uy/auth/realms/pci/protocol/openid-connect/token";
const CASILLAS_URL = "https://api.montevideo.gub.uy/api/environment/beaches/lifeguardstations";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const BBOX = "-34.95,-56.45,-34.83,-56.02";
const SALIDA = "src/data/orientaciones.json";

const M_LAT = 110_540;
const M_LON = 111_320 * Math.cos((-34.9 * Math.PI) / 180);

async function casillas() {
  if (!process.env.IM_CLIENT_ID) throw new Error("Faltan credenciales: correr con --env-file=.env.local");
  const tok = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.IM_CLIENT_ID,
      client_secret: process.env.IM_CLIENT_SECRET,
    }),
  }).then((r) => r.json());
  const res = await fetch(CASILLAS_URL, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!res.ok) throw new Error(`Casillas IM: ${res.status}`);
  return res.json();
}

// Overpass público se satura seguido (504): reintentos con espera creciente.
async function costa() {
  const q = `[out:json][timeout:60];way["natural"="coastline"](${BBOX});out geom;`;
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": "PlayasUY/1.0" },
      body: new URLSearchParams({ data: q }),
    });
    if (res.ok) return (await res.json()).elements;
    console.warn(`Overpass ${res.status}, reintento ${i}/5…`);
    await new Promise((r) => setTimeout(r, 15_000 * i));
  }
  throw new Error("Overpass no respondió");
}

function haciaElAgua(lat, lon, tramos) {
  const px = lon * M_LON, py = lat * M_LAT;
  let mejor = null;
  for (const w of tramos)
    for (let k = 0; k < w.geometry.length - 1; k++) {
      const a = w.geometry[k], b = w.geometry[k + 1];
      const ax = a.lon * M_LON, ay = a.lat * M_LAT;
      const vx = b.lon * M_LON - ax, vy = b.lat * M_LAT - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
      const d = Math.hypot(ax + vx * t - px, ay + vy * t - py);
      if (!mejor || d < mejor.d) mejor = { d, vx, vy };
    }
  // Normal derecha del tramo (este, norte) = (vy, -vx) → rumbo en grados desde el norte.
  const rumbo = (Math.atan2(mejor.vy, -mejor.vx) * 180) / Math.PI;
  return { rumbo: Math.round((rumbo + 360) % 360), metrosCosta: Math.round(mejor.d) };
}

const [lista, tramos] = await Promise.all([casillas(), costa()]);
const salida = {
  generado: new Date().toISOString().slice(0, 10),
  fuente: "Línea de costa de OpenStreetMap (natural=coastline) y casillas de la Intendencia de Montevideo",
  casillas: {},
};
for (const c of lista) {
  const [lon, lat] = c.location.coordinates;
  const o = haciaElAgua(-Math.abs(lat), -Math.abs(lon), tramos);
  salida.casillas[c.id] = { nombre: c.name, ...o };
  // Una casilla muy lejos de la costa indicaría un dato raro: avisar.
  const aviso = o.metrosCosta > 300 ? "  ⚠ lejos de la costa, revisar" : "";
  console.log(`${c.name.padEnd(22)} ${String(o.rumbo).padStart(3)}°  a ${o.metrosCosta} m de la costa${aviso}`);
}
mkdirSync("src/data", { recursive: true });
writeFileSync(SALIDA, JSON.stringify(salida, null, 2) + "\n");
console.log(`\n${lista.length} casillas → ${SALIDA}`);
