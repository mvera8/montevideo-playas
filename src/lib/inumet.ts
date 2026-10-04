import "server-only";

// Advertencias meteorológicas de INUMET (viento, lluvia, tormenta, etc.) vigentes para Montevideo.
// INUMET no tiene API ni datos abiertos de alertas (su catálogo solo trae observaciones de estaciones)
// y el feed CAP registrado en la OMM (cap-sources.s3.amazonaws.com/uy-inumet-es/rss.xml) está
// abandonado desde 2020. Usamos el JSON que la propia web de INUMET escribe en el HTML:
//
// - URL: https://www.inumet.gub.uy/alerta (HTML, ~59 KB, sin autenticación). Trae
//   `var alerta = {...};` (advertencias) y `var cese = {...};` (último cese) en un <script>, que es lo
//   que lee su alerta.js. El JSON arranca en el byte ~43.000: leemos en streaming y cortamos la descarga
//   apenas pasamos `var cese`.
// - Sin ETag ni Last-Modified útil (Drupal + Cloudflare, `max-age=60`): no hay HEAD barato. Cacheamos
//   10 min en memoria.
// - Cada advertencia: `riesgoFenomeno` (riesgoViento, riesgoLluvia, riesgoTormenta, riesgoVisibilidad,
//   riesgoCalor, riesgoFrio; 1 = sin riesgo, 2 amarilla, 3 naranja, 4 roja), `fenomeno`, `probabilidad`,
//   `descripcion`, `comienzo`/`finalizacion` ("YYYY-MM-DD HH:mm", hora de Uruguay) y `zonasArray`
//   ([{ id: "MONTEVIDEO", label, localidades: [] }], localidades vacía = todo el departamento).
// - Frecuencia (histórico de /tiempo/historico-alertas-meteorologicas, 10/2025–09/2026): 25 a 93
//   publicaciones por mes en todo el país. Durante un evento renuevan cada ~3 h y `finalizacion` es la
//   hora de la próxima renovación: si no la renuevan, vence sola. Igual que su alerta.js, descartamos las
//   que ya vencieron.
// - Es un formato interno, no documentado: si cambian la web, el parseo falla y mostramos "sin datos"
//   (nunca "no hay alertas"). Formato verificado el 04/10/2026 (y en el Wayback Machine, 19/02/2026).

const URL_ALERTA = "https://www.inumet.gub.uy/alerta";
const BASE_PDF = "https://www.inumet.gub.uy/reportes/riesgo/pdf/";
const CACHE_MS = 10 * 60 * 1000;
// Si no pudimos leer INUMET en la última hora, no afirmamos que no haya alertas.
const VIGENCIA_MS = 60 * 60 * 1000;
// Una advertencia sin `finalizacion` se descarta a las 24 h de su comienzo.
const MAX_SIN_FIN_MS = 24 * 60 * 60 * 1000;
const TIMEOUT = 8000;
const DEPARTAMENTO = "MONTEVIDEO";

export type NivelAlerta = 2 | 3 | 4; // amarilla, naranja, roja

export type AdvertenciaInumet = {
  nivel: NivelAlerta;
  fenomeno: string; // "Tormentas fuertes y puntualmente severas"
  riesgos: string[]; // ["Tormenta", "Lluvia"]
  probabilidad: string | null;
  descripcion: string | null;
  comienzo: string; // ISO
  fin: string | null; // ISO
  localidades: string[]; // vacío = todo Montevideo
};

export type AlertasInumet =
  | { estado: "ok"; advertencias: AdvertenciaInumet[]; actualizado: string | null; pdf: string | null }
  | { estado: "sin-datos" };

const RIESGOS: Record<string, string> = {
  riesgoViento: "Viento",
  riesgoLluvia: "Lluvia",
  riesgoTormenta: "Tormenta",
  riesgoVisibilidad: "Niebla",
  riesgoCalor: "Calor",
  riesgoFrio: "Frío",
};

type AdvCruda = {
  riesgoFenomeno?: Record<string, number | string>;
  fenomeno?: string;
  probabilidad?: string;
  descripcion?: string;
  comienzo?: string;
  finalizacion?: string;
  zonasArray?: { id?: string; localidades?: string[] }[];
};

type AlertaCruda = {
  inactivo?: boolean;
  modoTest?: boolean;
  fechaActualizacion?: string;
  advertencias?: AdvCruda[];
  pdf?: string;
} | null;

