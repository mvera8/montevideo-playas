import "server-only";
import { unstable_cache } from "next/cache";
import { getAguasVivas, DIAS_VIGENCIA as DIAS_VIGENCIA_AGUAS_VIVAS } from "./aguas-vivas";
import { DIAS_VIGENCIA as DIAS_VIGENCIA_AGUA, getCalidadAgua, URL_MUESTRAS } from "./calidad-agua";
import { HORAS_VIGENCIA_UV, URL_CASILLAS_MOVIL, URL_CLIMA_MOVIL } from "./banderas";
import { hasImCredentials } from "./im";
import { getAlertasInumet } from "./inumet";
import { DIAS_VIGENCIA_SST } from "./mar";
import { getMeGusta } from "./me-gusta";
import { GIS, OVERPASS } from "./servicios";
import { versionGtfs } from "./transporte/gtfs";
import { MONTEVIDEO } from "./sol";
import { met } from "./weather";

// Estado de las fuentes de datos, para la página /estado. Un chequeo por fuente, todos en paralelo, con
// tope de TIMEOUT cada uno. La página es ISR de 5 min, así que cada fuente recibe a lo sumo ~12
// chequeos por hora (y los que pasan por las funciones de la app usan su caché: no suman pedidos).
//
// - Donde la función de la app tira el error (IM Playas, MET Norway, GTFS) se usa esa misma función: el
//   chequeo es exactamente lo que ve el sitio, con la causa real (p. ej. UND_ERR_CONNECT_TIMEOUT).
// - Donde la función se traga el error (devuelve null o "sin datos"), se usa igual para la vigencia
//   del dato, y el detalle del error queda en los logs de Vercel.
// - El resto es un pedido mínimo al mismo servidor: HEAD, version.txt, solo el eje `time` de ERDDAP
//   (~50 B) o /api/status de Overpass (no gasta cupo de consultas).
// - "viejo": la fuente responde pero el último dato pasó el umbral de vigencia que usa la app.

const TIMEOUT = 8000;

// `versionGtfs` pide con `cache: "no-store"` (el GTFS lo usan rutas dinámicas): adentro de
// unstable_cache no vuelve dinámica a /estado, igual que getCasillasCacheado en im.ts.
const versionGtfsCacheada = unstable_cache(versionGtfs, ["estado-gtfs-version-v1"], { revalidate: 300 });

export type Estado = "ok" | "viejo" | "caido";

export type Chequeo = {
  id: string;
  nombre: string;
  grupo: "Intendencia de Montevideo" | "Clima y mar" | "Comunidad" | "Sitio";
  usa: string; // qué se ve afectado si falla
  estado: Estado;
  detalle: string;
  ms: number;
};

type Def = Omit<Chequeo, "estado" | "detalle" | "ms"> & {
  probar: () => Promise<{ detalle: string; viejo?: boolean }>;
};

/** "fetch failed" no dice nada: la causa real (timeout, DNS, TLS) viene en `cause`. */
export function describirError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const c = e.cause as { code?: string; message?: string } | undefined;
  const causa = c ? [c.code, c.message].filter(Boolean).join(": ") : "";
  return (causa ? `${e.message} — ${causa}` : e.message).slice(0, 300);
}

function conLimite<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Sin respuesta en ${TIMEOUT / 1000} s`)), TIMEOUT)),
  ]);
}

async function pedir(url: string, init: RequestInit = {}) {
  // Sin caché de datos: cada regeneración de la página consulta en vivo (es lo que se quiere medir). Sin
  // `cache: "no-store"` tampoco, que volvería dinámica la página.
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), ...init });
  if (init.method === "HEAD") await res.body?.cancel();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

const TZ = "America/Montevideo";
const fmtFecha = new Intl.DateTimeFormat("es-UY", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const fmtHora = new Intl.DateTimeFormat("es-UY", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dias = (fecha: string | number) => Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
const haceDias = (n: number) => (n <= 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`);

/** Último valor del eje `time` de un dataset ERDDAP (CSV de 3 líneas). */
async function ultimoTiempo(dataset: string) {
  const texto = await (await pedir(`${dataset}.csv?time%5B(last)%5D`)).text();
  const t = texto.trim().split("\n").pop() ?? "";
  if (Number.isNaN(Date.parse(t))) throw new Error("Respuesta inesperada de ERDDAP");
  return t;
}

