import "server-only";
import { sumarTotales, type TotalesMeGusta } from "./me-gusta-temporada";

// "Me gusta" de las playas: dato propio del sitio, guardado en Supabase (proyecto
// `montevideo-playas`, ver README → "Me gusta"). Este módulo lee solo los totales para el
// render del servidor; dar o sacar un me gusta se hace desde el navegador
// (src/lib/me-gusta-cliente.ts) con una cuenta anónima de Supabase Auth.
//
// Fuente: GET {NEXT_PUBLIC_SUPABASE_URL}/rest/v1/me_gusta_totales?select=playa,temporada,total
// - Autenticación: header `apikey` con la clave publicable (sb_publishable_…). La tabla tiene RLS
//   y solo permite leer; quién dio cada me gusta (tabla `me_gusta`) no es público.
// - Formato: JSON `[{ playa: "pocitos", temporada: "2026-27", total: 12 }, …]`, una fila por
//   playa y temporada (~20 filas por temporada). El total lo mantiene un trigger en la base.
// - Frecuencia: cambia en cualquier momento. Se cachea 5 min, igual que el ISR de la página (no
//   acorta la revalidación). Ojo: ISR sirve la versión vieja al primer visitante después de un rato
//   sin visitas (pueden ser horas), así que el navegador siempre vuelve a pedir los totales al cargar
//   (`useTotalesAlDia` en src/lib/me-gusta-cliente.ts) y corrige lo que vino en el HTML.
// - Si falla o no hay variables de entorno, devuelve null y la página se muestra sin me gusta.

export type { TotalesMeGusta };

export async function getMeGusta(): Promise<Map<string, TotalesMeGusta> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) return null;

  try {
    const res = await fetch(`${url}/rest/v1/me_gusta_totales?select=playa,temporada,total`, {
      headers: { apikey: clave },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Supabase me_gusta_totales: HTTP ${res.status}`);
    return sumarTotales(await res.json());
  } catch (e) {
    console.error(e);
    return null;
  }
}