// "2026-02-19 08:35" (Uruguay, UTC−3 todo el año) → ISO.
function fechaUy(s: string | undefined): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return null;
  const d = new Date(`${s.slice(0, 10)}T${s.slice(11, 16)}:00-03:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Extrae el literal JSON que sigue a `var <nombre> =`, respetando strings. */
function objetoJs(html: string, nombre: string): unknown {
  const m = new RegExp(`var\\s+${nombre}\\s*=\\s*`).exec(html);
  if (!m) throw new Error(`INUMET: no se encontró var ${nombre}`);
  const ini = m.index + m[0].length;
  if (html.startsWith("null", ini)) return null;
  let prof = 0;
  let enString = false;
  for (let i = ini; i < html.length; i++) {
    const c = html[i];
    if (enString) {
      if (c === "\\") i++;
      else if (c === '"') enString = false;
    } else if (c === '"') enString = true;
    else if (c === "{" || c === "[") prof++;
    else if (c === "}" || c === "]") {
      if (--prof === 0) return JSON.parse(html.slice(ini, i + 1));
    }
  }
  throw new Error(`INUMET: var ${nombre} incompleta`);
}

/** Baja el HTML hasta pasar `var cese = {...};` y corta la descarga (~45 KB de ~59 KB). */
async function descargar(): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(URL_ALERTA, { signal: ctrl.signal });
    if (!res.ok || !res.body) throw new Error(`INUMET falló (${res.status})`);
    const lector = res.body.getReader();
    const dec = new TextDecoder();
    let html = "";
    for (;;) {
      const { done, value } = await lector.read();
      html += dec.decode(value, { stream: !done });
      const cese = html.indexOf("var cese");
      if (done || (cese >= 0 && html.indexOf("};", cese) >= 0)) return html;
    }
  } finally {
    clearTimeout(timer);
    ctrl.abort(); // no transferir el resto de la página
  }
}

function procesar(alerta: AlertaCruda, ahora: number): AlertasInumet {
  if (!alerta || alerta.modoTest || alerta.inactivo || !Array.isArray(alerta.advertencias)) {
    return { estado: "ok", advertencias: [], actualizado: fechaUy(alerta?.fechaActualizacion), pdf: null };
  }
  const advertencias: AdvertenciaInumet[] = [];
  for (const a of alerta.advertencias) {
    const zona = a.zonasArray?.find((z) => z.id?.toUpperCase() === DEPARTAMENTO);
    if (!zona) continue;
    const comienzo = fechaUy(a.comienzo);
    const fin = fechaUy(a.finalizacion);
    if (!comienzo) continue;
    if (fin ? Date.parse(fin) < ahora : Date.parse(comienzo) + MAX_SIN_FIN_MS < ahora) continue; // vencida
    const niveles = Object.entries(a.riesgoFenomeno ?? {}).map(([k, v]) => [k, Number(v)] as const);
    const nivel = Math.max(1, ...niveles.map(([, v]) => (Number.isFinite(v) ? v : 1)));
    if (nivel < 2) continue;
    advertencias.push({
      nivel: Math.min(nivel, 4) as NivelAlerta,
      fenomeno: a.fenomeno?.trim() || "Advertencia meteorológica",
      riesgos: niveles.filter(([k, v]) => v > 1 && RIESGOS[k]).map(([k]) => RIESGOS[k]),
      probabilidad: a.probabilidad?.trim() || null,
      descripcion: a.descripcion?.trim() || null,
      comienzo,
      fin,
      localidades: (zona.localidades ?? []).map((l) => l.trim()).filter(Boolean),
    });
  }
  advertencias.sort((x, y) => y.nivel - x.nivel);
  return {
    estado: "ok",
    advertencias,
    actualizado: fechaUy(alerta.fechaActualizacion),
    pdf: advertencias.length && alerta.pdf ? BASE_PDF + encodeURIComponent(alerta.pdf) : null,
  };
}

// Caché en memoria compartida por todos los renders; un solo pedido en vuelo. Si INUMET falla, se
// reintenta recién a los CACHE_MS (no esperamos el timeout en cada render).
type Estado = { alerta?: AlertaCruda; hora: number; intento: number; promesa?: Promise<void> };
const g = globalThis as unknown as { __inumet?: Estado };
g.__inumet ??= { hora: 0, intento: 0 };
const estado = g.__inumet;

export async function getAlertasInumet(): Promise<AlertasInumet> {
  if (Date.now() - estado.intento >= CACHE_MS) {
    estado.intento = Date.now();
    estado.promesa ??= descargar()
      .then((html) => {
        estado.alerta = objetoJs(html, "alerta") as AlertaCruda;
        estado.hora = Date.now();
      })
      .catch((e) => console.error("INUMET:", e))
      .finally(() => {
        estado.promesa = undefined;
      });
  }
  if (estado.promesa) await estado.promesa;
  // Si la última lectura buena es vieja (o nunca hubo), no decimos "no hay alertas".
  if (estado.alerta === undefined || Date.now() - estado.hora > VIGENCIA_MS) return { estado: "sin-datos" };
  return procesar(estado.alerta, Date.now());
}
