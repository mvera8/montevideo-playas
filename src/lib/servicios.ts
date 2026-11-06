import "server-only";
import { unzipSync } from "fflate";
import { after } from "next/server";
import copia from "@/data/servicios.json";

// Baños, bebederos y duchas públicos cerca de las playas. Dos fuentes:
// - IM, datos abiertos "Equipamiento urbano – espacios públicos" (oficial, sobre todo plazas y parques).
//   https://catalogodatos.gub.uy/dataset/equipamiento-urbano-espacios-publicos
//   El servidor GIS genera un shapefile (UTM 21S) en /sit/tmp/<tabla>.zip al pedir generar_zip2.php.
// - OpenStreetMap vía Overpass (comunitario): cubre la rambla y los baños químicos de temporada.
//   Primero el servidor principal (overpass-api.de) y, si no responde, el de Francia
//   (overpass.openstreetmap.fr: sus datos llegan con atraso, ~3 meses el 06/11/2026; ver /api/timestamp).
// Si un punto de OSM está a menos de 40 m de uno de la IM, se considera el mismo y gana la IM.
// Caché de 24 h por fuente; si una falla se usa lo último bueno de ella y se reintenta a los 5 min.
// Copia en el repo (src/data/servicios.json, `npm run servicios` desde Uruguay): es con lo que arranca cada
// instancia, así el mapa tiene servicios aunque la IM filtre las IP de Vercel y Overpass esté caído.

export const GIS = "https://intgis.montevideo.gub.uy/sit";
const CACHE_MS = 24 * 60 * 60 * 1000; // cambian muy poco
export const RADIO_SERVICIOS = 600; // metros desde la casilla más cercana
// Un dato de OSM sin verificar ni editar en más de 2 años se marca como posiblemente desactualizado.
export const DIAS_VIGENCIA_OSM = 730;
// La copia del repo y la base de un servidor de Overpass con más de esto de atraso se marcan "viejo" en /estado.
export const DIAS_VIGENCIA_COPIA = 180;

const M_LAT = 110_540;
const M_LON = 111_320 * Math.cos((-34.9 * Math.PI) / 180);

export type Servicio = {
  id: string;
  tipo: "bano" | "bebedero" | "ducha";
  fuente: "IM" | "OSM";
  lat: number;
  lon: number;
  detalle: string; // "Baño fijo · 4 gabinetes" / "Bebedero de agua potable"
  horario: string | null;
  accesible: boolean | null;
  // Fecha del dato. IM: sin fecha por punto (registro oficial que la IM regenera a diario).
  // OSM: check_date/survey:date ("verificado") o, si no hay, la última edición ("editado").
  actualizado: { fecha: string; tipo: "verificado" | "editado"; dias: number } | null;
  viejo: boolean; // actualizado hace más de DIAS_VIGENCIA_OSM
  metros?: number; // distancia a la playa (se completa por playa)
};

// ---------- UTM 21S → WGS84 ----------

function utmAWgs84(e: number, n: number, zona = 21): [number, number] {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const x = e - 500000, y = n - 10000000; // hemisferio sur
  const m = y / k0;
  const mu = m / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);
  const n1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2);
  const t1 = Math.tan(p1) ** 2;
  const c1 = ep2 * Math.cos(p1) ** 2;
  const r1 = (a * (1 - e2)) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5;
  const d = x / (n1 * k0);
  const lat =
    p1 -
    ((n1 * Math.tan(p1)) / r1) *
      (d ** 2 / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6) / 720);
  const lon =
    (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5) / 120) /
    Math.cos(p1);
  return [(lat * 180) / Math.PI, (zona * 6 - 183) + (lon * 180) / Math.PI];
}

// ---------- shapefile (puntos) + dbf ----------

function puntosShp(buf: Uint8Array): [number, number][] {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: [number, number][] = [];
  for (let i = 100; i + 8 <= buf.length; ) {
    const largo = v.getInt32(i + 4, false) * 2; // big endian, en palabras de 16 bits
    if (v.getInt32(i + 8, true) === 1) out.push([v.getFloat64(i + 12, true), v.getFloat64(i + 20, true)]);
    i += 8 + largo;
  }
  return out;
}

function filasDbf(buf: Uint8Array): Record<string, string>[] {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = v.getUint32(4, true), cab = v.getUint16(8, true), largoFila = v.getUint16(10, true);
  const dec = new TextDecoder("utf-8");
  const campos: { nombre: string; largo: number }[] = [];
  for (let i = 32; buf[i] !== 0x0d; i += 32)
    campos.push({ nombre: dec.decode(buf.subarray(i, i + 11)).split("\0")[0], largo: buf[i + 16] });
  return Array.from({ length: n }, (_, k) => {
    let p = cab + k * largoFila + 1;
    const fila: Record<string, string> = {};
    for (const c of campos) {
      fila[c.nombre] = dec.decode(buf.subarray(p, p + c.largo)).trim();
      p += c.largo;
    }
    return fila;
  });
}

