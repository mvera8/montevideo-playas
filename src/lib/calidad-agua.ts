import "server-only";

// Calidad del agua en playas: datos abiertos de la IM (SECCA), muestreos de todo el año.
// https://catalogodatos.gub.uy/dataset/monitoreo-de-agua-de-playas
//
// Criterio (Decreto 226/025, aplicado por la IM desde el 27/03/2026): una playa NO es apta
// si la media geométrica de enterococos de 5 muestras (en ≤ 40 días) supera 200 UFC/100 ml,
// o si una muestra supera 500 UFC/100 ml.

const BASE = "https://ckan-data.montevideo.gub.uy/dataset/b51c24fd-ee40-4eec-a84c-0c4f064859b0/resource";
const URL_MUESTRAS = `${BASE}/b143b5d2-5721-4efd-8ac5-9edb6e1ae3ac/download/datos_de_calidad_de_agua_en_playas.csv`;
const URL_MEDIAS = `${BASE}/01e9385e-1b1f-4070-81ed-e288fe71f0d4/download/media_geometrica_de_enterococos_en_playas.csv`;
const CACHE_MS = 3 * 60 * 60 * 1000; // cada cuánto se verifica si hay datos nuevos (HEAD)
const DIAS_HISTORIAL = 120;
// La IM muestrea cada punto cada ~4 días (p90: 7 días, medido en 2025-2026). Un análisis con más
// de 21 días (~5 muestreos salteados) ya no describe el agua de hoy: se muestra "sin datos".
export const DIAS_VIGENCIA = 21;
const MUESTRAS_HISTORIAL = 10;

export const LIMITE_MEDIA = 200;
export const LIMITE_MUESTRA = 500;

export type Ciano = "ausencia" | "presencia" | "espuma";
export type EstadoAgua = "apta" | "no-apta" | "sin-datos";

export type Muestra = {
  fecha: string; // "YYYY-MM-DD HH:mm"
  enterococos: number | null;
  ciano: Ciano | null;
  representativa: boolean; // false: llovió en las 24 h previas
};

export type PuntoAgua = {
  codigo: string;
  nombre: string;
  estado: EstadoAgua;
  media: { valor: number; desde: string; hasta: string } | null;
  ultima: Muestra | null;
  historial: Muestra[]; // más vieja → más nueva
};

export type CalidadAgua = {
  estado: EstadoAgua; // el peor de sus puntos
  ciano: Ciano | null; // el peor del último muestreo
  temperatura: { valor: number; fecha: string } | null; // medida en la playa (últimos 10 días)
  ultimaFecha: string | null;
  diasDesdeUltimo: number | null;
  puntos: PuntoAgua[];
};

// Nombre de playa en el dataset → slug de la app.
const SLUGS: Record<string, string> = {
  "Punta Espinillo": "punta-espinillo",
  "La Colorada": "la-colorada",
  "Pajas Blancas": "pajas-blancas",
  Zabala: "zabala",
  "De Los Cilindros": "los-cilindros",
  "Punta Yeguas": "punta-yeguas",
  "Santa Catalina": "santa-catalina",
  "Del Nacional (o Frigonal)": "del-nacional",
  "Del Cerro": "del-cerro",
  Ramirez: "ramirez",
  Pocitos: "pocitos",
  Buceo: "buceo",
  Malvin: "malvin",
  Brava: "brava",
  Honda: "honda",
  "De Los Ingleses": "los-ingleses",
  Verde: "verde",
  "De La Mulata": "la-mulata",
  Carrasco: "carrasco",
};

function filasCsv(texto: string) {
  const [cab, ...lineas] = texto.replace(/\r/g, "").split("\n").filter(Boolean);
  const cols = cab.split(",");
  // Los campos no traen comas internas (verificado), así que alcanza con split.
  return lineas.map((l) => {
    const c = l.split(",");
    return Object.fromEntries(cols.map((k, i) => [k, c[i] ?? ""])) as Record<string, string>;
  });
}

