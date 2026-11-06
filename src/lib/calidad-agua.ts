import "server-only";
import { DIAS_HISTORIAL, descargar, descargarReciente, hace, huella, procesar, URL_MEDIAS, URL_MUESTRAS, type CalidadAgua } from "./calidad-agua-datos";

// Calidad del agua en playas, con caché en el servidor. Descarga y criterio en calidad-agua-datos.ts.
export * from "./calidad-agua-datos";

const CACHE_MS = 3 * 60 * 60 * 1000; // cada cuánto se verifica si hay datos nuevos (HEAD)
// Tope de toda la actualización, con una carrera y no con `signal`: abortar estas lecturas colgaba el build
// (ver README, "Calidad del agua"). Si falla, no se reintenta hasta PAUSA_FALLA: todo getPlayas() la espera.
const TOPE_ACTUALIZAR = 15_000;
const PAUSA_FALLA = 5 * 60_000;

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
  if (Date.now() - estado.hora < CACHE_MS) return estado.datos ?? new Map();
  estado.promesa ??= Promise.race([
    actualizar(),
    new Promise<never>((_, rechazar) => setTimeout(() => rechazar(new Error("Calidad de agua IM: no respondió a tiempo")), TOPE_ACTUALIZAR)),
  ])
    .then((d) => {
      estado.datos = d;
      estado.hora = Date.now();
      return d;
    })
    .catch((e) => {
      console.error(e);
      estado.hora = Date.now() - CACHE_MS + PAUSA_FALLA;
      return estado.datos ?? new Map();
    })
    .finally(() => {
      estado.promesa = undefined;
    });
  // Con datos anteriores no se espera: se actualizan para el próximo render.
  return estado.datos ?? estado.promesa;
}
