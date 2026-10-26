// Copia del GTFS del STM en Supabase Storage (bucket público `gtfs`), para "Cómo ir" cuando el servidor no
// llega a la IM (desde 10/2026 la IM filtra las IP de fuera de Uruguay y Vercel no tiene región acá).
// src/lib/transporte/gtfs.ts la usa si la API de la IM falla. README → "Cómo ir en ómnibus".
//
// Correr desde una conexión en Uruguay: `npm run gtfs`. La IM publica versión nueva seguido y cada una trae
// `feed_end_date` (~1 mes): correrlo al menos una vez por mes, o cuando /estado diga "Datos viejos".
// Necesita en .env.local: IM_TRANSPORTE_CLIENT_ID / IM_TRANSPORTE_CLIENT_SECRET (bajar de la IM),
// NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (subir; la secreta solo local, nunca en Vercel).
//
// Sube `google_transit-<versión>.zip` (~17 MB) y `version.json` ({ version, archivo, hasta, subido }), que
// apunta al zip. El nombre versionado evita que el CDN de Supabase sirva un zip viejo con un version.json
// nuevo. Deja solo las 2 últimas versiones.

import { strFromU8, unzipSync } from "fflate";

const TOKEN_URL = process.env.IM_TOKEN_URL || "https://mvdapi-auth.montevideo.gub.uy/auth/realms/pci/protocol/openid-connect/token";
const GTFS = "https://api.montevideo.gub.uy/api/transportepublico/buses/gtfs/static/latest";
const BUCKET = "gtfs";

const { IM_TRANSPORTE_CLIENT_ID: id, IM_TRANSPORTE_CLIENT_SECRET: secreto, NEXT_PUBLIC_SUPABASE_URL: sb, SUPABASE_SECRET_KEY: clave } = process.env;
if (!id || !secreto || !sb || !clave) {
  console.error("Faltan IM_TRANSPORTE_CLIENT_ID/SECRET, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local.");
  process.exit(1);
}

async function ok(res, que) {
  if (!res.ok) throw new Error(`${que}: ${res.status} ${await res.text()}`);
  return res;
}

// 1. Bajar de la IM
const { access_token } = await (
  await ok(
    await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secreto }),
      signal: AbortSignal.timeout(15_000),
    }),
    "Token IM (¿estás en Uruguay?)",
  )
).json();
const auth = { Authorization: `Bearer ${access_token}` };
const version = (await (await ok(await fetch(`${GTFS}/version.txt`, { headers: auth }), "version.txt")).text()).trim();
const zip = new Uint8Array(await (await ok(await fetch(`${GTFS}/google_transit.zip`, { headers: auth }), "google_transit.zip")).arrayBuffer());

// feed_end_date: hasta cuándo valen los horarios (YYYYMMDD → YYYY-MM-DD).
const info = strFromU8(unzipSync(zip, { filter: (f) => f.name === "feed_info.txt" })["feed_info.txt"] ?? new Uint8Array());
const [cab, fila] = info.trim().split(/\r?\n/).map((l) => l.split(",").map((c) => c.replace(/^"|"$/g, "")));
const fin = fila?.[cab?.indexOf("feed_end_date")] ?? "";
const hasta = /^\d{8}$/.test(fin) ? `${fin.slice(0, 4)}-${fin.slice(4, 6)}-${fin.slice(6)}` : null;

// 2. Subir a Supabase Storage
const h = { apikey: clave, Authorization: `Bearer ${clave}` };
const crear = await fetch(`${sb}/storage/v1/bucket`, {
  method: "POST",
  headers: { ...h, "Content-Type": "application/json" },
  body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 50 * 1024 * 1024 }),
});
if (!crear.ok && !/already exists|Duplicate/i.test(await crear.text())) throw new Error(`Crear bucket: ${crear.status}`);

const subir = (nombre, cuerpo, tipo, cache) =>
  fetch(`${sb}/storage/v1/object/${BUCKET}/${nombre}`, {
    method: "POST",
    headers: { ...h, "Content-Type": tipo, "x-upsert": "true", "cache-control": `max-age=${cache}` },
    body: cuerpo,
  }).then((r) => ok(r, `Subir ${nombre}`));

const archivo = `google_transit-${version}.zip`;
await subir(archivo, zip, "application/zip", 31_536_000); // inmutable: el nombre cambia con la versión
await subir("version.json", JSON.stringify({ version, archivo, hasta, subido: new Date().toISOString() }), "application/json", 60);

// 3. Limpiar: solo las 2 últimas versiones
const lista = await (
  await ok(
    await fetch(`${sb}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 100, sortBy: { column: "name", order: "desc" } }),
    }),
    "Listar",
  )
).json();
const viejos = lista.map((o) => o.name).filter((n) => /^google_transit-.+\.zip$/.test(n)).sort().reverse().slice(2);
if (viejos.length)
  await ok(
    await fetch(`${sb}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: viejos }),
    }),
    "Borrar viejos",
  );

console.log(`GTFS ${version} (${(zip.length / 1e6).toFixed(1)} MB, vale hasta ${hasta ?? "?"}) → ${sb}/storage/v1/object/public/${BUCKET}/${archivo}`);
if (viejos.length) console.log(`Borrados: ${viejos.join(", ")}`);
