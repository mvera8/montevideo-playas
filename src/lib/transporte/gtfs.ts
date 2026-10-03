import "server-only";
import { Unzip, UnzipInflate, unzipSync, strFromU8 } from "fflate";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getToken } from "../im";

// Índice en memoria del GTFS estático del STM (lo publica la IM, se actualiza ~mensualmente).
// Cada "patrón" es una variante de línea: en este feed shape_id === lineVariantId de la API
// en tiempo real, lo que permite cruzar horarios con las posiciones de los ómnibus.

const GTFS = "https://api.montevideo.gub.uy/api/transportepublico/buses/gtfs/static/latest";
const REVISAR_VERSION_MS = 6 * 60 * 60 * 1000;

export type Parada = { id: string; nombre: string; lat: number; lon: number };

export type Patron = {
  variante: number;
  linea: string;
  destino: string;
  paradas: number[]; // índices en Indice.paradas, en orden de recorrido
  minutos: number[]; // minutos desde la primera parada (viaje representativo)
  salidas: Map<string, number[]>; // service_id → salidas de la 1.ª parada (min desde medianoche), ordenadas
  forma: number[]; // [lon, lat, lon, lat, ...]
  distForma: number[]; // metros acumulados por punto de la forma
  distParadas: number[]; // metros a lo largo de la forma de cada parada
};

export type Indice = {
  version: string;
  paradas: Parada[];
  patrones: Patron[];
  porVariante: Map<number, number>;
  porParada: [patron: number, posicion: number][][]; // por índice de parada
  calendario: Map<string, boolean[]>; // service_id → [lun..dom]
  grilla: Map<string, number[]>;
};

// ---------- utilidades geográficas ----------

const M_LAT = 110_540;
const M_LON = 111_320 * Math.cos((-34.9 * Math.PI) / 180);

export function distancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  return Math.hypot((lat2 - lat1) * M_LAT, (lon2 - lon1) * M_LON);
}

const CELDA = 0.01;
const claveCelda = (lat: number, lon: number) => `${Math.floor(lat / CELDA)}:${Math.floor(lon / CELDA)}`;

export function paradasCerca(ix: Indice, lat: number, lon: number, radio: number) {
  const out: { parada: number; metros: number }[] = [];
  const cy = Math.floor(lat / CELDA);
  const cx = Math.floor(lon / CELDA);
  const n = Math.ceil(radio / 900);
  for (let dy = -n; dy <= n; dy++)
    for (let dx = -n; dx <= n; dx++)
      for (const i of ix.grilla.get(`${cy + dy}:${cx + dx}`) ?? []) {
        const p = ix.paradas[i];
        const m = distancia(lat, lon, p.lat, p.lon);
        if (m <= radio) out.push({ parada: i, metros: m });
      }
  return out.sort((a, b) => a.metros - b.metros);
}

// ---------- parsing ----------