const TIMEOUT_IM = 10_000;

const TABLAS_IM = ["v_ep_banios", "v_ep_bebederos"] as const;
type TablaIm = (typeof TABLAS_IM)[number];

async function bajarCapa(tabla: TablaIm) {
  // Pedir la generación (deja el zip actualizado en /sit/tmp) y luego descargarlo.
  await fetch(`${GIS}/php/common/datos/generar_zip2.php?nom_tab=${tabla}&tipo=gis`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  const res = await fetch(`${GIS}/tmp/${tabla}.zip`, { signal: AbortSignal.timeout(TIMEOUT_IM) });
  if (!res.ok) throw new Error(`Servicios IM ${tabla}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function leerCapa(tabla: TablaIm, zipBytes: Uint8Array) {
  const zip = unzipSync(zipBytes);
  const shp = Object.entries(zip).find(([k]) => k.endsWith(".shp"))?.[1];
  const dbf = Object.entries(zip).find(([k]) => k.endsWith(".dbf"))?.[1];
  if (!shp || !dbf) throw new Error(`Servicios IM ${tabla}: zip incompleto`);
  const puntos = puntosShp(shp);
  return filasDbf(dbf).map((fila, i) => ({ fila, utm: puntos[i] }));
}

const TIPO_BANO: Record<string, string> = {
  Fijos: "Baño fijo",
  Quimico: "Baño químico",
  Foster: "Baño automático",
  Pilar: "Baño automático",
  "Pilar Accesible": "Baño automático",
};

async function cargarIm(): Promise<Servicio[]> {
  const [banos, bebederos] = await Promise.all(TABLAS_IM.map(async (t) => leerCapa(t, await bajarCapa(t))));
  return serviciosIm(banos, bebederos);
}

function serviciosIm(banos: ReturnType<typeof leerCapa>, bebederos: ReturnType<typeof leerCapa>): Servicio[] {
  const out: Servicio[] = [];
  for (const { fila, utm } of banos) {
    if (fila.ACTIVO !== "Si" || !utm) continue; // solo activos
    const [lat, lon] = utmAWgs84(utm[0], utm[1]);
    const gabinetes = Number(fila.CANT_GABIN) || 0;
    out.push({
      id: `bano-${fila.GID}`,
      tipo: "bano",
      fuente: "IM",
      lat,
      lon,
      detalle: [TIPO_BANO[fila.MODELO_BAN] ?? "Baño público", gabinetes > 1 ? `${gabinetes} gabinetes` : null]
        .filter(Boolean)
        .join(" · "),
      horario: fila.HORARIO_FU || null,
      accesible: fila.ACCESIBILI === "1" ? true : fila.ACCESIBILI === "2" ? false : null,
      actualizado: null,
      viejo: false,
    });
  }
  for (const { fila, utm } of bebederos) {
    if (fila.ACTIVO !== "Si" || !utm) continue;
    const [lat, lon] = utmAWgs84(utm[0], utm[1]);
    out.push({
      id: `bebedero-${fila.GID}`,
      tipo: "bebedero",
      fuente: "IM",
      lat,
      lon,
      detalle: /potable/i.test(fila.DESCRIPCIO) ? "Bebedero de agua potable" : "Bebedero",
      horario: null,
      accesible: null,
      actualizado: null,
      viejo: false,
    });
  }
  return out;
}

// ---------- OpenStreetMap (Overpass) ----------

// En orden: el segundo solo si el primero no responde.
export const OVERPASS = [
  { nombre: "Alemania", url: "https://overpass-api.de/api/interpreter" },
  { nombre: "Francia", url: "https://overpass.openstreetmap.fr/api/interpreter" },
] as const;
// Franja costera de Montevideo (sur, oeste, norte, este).
const BBOX = "-34.95,-56.45,-34.83,-56.02";
// La consulta pide `timeout:25` al servidor; tope por servidor (el de Francia respondió en 2,5 s, 06/11/2026).
const TIMEOUT_OVERPASS = 20_000;
// Cuánto espera un render a Overpass. Si tarda más, sigue sin frenar la página: todo getPlayas() depende
// de esto y, con Overpass saturado, cada render tardaba 30 s o más (medido 30/10/2026).
const ESPERA_OSM = 4000;

type ElementoOsm = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  timestamp?: string; // última edición (con `out meta`)
  tags: Record<string, string>;
};

type RespuestaOverpass = { servidor: string; base: string | null; elementos: ElementoOsm[] };

// Los servidores públicos de Overpass se saturan seguido (502/504/429) o no aceptan conexiones: se prueba
// cada uno una vez, en orden.
async function consultarOverpass(q: string): Promise<RespuestaOverpass> {
  const errores: string[] = [];
  for (const { nombre, url } of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "PlayasUY/1.0 (mapa de playas de Montevideo)",
        },
        body: new URLSearchParams({ data: q }),
        signal: AbortSignal.timeout(TIMEOUT_OVERPASS),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { osm3s?: { timestamp_osm_base?: string }; elements: ElementoOsm[] };
      return { servidor: nombre, base: json.osm3s?.timestamp_osm_base ?? null, elementos: json.elements };
    } catch (e) {
      errores.push(`${nombre}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(`Overpass (${errores.join("; ")})`);
}

function fechaOsm(e: ElementoOsm): Pick<Servicio, "actualizado" | "viejo"> {
  const verificado = e.tags.check_date ?? e.tags["survey:date"];
  const fecha = /^\d{4}-\d{2}(-\d{2})?/.test(verificado ?? "") ? verificado! : e.timestamp?.slice(0, 10);
  if (!fecha) return { actualizado: null, viejo: false };
  const dias = Math.floor((Date.now() - new Date(fecha.length === 7 ? `${fecha}-01` : fecha).getTime()) / 86_400_000);
  return {
    actualizado: { fecha: fecha.slice(0, 10), tipo: fecha === verificado ? "verificado" : "editado", dias },
    viejo: dias > DIAS_VIGENCIA_OSM,
  };
}

const CONSULTA_OSM = `[out:json][timeout:25];nwr["amenity"~"^(toilets|drinking_water|shower)$"](${BBOX});out center meta;`;

async function cargarOsm(): Promise<{ servicios: Servicio[]; origen: OrigenOsm }> {
  // `out center meta` agrega la fecha de última edición de cada punto.
  const { servidor, base, elementos } = await consultarOverpass(CONSULTA_OSM);
  return { servicios: serviciosOsm(elementos), origen: { tipo: "en-vivo", servidor, base } };
}

function serviciosOsm(elements: ElementoOsm[]): Servicio[] {
  const out: Servicio[] = [];
  for (const e of elements) {
    const t = e.tags;
    const fecha = fechaOsm(e);
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (lat == null || lon == null) continue;
    if (t.access === "private" || t.access === "no" || t.opening_hours === "closed") continue;
    const accesible = t.wheelchair === "yes" ? true : t.wheelchair === "no" ? false : null;
    const pago = t.fee === "yes" ? "pago" : null;
    if (t.amenity === "toilets") {
      out.push({
        id: `osm-${e.type}-${e.id}`,
        tipo: "bano",
        fuente: "OSM",
        lat,
        lon,
        detalle: [t.portable === "yes" ? "Baño químico (puede ser de temporada)" : "Baño público", pago].filter(Boolean).join(" · "),
        horario: t.opening_hours ?? null,
        accesible,
        ...fecha,
      });
    } else if (t.amenity === "drinking_water") {
      out.push({ id: `osm-${e.type}-${e.id}`, tipo: "bebedero", fuente: "OSM", lat, lon, detalle: "Bebedero", horario: null, accesible, ...fecha });
    } else if (t.amenity === "shower") {
      out.push({
        id: `osm-${e.type}-${e.id}`,
        tipo: "ducha",
        fuente: "OSM",
        lat,
        lon,
        detalle: ["Ducha", pago ?? (t.fee === "no" ? "gratis" : null)].filter(Boolean).join(" · "),
        horario: t.opening_hours ?? null,
        accesible,
        ...fecha,
      });
    }
  }
  return out;
}

// ---------- copia del repo ----------

// src/data/servicios.json (scripts/servicios.mjs): los zip de la IM tal cual (base64) y los elementos de
// Overpass, así se procesan con el mismo código que en vivo y las fechas de OSM se calculan al día de hoy.
type Copia = {
  im: { generado: string; zips: Record<TablaIm, string> } | null;
  osm: { generado: string; servidor: string; base: string | null; elementos: ElementoOsm[] } | null;
};
const COPIA = copia as unknown as Copia;

export type OrigenIm = { tipo: "en-vivo" } | { tipo: "copia"; generado: string } | null;
export type OrigenOsm = { tipo: "en-vivo"; servidor: string; base: string | null } | { tipo: "copia"; generado: string } | null;

function imDeCopia(): Servicio[] | undefined {
  if (!COPIA.im) return undefined;
  const capas = TABLAS_IM.map((t) => leerCapa(t, Uint8Array.from(Buffer.from(COPIA.im!.zips[t], "base64"))));
  return serviciosIm(capas[0], capas[1]);
}

// Si una fuente falla, se sigue con lo último que respondió de ella (o con la copia del repo) y se reintenta a
// los PAUSA_FALLA en vez de esperar las 24 h de caché: Overpass se satura seguido (502/504) y no queremos
// quedarnos un día entero sin los baños de la rambla.
const PAUSA_FALLA = 5 * 60_000;

type Estado = {
  im?: Servicio[];
  osm?: Servicio[];
  origenIm: OrigenIm;
  origenOsm: OrigenOsm;
  datos?: Servicio[];
  vence: number;
  promesa?: Promise<Servicio[]>;
  imOk?: boolean;
  osmEnCurso?: Promise<Servicio[] | null>;
};
const g = globalThis as unknown as { __servicios?: Estado };
g.__servicios ??= iniciar();
const estado = g.__servicios;

// Cada instancia arranca con la copia (vence: 0, así el primer pedido la actualiza en segundo plano).
function iniciar(): Estado {
  const e: Estado = { vence: 0, origenIm: null, origenOsm: null };
  try {
    e.im = imDeCopia();
    if (e.im) e.origenIm = { tipo: "copia", generado: COPIA.im!.generado };
    if (COPIA.osm) {
      e.osm = serviciosOsm(COPIA.osm.elementos);
      e.origenOsm = { tipo: "copia", generado: COPIA.osm.generado };
    }
  } catch (err) {
    console.error("Servicios: no se pudo leer la copia del repo", err);
  }
  return e;
}

// Falla esperable (servidor saturado o caído) y ya manejada: aviso de una línea, no un error.
const falla = (fuente: string) => (e: unknown) => {
  console.warn(`Servicios: ${fuente} no respondió (${e instanceof Error ? e.message : e}); se reintenta en 5 min.`);
  return null;
};

function combinar() {
  const oficiales = estado.im ?? [];
  const extra = (estado.osm ?? []).filter(
    (o) => !oficiales.some((s) => s.tipo === o.tipo && Math.hypot((s.lat - o.lat) * M_LAT, (s.lon - o.lon) * M_LON) < 40),
  );
  return [...oficiales, ...extra];
}
estado.datos ??= estado.im || estado.osm ? combinar() : undefined;

// Una sola consulta en curso. Si responde después de ESPERA_OSM, actualiza los datos para el próximo render.
function refrescarOsm() {
  estado.osmEnCurso ??= cargarOsm()
    .catch(falla("Overpass"))
    .then((r) => {
      if (!r) return null;
      estado.osm = r.servicios;
      estado.origenOsm = r.origen;
      estado.datos = combinar();
      if (estado.imOk) estado.vence = Date.now() + CACHE_MS;
      return r.servicios;
    })
    .finally(() => {
      estado.osmEnCurso = undefined;
    });
  return estado.osmEnCurso;
}

async function cargar(): Promise<Servicio[]> {
  const osmEnCurso = refrescarOsm();
  // En Vercel, para que la función no se congele antes de que Overpass responda. Fuera de un pedido, after() falla.
  try {
    after(() => osmEnCurso);
  } catch {}
  const [im, osm] = await Promise.all([
    cargarIm().catch(falla("IM")),
    Promise.race([osmEnCurso, new Promise<null>((r) => setTimeout(() => r(null), ESPERA_OSM))]),
  ]);
  if (im) {
    estado.im = im;
    estado.origenIm = { tipo: "en-vivo" };
  }
  estado.imOk = Boolean(im);
  if (!estado.im && !estado.osm) throw new Error("Servicios: no respondió ninguna fuente");
  estado.vence = Date.now() + (im && osm ? CACHE_MS : PAUSA_FALLA);
  return combinar();
}

export async function getServicios(): Promise<Servicio[]> {
  if (Date.now() < estado.vence) return estado.datos ?? [];
  estado.promesa ??= cargar()
    .then((d) => (estado.datos = d))
    .catch((e) => {
      console.error(e);
      estado.vence = Date.now() + PAUSA_FALLA;
      return estado.datos ?? [];
    })
    .finally(() => {
      estado.promesa = undefined;
    });
  // Con datos anteriores no se espera: se actualizan para el próximo render.
  return estado.datos ?? estado.promesa;
}

/** De dónde salieron los servicios que se están mostrando (para /estado). */
export function getOrigenServicios() {
  return { im: estado.origenIm, osm: estado.origenOsm, copia: { im: COPIA.im?.generado ?? null, osm: COPIA.osm?.generado ?? null } };
}

/** Servicios a menos de RADIO_SERVICIOS de alguno de los puntos (casillas), ordenados por distancia. */
export function serviciosCerca(todos: Servicio[], puntos: { lat: number; lon: number }[]): Servicio[] {
  return todos
    .map((s) => ({
      ...s,
      metros: Math.round(
        Math.min(...puntos.map((p) => Math.hypot((s.lat - p.lat) * M_LAT, (s.lon - p.lon) * M_LON))),
      ),
    }))
    .filter((s) => s.metros <= RADIO_SERVICIOS)
    .sort((a, b) => a.metros - b.metros);
}
