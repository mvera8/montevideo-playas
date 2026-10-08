import "server-only";

// Aguas vivas (medusas) reportadas por la comunidad en iNaturalist, cerca de cada playa.
// No hay un monitoreo oficial de aguas vivas en Montevideo: esto son avistamientos voluntarios.
//
// - URL: https://api.inaturalist.org/v2/observations (JSON, sin API key). Se pide una caja fija sobre
//   la costa de Montevideo (de Punta Espinillo a Lagomar), los últimos DIAS_VIGENCIA días, con `fields`
//   para traer solo lo que se usa: ~1,6 KB en vez de ~550 KB (la v1 no tiene `fields` y manda todo:
//   fotos, identificaciones, usuario). Tarda ~1,8 s, por eso se cachea 1 h y tiene timeout.
// - Taxones: Scyphozoa (48332, p. ej. Lychnorhiza lucerna, la agua viva típica del Río de la Plata, y
//   Chrysaora lactea), Hydrozoa (48921, p. ej. Physalia physalis "fragata portuguesa" y Olindias) y
//   Cubozoa (68095), sin Hydra (203710, de agua dulce). Solo grado "research" (identificación
//   confirmada por la comunidad) y "needs_id" (sin confirmar, se marca); "casual" no trae foto o fecha.
//   `geoprivacy=open&taxon_geoprivacy=open`: las coordenadas ocultas se corren hasta ~20 km, inútiles acá.
// - Pide un User-Agent que identifique la app y no pasar de ~60 pedidos/min: hacemos 1 por hora.
// - Frecuencia real (medida 08/10/2026): ~31 observaciones en 2018-2026 en toda la caja, 2 a 7 por año,
//   casi todas de noviembre a marzo (pico en enero-febrero). Es poco: la falta de reportes NO significa
//   que no haya aguas vivas, y la interfaz lo aclara.
// - Vigencia: un arribazón dura días. Un reporte con más de DIAS_VIGENCIA días no se muestra como
//   actual: se descarta. Sin reportes vigentes la sección de la playa no se muestra (con tan pocos por año
//   estaría vacía casi siempre), así que solo se piden los últimos DIAS_VIGENCIA días.
// - Licencias: cada observación tiene la suya (CC0, CC BY, CC BY-NC o todos los derechos). Solo
//   mostramos hechos (especie, fecha, lugar aproximado) con enlace a la observación; no mostramos fotos,
//   textos ni el nombre de quien la subió.

const URL_API = "https://api.inaturalist.org/v2/observations";
const USER_AGENT = "PlayasUY/0.1 (+https://github.com/mvera8/montevideo-playas)";
const CAJA = { swlat: -34.98, swlng: -56.45, nelat: -34.75, nelng: -55.95 };
const TAXONES = "48332,48921,68095";
const SIN_TAXONES = "203710";
const CACHE_S = 3600;
const TIMEOUT = 8000;
export const DIAS_VIGENCIA = 10;
// A qué distancia de la playa un reporte cuenta como "cerca" (las corrientes las mueven por la costa).
export const KM_CERCA = 5;
// Precisión peor que esto (radio declarado) no sirve para ubicarla en una playa.
const MAX_PRECISION_M = 5000;
// Si iNaturalist no responde, no lo volvemos a consultar por 5 min (ver PAUSA_FALLA en mar.ts).
const PAUSA_FALLA = 5 * 60_000;

const M_LAT = 110_540;
const M_LON = 111_320 * Math.cos((-34.9 * Math.PI) / 180);

// Nombres comunes en español: iNaturalist no los tiene para casi ninguna especie local.
const NOMBRES: Record<string, string> = {
  "Lychnorhiza lucerna": "Agua viva (Lychnorhiza)",
  "Chrysaora lactea": "Agua viva (Chrysaora)",
  "Olindias sambaquiensis": "Agua viva (Olindias)",
  "Physalia physalis": "Fragata portuguesa",
  "Physalia megalista": "Fragata portuguesa",
};
// Especies que pican fuerte: se destacan.
const PELIGROSAS = new Set(["Physalia physalis", "Physalia megalista", "Olindias sambaquiensis"]);

export type Avistamiento = {
  id: number;
  fecha: string; // "YYYY-MM-DD"
  especie: string; // nombre científico
  nombre: string; // para mostrar
  peligrosa: boolean;
  confirmada: boolean; // grado "research"
  lugar: string | null;
  lat: number;
  lon: number;
  url: string;
};