function parseCsvLinea(linea: string): string[] {
  if (!linea.includes('"')) return linea.split(",");
  const out: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (comillas) {
      if (c === '"' && linea[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") {
      out.push(campo);
      campo = "";
    } else campo += c;
  }
  out.push(campo);
  return out;
}

function filas(texto: string) {
  const lineas = texto.replace(/\r/g, "").split("\n").filter(Boolean);
  const cab = parseCsvLinea(lineas[0]);
  return lineas.slice(1).map((l) => {
    const c = parseCsvLinea(l);
    return Object.fromEntries(cab.map((k, i) => [k, c[i] ?? ""])) as Record<string, string>;
  });
}

const aMinutos = (hhmmss: string) => {
  const [h, m, s] = hhmmss.split(":").map(Number);
  return h * 60 + m + (s || 0) / 60;
};

// Recorre stop_times.txt (~90 MB) en streaming sin materializarlo entero.
function recorrerStopTimes(zip: Uint8Array, alViaje: (trip: string, paradas: string[], tiempos: number[]) => void) {
  const dec = new TextDecoder();
  let resto = "";
  let cab: string[] | null = null;
  let iTrip = 0, iStop = 0, iDep = 0;
  let viaje = "";
  let paradas: string[] = [];
  let tiempos: number[] = [];

  const cerrarViaje = () => {
    if (viaje) alViaje(viaje, paradas, tiempos);
    paradas = [];
    tiempos = [];
  };
  const procesar = (linea: string) => {
    if (!linea) return;
    if (!cab) {
      cab = linea.replace(/\r/g, "").split(",");
      iTrip = cab.indexOf("trip_id");
      iStop = cab.indexOf("stop_id");
      iDep = cab.indexOf("departure_time");
      return;
    }
    const c = linea.split(",");
    const trip = c[iTrip];
    if (trip !== viaje) {
      cerrarViaje();
      viaje = trip;
    }
    paradas.push(c[iStop]);
    tiempos.push(aMinutos(c[iDep]));
  };

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (f) => {
    if (f.name !== "stop_times.txt") return;
    f.ondata = (err, chunk, final) => {
      if (err) throw err;
      const texto = resto + dec.decode(chunk, { stream: !final });
      const lineas = texto.split("\n");
      resto = final ? "" : lineas.pop()!;
      for (const l of lineas) procesar(l.replace(/\r$/, ""));
      if (final) cerrarViaje();
    };
    f.start();
  };
  unzip.push(zip, true);
}

function proyectarParadas(p: Patron, paradas: Parada[]) {
  const n = p.distForma.length;
  let seg = 0;
  let previa = 0;
  for (const idx of p.paradas) {
    const { lat, lon } = paradas[idx];
    let mejor = Infinity;
    let mejorDist = previa;
    for (let j = seg; j < n - 1; j++) {
      const ax = p.forma[j * 2] * M_LON, ay = p.forma[j * 2 + 1] * M_LAT;
      const bx = p.forma[j * 2 + 2] * M_LON, by = p.forma[j * 2 + 3] * M_LAT;
      const px = lon * M_LON, py = lat * M_LAT;
      const vx = bx - ax, vy = by - ay;
      const len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
      const d = Math.hypot(ax + vx * t - px, ay + vy * t - py);
      if (d < mejor) {
        mejor = d;
        mejorDist = p.distForma[j] + t * (p.distForma[j + 1] - p.distForma[j]);
        seg = j;
      }
      // Ya encontramos la parada y nos alejamos: cortar (los recorridos pueden volver por la misma calle).
      if (mejor < 40 && d > mejor + 600) break;
    }
    previa = Math.max(previa, mejorDist);
    p.distParadas.push(previa);
  }
}

async function construir(zip: Uint8Array, version: string): Promise<Indice> {
  const t0 = Date.now();
  const archivos = unzipSync(zip, { filter: (f) => f.name !== "stop_times.txt" });
  const leer = (n: string) => filas(strFromU8(archivos[n]));

  const paradas: Parada[] = [];
  const idxParada = new Map<string, number>();
  for (const r of leer("stops.txt")) {
    idxParada.set(r.stop_id, paradas.length);
    paradas.push({ id: r.stop_id, nombre: r.stop_name, lat: +r.stop_lat, lon: +r.stop_lon });
  }

  const lineaDeRuta = new Map(leer("routes.txt").map((r) => [r.route_id, r.route_short_name]));
  const viajes = new Map<string, { forma: string; servicio: string; destino: string; linea: string }>();
  for (const r of leer("trips.txt"))
    viajes.set(r.trip_id, {
      forma: r.shape_id,
      servicio: r.service_id,
      destino: r.trip_headsign,
      linea: (lineaDeRuta.get(r.route_id) ?? "").toUpperCase(),
    });

  const dias = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const calendario = new Map(leer("calendar.txt").map((r) => [r.service_id, dias.map((d) => r[d] === "1")]));

  // Formas (recorridos).
  const formas = new Map<string, { seq: number; lat: number; lon: number }[]>();
  for (const r of leer("shapes.txt")) {
    let arr = formas.get(r.shape_id);
    if (!arr) formas.set(r.shape_id, (arr = []));
    arr.push({ seq: +r.shape_pt_sequence, lat: +r.shape_pt_lat, lon: +r.shape_pt_lon });
  }

  // Un viaje representativo por forma (el más cercano a las 13 h de un día hábil)
  // y todas las salidas por servicio.
  const representativo = new Map<string, { puntaje: number; paradas: string[]; tiempos: number[]; v: ReturnType<typeof viajes.get> }>();
  const salidas = new Map<string, Map<string, number[]>>();
  recorrerStopTimes(zip, (trip, ps, ts) => {
    const v = viajes.get(trip);
    if (!v || ps.length < 2) return;
    let porServicio = salidas.get(v.forma);
    if (!porServicio) salidas.set(v.forma, (porServicio = new Map()));
    const lista = porServicio.get(v.servicio) ?? [];
    lista.push(ts[0]);
    porServicio.set(v.servicio, lista);

    const puntaje = Math.abs(ts[0] - 13 * 60) + (v.servicio === "1" ? 0 : 1440);
    const actual = representativo.get(v.forma);
    if (!actual || puntaje < actual.puntaje) representativo.set(v.forma, { puntaje, paradas: ps, tiempos: ts, v });
  });

  const patrones: Patron[] = [];
  for (const [forma, rep] of representativo) {
    const puntos = (formas.get(forma) ?? []).sort((a, b) => a.seq - b.seq);
    const plano: number[] = [];
    const acum: number[] = [];
    puntos.forEach((pt, i) => {
      plano.push(pt.lon, pt.lat);
      acum.push(i === 0 ? 0 : acum[i - 1] + distancia(puntos[i - 1].lat, puntos[i - 1].lon, pt.lat, pt.lon));
    });
    const idxs = rep.paradas.map((id) => idxParada.get(id));
    if (idxs.some((i) => i === undefined) || plano.length < 4) continue;
    const porServicio = salidas.get(forma)!;
    for (const l of porServicio.values()) l.sort((a, b) => a - b);
    const p: Patron = {
      variante: Number(forma),
      linea: rep.v!.linea,
      destino: rep.v!.destino,
      paradas: idxs as number[],
      minutos: rep.tiempos.map((t) => t - rep.tiempos[0]),
      salidas: porServicio,
      forma: plano,
      distForma: acum,
      distParadas: [],
    };
    proyectarParadas(p, paradas);
    patrones.push(p);
  }

  const porParada: [number, number][][] = paradas.map(() => []);
  const porVariante = new Map<number, number>();
  patrones.forEach((p, pi) => {
    porVariante.set(p.variante, pi);
    p.paradas.forEach((s, pos) => porParada[s].push([pi, pos]));
  });

  const grilla = new Map<string, number[]>();
  paradas.forEach((p, i) => {
    const k = claveCelda(p.lat, p.lon);
    grilla.set(k, [...(grilla.get(k) ?? []), i]);
  });

  console.log(`[gtfs] v${version}: ${paradas.length} paradas, ${patrones.length} variantes en ${Date.now() - t0} ms`);
  return { version, paradas, patrones, porVariante, porParada, calendario, grilla };
}

// ---------- carga con caché ----------

async function descargar(ruta: string, token: string) {
  const res = await fetch(`${GTFS}/${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GTFS ${ruta} falló (${res.status})`);
  return res;
}

async function cargar(versionActual?: string): Promise<Indice | null> {
  const token = await getToken("transporte");
  const version = (await (await descargar("version.txt", token)).text()).trim();
  if (version === versionActual) return null;

  const dir = path.join(tmpdir(), "playasuy-gtfs");
  const archivo = path.join(dir, `gtfs-${version}.zip`);
  let zip: Uint8Array;
  try {
    zip = new Uint8Array(await readFile(archivo));
  } catch {
    zip = new Uint8Array(await (await descargar("google_transit.zip", token)).arrayBuffer());
    await mkdir(dir, { recursive: true });
    await writeFile(archivo, zip);
  }
  return construir(zip, version);
}

// En dev el módulo se recarga con HMR: guardamos el índice en globalThis.
const g = globalThis as unknown as {
  __gtfs?: { indice?: Indice; promesa?: Promise<Indice>; revisado: number };
};
g.__gtfs ??= { revisado: 0 };
const estado = g.__gtfs;

export function getIndice(): Promise<Indice> {
  if (estado.promesa) return estado.promesa;
  if (estado.indice && Date.now() - estado.revisado < REVISAR_VERSION_MS) {
    return Promise.resolve(estado.indice);
  }
  estado.promesa = cargar(estado.indice?.version)
    .then((nuevo) => {
      estado.indice = nuevo ?? estado.indice!;
      estado.revisado = Date.now();
      return estado.indice;
    })
    .catch((e) => {
      // Si falla la revisión pero ya hay un índice, seguimos con el anterior.
      if (estado.indice) return estado.indice;
      throw e;
    })
    .finally(() => {
      estado.promesa = undefined;
    });
  return estado.promesa;
}