const DEFS: Def[] = [
  {
    id: "im-transporte",
    nombre: "Montevideo API — Transporte (STM)",
    grupo: "Intendencia de Montevideo",
    usa: "Ómnibus en vivo y horarios de “Cómo ir”. Si falla, los horarios salen de nuestra copia y no hay ómnibus en vivo.",
    async probar() {
      if (!hasImCredentials("transporte")) throw new Error("Faltan IM_TRANSPORTE_CLIENT_ID / IM_TRANSPORTE_CLIENT_SECRET");
      return { detalle: `GTFS versión ${await versionGtfsCacheada()}` };
    },
  },
  {
    id: "im-casillas-movil",
    nombre: "Sitio de playas de la IM — casillas y banderas",
    grupo: "Intendencia de Montevideo",
    usa: "Casillas y banderas. Si falla, el navegador de cada visitante pide las banderas a la IM (ver «Desde tu navegador»).",
    async probar() {
      const { features } = (await (await pedir(URL_CASILLAS_MOVIL)).json()) as { features: unknown[] };
      return { detalle: `${features.length} casillas` };
    },
  },
  {
    id: "im-uv",
    nombre: "Sitio de playas de la IM — índice UV",
    grupo: "Intendencia de Montevideo",
    usa: "UV medido en la ciudad. Si falla, se muestra el máximo estimado de MET Norway.",
    async probar() {
      const { ValorIndiceUV: uv } = (await (await pedir(URL_CLIMA_MOVIL)).json()) as {
        ValorIndiceUV?: { value?: number; dateIssued?: string };
      };
      if (typeof uv?.value !== "number" || !uv.dateIssued) throw new Error("La respuesta no trae ValorIndiceUV");
      const viejo = Date.now() - Date.parse(uv.dateIssued) > HORAS_VIGENCIA_UV * 3_600_000;
      return { detalle: `UV ${uv.value}, medido el ${fmtHora.format(new Date(uv.dateIssued))}`, viejo };
    },
  },
  {
    id: "im-calidad-agua",
    nombre: "Datos abiertos de la IM — calidad del agua",
    grupo: "Intendencia de Montevideo",
    usa: "Enterococos y cianobacterias por playa.",
    async probar() {
      await pedir(URL_MUESTRAS, { method: "HEAD" });
      const ultima = [...(await getCalidadAgua()).values()].map((c) => c.ultimaFecha ?? "").sort().pop();
      if (!ultima) return { detalle: "Responde, pero no hay muestras cargadas", viejo: true };
      const d = dias(`${ultima.slice(0, 10)}T12:00:00-03:00`);
      return {
        detalle: `Último muestreo: ${fmtFecha.format(new Date(`${ultima.slice(0, 10)}T12:00:00-03:00`))} (${haceDias(d)})`,
        viejo: d > DIAS_VIGENCIA_AGUA,
      };
    },
  },
  {
    id: "im-gis",
    nombre: "Datos abiertos de la IM — baños y bebederos",
    grupo: "Intendencia de Montevideo",
    usa: "Baños y bebederos oficiales. Si falla, quedan los de OpenStreetMap.",
    async probar() {
      const res = await pedir(`${GIS}/tmp/v_ep_banios.zip`, { method: "HEAD" });
      const mod = res.headers.get("last-modified");
      return { detalle: mod ? `Archivo generado el ${fmtFecha.format(new Date(mod))}` : "Responde" };
    },
  },
  {
    id: "met-norway",
    nombre: "MET Norway",
    grupo: "Clima y mar",
    usa: "Clima actual, pronóstico y viento.",
    async probar() {
      // Directo a MET: getMontevideoWeather espera también a NOAA y una caída de NOAA la arrastraría.
      const serie = await met(MONTEVIDEO);
      return { detalle: `${Math.round(serie[0].data.instant.details.air_temperature)}° en Montevideo, ${serie.length} horas de pronóstico` };
    },
  },
  {
    id: "inumet",
    nombre: "Inumet — advertencias",
    grupo: "Clima y mar",
    usa: "Alertas meteorológicas vigentes.",
    async probar() {
      const a = await getAlertasInumet();
      if (a.estado === "sin-datos") throw new Error("Sin lectura válida en la última hora (detalle en los logs)");
      const n = a.advertencias.length;
      return { detalle: n ? `${n} advertencia${n > 1 ? "s" : ""} vigente${n > 1 ? "s" : ""}` : "Sin advertencias vigentes" };
    },
  },
  {
    id: "noaa-oisst",
    nombre: "NOAA OISST — temperatura del agua",
    grupo: "Clima y mar",
    usa: "Temperatura del agua.",
    async probar() {
      const t = await ultimoTiempo("https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21NrtAgg_LonPM180");
      const d = dias(t);
      return { detalle: `Último dato: ${fmtFecha.format(new Date(t))} (${haceDias(d)})`, viejo: d > DIAS_VIGENCIA_SST };
    },
  },
  {
    id: "pacioos-ww3",
    nombre: "PacIOOS WaveWatch III — olas",
    grupo: "Clima y mar",
    usa: "Altura de olas.",
    async probar() {
      const t = await ultimoTiempo("https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global");
      // El pronóstico cubre ~7 días hacia adelante: si ya no llega a mañana, dejó de actualizarse.
      return { detalle: `Pronóstico hasta el ${fmtFecha.format(new Date(t))}`, viejo: Date.parse(t) < Date.now() + 86_400_000 };
    },
  },
  {
    id: "overpass",
    nombre: "OpenStreetMap (Overpass)",
    grupo: "Comunidad",
    usa: "Baños, bebederos y duchas de la rambla. Si falla, se usa lo último que respondió.",
    async probar() {
      const texto = await (
        await pedir(OVERPASS.replace(/interpreter$/, "status"), {
          headers: { "User-Agent": "PlayasUY/1.0 (mapa de playas de Montevideo)" },
        })
      ).text();
      const libres = texto.match(/(\d+) slots? available now/)?.[1];
      return { detalle: libres ? `${libres} cupos libres ahora` : "Responde" };
    },
  },
  {
    id: "inaturalist",
    nombre: "iNaturalist — aguas vivas",
    grupo: "Comunidad",
    usa: "Avistamientos de aguas vivas.",
    async probar() {
      const avist = await getAguasVivas();
      if (!avist) throw new Error("No respondió (detalle en los logs)");
      const n = avist.length;
      return { detalle: `${n} reporte${n === 1 ? "" : "s"} en los últimos ${DIAS_VIGENCIA_AGUAS_VIVAS} días` };
    },
  },
  {
    id: "gtfs-copia",
    nombre: "Copia de los horarios del STM (Supabase)",
    grupo: "Sitio",
    usa: "Horarios de “Cómo ir” cuando la API de transporte de la IM no responde. Se actualiza a mano con `npm run gtfs`.",
    async probar() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
      const { version, hasta } = (await (await pedir(`${url}/storage/v1/object/public/gtfs/version.json`)).json()) as {
        version: string;
        hasta: string | null;
      };
      const v = /^\d{8}$/.test(version) ? new Date(`${version.slice(0, 4)}-${version.slice(4, 6)}-${version.slice(6)}T12:00:00-03:00`) : null;
      const fin = hasta ? new Date(`${hasta}T23:59:59-03:00`) : null;
      return {
        detalle: `Versión ${v ? `del ${fmtFecha.format(v)}` : version}${fin ? `, vale hasta el ${fmtFecha.format(fin)}` : ""}`,
        viejo: fin ? fin.getTime() < Date.now() : false,
      };
    },
  },
  {
    id: "supabase",
    nombre: "Supabase — me gusta",
    grupo: "Sitio",
    usa: "Me gusta y ranking de favoritas.",
    async probar() {
      const totales = await getMeGusta();
      if (!totales) throw new Error("No respondió o faltan las variables de entorno (detalle en los logs)");
      return { detalle: `${totales.size} playas con me gusta` };
    },
  },
];

export async function getEstadoFuentes(): Promise<{ chequeos: Chequeo[]; hora: number }> {
  const hora = Date.now();
  const chequeos = await Promise.all(
    DEFS.map(async ({ probar, ...def }): Promise<Chequeo> => {
      const t0 = performance.now();
      try {
        const { detalle, viejo } = await conLimite(probar());
        return { ...def, estado: viejo ? "viejo" : "ok", detalle, ms: Math.round(performance.now() - t0) };
      } catch (e) {
        return { ...def, estado: "caido", detalle: describirError(e), ms: Math.round(performance.now() - t0) };
      }
    }),
  );
  return { chequeos, hora };
}