export type AvistamientoPlaya = Omit<Avistamiento, "lat" | "lon"> & { km: number; dias: number };

export type AguasVivasPlaya = {
  recientes: AvistamientoPlaya[]; // últimos DIAS_VIGENCIA días en toda la costa, del más cercano al más lejano
};

type Obs = {
  id: number;
  observed_on: string | null;
  location: string | null;
  place_guess: string | null;
  quality_grade: string;
  positional_accuracy: number | null;
  taxon: { name: string; preferred_common_name?: string | null } | null;
};

const hoyUy = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
const diasDesde = (fecha: string) => Math.round((Date.parse(hoyUy()) - Date.parse(fecha)) / 86_400_000);

// "Rbla. República De Chile e Hipólito Yrigoyen, 11400 Montevideo, ..." → "Rbla. República De Chile e Hipólito Yrigoyen"
function lugarCorto(s: string | null) {
  const primero = s?.split(",")[0].trim();
  return !primero || /^(uruguay|montevideo)$/i.test(primero) ? null : primero;
}

let caidoHasta = 0;

async function getAvistamientos(): Promise<Avistamiento[]> {
  if (caidoHasta > Date.now()) throw new Error("iNaturalist en pausa tras una falla");
  // Un día de margen: `d1` es en UTC y el filtro fino (diasDesde) se hace con la fecha de Uruguay.
  const desde = new Date(Date.now() - (DIAS_VIGENCIA + 1) * 86_400_000).toISOString().slice(0, 10);
  const qs = new URLSearchParams({
    ...Object.fromEntries(Object.entries(CAJA).map(([k, v]) => [k, String(v)])),
    taxon_id: TAXONES,
    without_taxon_id: SIN_TAXONES,
    quality_grade: "research,needs_id",
    geoprivacy: "open",
    taxon_geoprivacy: "open",
    d1: desde,
    order_by: "observed_on",
    per_page: "100",
    fields: "id,observed_on,location,place_guess,quality_grade,positional_accuracy,taxon.name,taxon.preferred_common_name",
  });
  let res: Response;
  try {
    res = await fetch(`${URL_API}?${qs}`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: CACHE_S },
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch (e) {
    caidoHasta = Date.now() + PAUSA_FALLA;
    throw e;
  }
  if (res.status >= 500) caidoHasta = Date.now() + PAUSA_FALLA;
  if (!res.ok) throw new Error(`iNaturalist falló (${res.status})`);
  const { results } = (await res.json()) as { results: Obs[] };

  return results.flatMap((o) => {
    if (!o.observed_on || !o.location || !o.taxon) return [];
    if (o.positional_accuracy != null && o.positional_accuracy > MAX_PRECISION_M) return [];
    const [lat, lon] = o.location.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const especie = o.taxon.name;
    return [
      {
        id: o.id,
        fecha: o.observed_on.slice(0, 10),
        especie,
        nombre: NOMBRES[especie] ?? o.taxon.preferred_common_name ?? especie,
        peligrosa: PELIGROSAS.has(especie),
        confirmada: o.quality_grade === "research",
        lugar: lugarCorto(o.place_guess),
        lat,
        lon,
        url: `https://www.inaturalist.org/observations/${o.id}`,
      },
    ];
  });
}

/** Avistamientos de la costa (null si iNaturalist no respondió). */
export async function getAguasVivas(): Promise<Avistamiento[] | null> {
  return getAvistamientos().catch((e) => {
    console.error(e);
    return null;
  });
}

/** Lo que muestra el detalle de una playa: reportes vigentes de la costa, del más cercano al más lejano. */
export function aguasVivasPara(avistamientos: Avistamiento[] | null, p: { lat: number; lon: number }): AguasVivasPlaya | null {
  if (!avistamientos) return null;
  const recientes = avistamientos
    .filter((a) => diasDesde(a.fecha) <= DIAS_VIGENCIA)
    .map(({ lat, lon, ...a }) => ({
      ...a,
      dias: diasDesde(a.fecha),
      km: Math.round(Math.hypot((lat - p.lat) * M_LAT, (lon - p.lon) * M_LON) / 100) / 10,
    }))
    .sort((a, b) => a.km - b.km);
  return { recientes };
}