const num = (s: string) => (s === "" || s == null ? null : Number(s));
const CIANO: Record<string, Ciano> = { Ausencia: "ausencia", Presencia: "presencia", Espuma: "espuma" };
const GRAVEDAD_CIANO: Ciano[] = ["espuma", "presencia", "ausencia"];
const peorCiano = (cs: (Ciano | null)[]) => GRAVEDAD_CIANO.find((c) => cs.includes(c)) ?? null;

function hace(dias: number) {
  return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
}

// El servidor de la IM no soporta descargas parciales ni condicionales (Range, If-None-Match,
// If-Modified-Since): siempre manda los ~2,2 MB. Por eso:
// 1) antes de bajar, un HEAD (~80 ms, sin cuerpo) compara el ETag con el último visto;
// 2) el CSV viene ordenado del más nuevo al más viejo, así que lo leemos en streaming y
//    cortamos la descarga al llegar a muestras viejas (~40 KB en vez de 2,2 MB).

async function huella(url: string) {
  const res = await fetch(url, { method: "HEAD" });
  if (!res.ok) throw new Error(`Calidad de agua IM: HEAD ${res.status}`);
  return res.headers.get("etag") ?? res.headers.get("last-modified") ?? "";
}

async function descargar(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Calidad de agua IM falló (${res.status})`);
  return res.text();
}

/** Cabecera + filas con fecha (1.ª columna) >= `desde`; corta la descarga en cuanto aparecen más viejas. */
async function descargarReciente(url: string, desde: string) {
  const ctrl = new AbortController();
  const res = await fetch(url, { signal: ctrl.signal });
  if (!res.ok || !res.body) throw new Error(`Calidad de agua IM falló (${res.status})`);
  const lector = res.body.getReader();
  const dec = new TextDecoder();
  const lineas: string[] = [];
  let resto = "";
  try {
    for (;;) {
      const { done, value } = await lector.read();
      const partes = (resto + dec.decode(value, { stream: !done })).split("\n");
      resto = done ? "" : partes.pop()!;
      for (const l of partes) {
        if (lineas.length > 0 && l.slice(0, 10) < desde) return lineas.join("\n"); // ya son viejas
        if (l) lineas.push(l);
      }
      if (done) return lineas.join("\n");
    }
  } finally {
    ctrl.abort(); // no transferir el resto del archivo
  }
}

function procesar(muestrasCsv: string, mediasCsv: string): Map<string, CalidadAgua> {
  const desde = hace(DIAS_HISTORIAL);

  // Muestras recientes por punto de muestreo.
  const porPunto = new Map<string, { slug: string; nombre: string; muestras: (Muestra & { temp: number | null })[] }>();
  for (const r of filasCsv(muestrasCsv)) {
    const slug = SLUGS[r.playa];
    if (!slug || r.fecha_muestra < desde) continue;
    const clave = `${slug}|${r.desc_abreviada_punto}`;
    let p = porPunto.get(clave);
    if (!p) porPunto.set(clave, (p = { slug, nombre: r.desc_lugar_muestreo, muestras: [] }));
    p.muestras.push({
      fecha: r.fecha_muestra,
      enterococos: num(r.enterococos),
      ciano: CIANO[r.cianobacterias] ?? null,
      representativa: r.tipo !== "No Representativo",
      temp: num(r.temperatura),
    });
  }

  // Media geométrica oficial (última ventana publicada por punto).
  const medias = new Map<string, { valor: number; desde: string; hasta: string }>();
  for (const r of filasCsv(mediasCsv)) {
    const slug = SLUGS[r.playa];
    if (!slug) continue;
    const clave = `${slug}|${r.desc_abreviada_punto}`;
    const prev = medias.get(clave);
    if (!prev || r.fecha_hasta > prev.hasta)
      medias.set(clave, { valor: Number(r.mg5), desde: r.fecha_desde, hasta: r.fecha_hasta });
  }

  const recientes = hace(DIAS_VIGENCIA);
  const out = new Map<string, CalidadAgua>();
  for (const [clave, p] of porPunto) {
    p.muestras.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const ultima = p.muestras[p.muestras.length - 1] ?? null;
    const media = medias.get(clave) ?? null;
    let estado: EstadoAgua = "sin-datos";
    if (ultima && ultima.fecha >= recientes) {
      const supera =
        (media != null && media.hasta >= recientes && media.valor > LIMITE_MEDIA) ||
        (ultima.enterococos != null && ultima.enterococos > LIMITE_MUESTRA);
      estado = supera ? "no-apta" : "apta";
    }
    const punto: PuntoAgua = {
      codigo: clave.split("|")[1],
      nombre: p.nombre,
      estado,
      media,
      ultima: ultima && { fecha: ultima.fecha, enterococos: ultima.enterococos, ciano: ultima.ciano, representativa: ultima.representativa },
      historial: p.muestras
        .slice(-MUESTRAS_HISTORIAL)
        .map((m) => ({ fecha: m.fecha, enterococos: m.enterococos, ciano: m.ciano, representativa: m.representativa })),
    };

    const playa = out.get(p.slug) ?? { estado: "sin-datos", ciano: null, temperatura: null, ultimaFecha: null, diasDesdeUltimo: null, puntos: [] };
    playa.puntos.push(punto);
    const temp = [...p.muestras].reverse().find((m) => m.temp != null && m.fecha >= hace(10));
    if (temp && (!playa.temperatura || temp.fecha > playa.temperatura.fecha))
      playa.temperatura = { valor: temp.temp!, fecha: temp.fecha };
    out.set(p.slug, playa);
  }

  for (const playa of out.values()) {
    const estados = playa.puntos.map((p) => p.estado);
    playa.estado = estados.includes("no-apta") ? "no-apta" : estados.includes("apta") ? "apta" : "sin-datos";
    playa.ultimaFecha = playa.puntos.map((p) => p.ultima?.fecha ?? "").sort().pop() || null;
    playa.diasDesdeUltimo = playa.ultimaFecha
      ? Math.floor((Date.now() - new Date(`${playa.ultimaFecha.slice(0, 10)}T12:00:00-03:00`).getTime()) / 86_400_000)
      : null;
    // Cianobacterias: solo cuenta lo observado en el último muestreo de cada punto, si es reciente.
    playa.ciano = peorCiano(playa.puntos.filter((p) => (p.ultima?.fecha ?? "") >= recientes).map((p) => p.ultima!.ciano));
    playa.puntos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
  return out;
}

// Caché en memoria + verificación barata: cada CACHE_MS hacemos HEAD y solo descargamos
// si la IM regeneró los archivos (lo hace una vez por día).
type Estado = {
  datos?: Map<string, CalidadAgua>;
  huellas?: [string, string];
  hora: number;
  promesa?: Promise<Map<string, CalidadAgua>>;
};
const g = globalThis as unknown as { __agua?: Estado };
g.__agua ??= { hora: 0 };
const estado = g.__agua;

async function actualizar(): Promise<Map<string, CalidadAgua>> {
  const huellas = await Promise.all([huella(URL_MUESTRAS), huella(URL_MEDIAS)]).catch(() => null);
  if (estado.datos && huellas && estado.huellas?.[0] === huellas[0] && estado.huellas?.[1] === huellas[1]) {
    return estado.datos; // sin cambios en la IM: no descargamos nada
  }
  const [muestras, medias] = await Promise.all([
    descargarReciente(URL_MUESTRAS, hace(DIAS_HISTORIAL)),
    descargar(URL_MEDIAS), // ~20 KB
  ]);
  estado.huellas = huellas ?? undefined;
  return procesar(muestras, medias);
}

export async function getCalidadAgua(): Promise<Map<string, CalidadAgua>> {
  if (estado.datos && Date.now() - estado.hora < CACHE_MS) return estado.datos;
  estado.promesa ??= actualizar()
    .then((d) => {
      estado.datos = d;
      estado.hora = Date.now();
      return d;
    })
    .catch((e) => {
      console.error(e);
      return estado.datos ?? new Map();
    })
    .finally(() => {
      estado.promesa = undefined;
    });
  return estado.promesa;
}
