import "server-only";
import { unzipSync } from "fflate";

// Baños, bebederos y duchas públicos cerca de las playas. Dos fuentes:
// - IM, datos abiertos "Equipamiento urbano – espacios públicos" (oficial, sobre todo plazas y parques).
//   https://catalogodatos.gub.uy/dataset/equipamiento-urbano-espacios-publicos
//   El servidor GIS genera un shapefile (UTM 21S) en /sit/tmp/<tabla>.zip al pedir generar_zip2.php.
// - OpenStreetMap vía Overpass (comunitario): cubre la rambla y los baños químicos de temporada.
// Si un punto de OSM está a menos de 40 m de uno de la IM, se considera el mismo y gana la IM.

const GIS = "https://intgis.montevideo.gub.uy/sit";
const CACHE_MS = 24 * 60 * 60 * 1000; // cambian muy poco
export const RADIO_SERVICIOS = 600; // metros desde la casilla más cercana
// Un dato de OSM sin verificar ni editar en más de 2 años se marca como posiblemente desactualizado.
export const DIAS_VIGENCIA_OSM = 730;

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

async function capa(tabla: string) {
  // Pedir la generación (deja el zip actualizado en /sit/tmp) y luego descargarlo.
  await fetch(`${GIS}/php/common/datos/generar_zip2.php?nom_tab=${tabla}&tipo=gis`).catch(() => null);
  const res = await fetch(`${GIS}/tmp/${tabla}.zip`);
  if (!res.ok) throw new Error(`Servicios IM ${tabla}: ${res.status}`);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
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
  const [banos, bebederos] = await Promise.all([capa("v_ep_banios"), capa("v_ep_bebederos")]);
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

const OVERPASS = "https://overpass-api.de/api/interpreter";
// Franja costera de Montevideo (sur, oeste, norte, este).
const BBOX = "-34.95,-56.45,-34.83,-56.02";

type ElementoOsm = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  timestamp?: string; // última edición (con `out meta`)
  tags: Record<string, string>;
};

// El servidor público de Overpass a veces responde 504/429 cuando está saturado: un reintento.
async function consultarOverpass(q: string, intentos = 2): Promise<ElementoOsm[]> {
  for (let i = 1; ; i++) {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "PlayasUY/1.0 (mapa de playas de Montevideo)",
      },
      body: new URLSearchParams({ data: q }),
    });
    if (res.ok) return ((await res.json()) as { elements: ElementoOsm[] }).elements;
    if (i >= intentos || !(res.status === 429 || res.status >= 500)) throw new Error(`Overpass: ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
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

async function cargarOsm(): Promise<Servicio[]> {
  // `out center meta` agrega la fecha de última edición de cada punto.
  const elements = await consultarOverpass(
    `[out:json][timeout:25];nwr["amenity"~"^(toilets|drinking_water|shower)$"](${BBOX});out center meta;`,
  );
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

async function cargar(): Promise<Servicio[]> {
  // Cada fuente falla por separado: si una no responde, seguimos con la otra.
  const [im, osm] = await Promise.all([
    cargarIm().catch((e) => (console.error(e), null)),
    cargarOsm().catch((e) => (console.error(e), null)),
  ]);
  if (!im && !osm) throw new Error("Servicios: no respondió ninguna fuente");
  const oficiales = im ?? [];
  const extra = (osm ?? []).filter(
    (o) => !oficiales.some((s) => s.tipo === o.tipo && Math.hypot((s.lat - o.lat) * M_LAT, (s.lon - o.lon) * M_LON) < 40),
  );
  return [...oficiales, ...extra];
}

const g = globalThis as unknown as { __servicios?: { datos?: Servicio[]; hora: number; promesa?: Promise<Servicio[]> } };
g.__servicios ??= { hora: 0 };
const estado = g.__servicios;

export async function getServicios(): Promise<Servicio[]> {
  if (estado.datos && Date.now() - estado.hora < CACHE_MS) return estado.datos;
  estado.promesa ??= cargar()
    .then((d) => {
      estado.datos = d;
      estado.hora = Date.now();
      return d;
    })
    .catch((e) => {
      console.error(e);
      return estado.datos ?? [];
    })
    .finally(() => {
      estado.promesa = undefined;
    });
  return estado.promesa;
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
