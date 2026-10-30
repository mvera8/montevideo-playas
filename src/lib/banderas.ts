import type { Guardavidas } from "./playas";

// Banderas de las casillas: lógica compartida entre el servidor (src/lib/playas.ts, con la API de la IM)
// y el navegador (src/lib/banderas-cliente.ts, con el sitio móvil de la IM). Sin "server-only".
//
// Sitio móvil de la IM (https://m.montevideo.gub.uy/playas/api/…): JSON público, sin auth, no documentado.
// - /casillas: GeoJSON de las 32 casillas con banderas, vencimientos y causa (~3 KB, ~0,1 s).
// - /clima: UV medido (`ValorIndiceUV`), un valor para la ciudad (369 B).
// Responde CORS a cualquier origen (`access-control-allow-origin` refleja el Origin, verificado
// 26/10/2026): por eso el navegador lo puede pedir directo cuando el servidor no llega a la IM.

export const URL_CASILLAS_MOVIL = "https://m.montevideo.gub.uy/playas/api/casillas";
export const URL_CLIMA_MOVIL = "https://m.montevideo.gub.uy/playas/api/clima";
/** Un UV con más horas que esto no se muestra como actual (la IM lo actualiza cada 5 min, medido 20/10/2026). */
export const HORAS_VIGENCIA_UV = 1;

/** Lo que usamos de una casilla para las banderas (mismos campos en la API y en el sitio móvil). */
export type BanderasIm = {
  safetyFlag?: string | null;
  safetyFlagExpiration?: string | null;
  healthFlag?: boolean | "true" | "false" | null; // en la práctica, texto
  healthFlagCauseDesc?: string | null;
  healthFlagCauseLongDesc?: string | null;
  healthFlagExpiration?: string | null;
};

export const BANDERAS: Record<NonNullable<Guardavidas["bandera"]>, { label: string; color: string; corto: [string, string] }> = {
  green: { label: "Verde · apto para bañarse", color: "#1f9d4c", corto: ["verde", "verdes"] },
  yellow: { label: "Amarilla · precaución", color: "#f5c518", corto: ["amarilla", "amarillas"] },
  red: { label: "Roja · no bañarse", color: "#d62828", corto: ["roja", "rojas"] },
  black: { label: "Negra · sin guardavidas", color: "#1b1b1b", corto: ["negra", "negras"] },
};

const SEGURIDAD = new Set(["green", "yellow", "red", "black"]);

// Si la IM informa vencimiento, se respeta; si no lo informa, el dato solo
// se considera válido durante la temporada (fuera de ella no se actualiza).
function vigente(expiration: string | null | undefined, temporadaActiva: boolean) {
  if (expiration) return new Date(expiration).getTime() > Date.now();
  return temporadaActiva;
}

/** Banderas vigentes de una casilla. */
export function banderasDe(s: BanderasIm, temporadaActiva: boolean): Pick<Guardavidas, "bandera" | "banderaSanitaria"> {
  const bandera =
    s.safetyFlag && SEGURIDAD.has(s.safetyFlag) && vigente(s.safetyFlagExpiration, temporadaActiva)
      ? (s.safetyFlag as Guardavidas["bandera"])
      : null;
  // Llega como texto: "false" sería verdadero si se usara tal cual.
  const sanitaria = s.healthFlag === true || s.healthFlag === "true";
  const banderaSanitaria =
    s.healthFlag != null && vigente(s.healthFlagExpiration, temporadaActiva)
      ? {
          activa: sanitaria,
          causa: s.healthFlagCauseDesc || null,
          detalle: sanitaria ? (s.healthFlagCauseLongDesc ?? null) : null,
        }
      : null;
  return { bandera, banderaSanitaria };
}
