// Lógica pura (cliente y servidor) para recomendar playas y horarios.
// Clave en Montevideo: el viento. Con viento "de frente" (desde el agua) hay olas y
// se siente más frío; con viento "de tierra" la playa queda reparada.

import type { Playa, Temporada } from "./playas";

// Hacia dónde mira cada playa (rumbo desde la arena hacia el agua, en grados).
// Aproximado a partir de la línea de costa; la costa este mira al SSE y la oeste al SO.
const ORIENTACION: Record<string, number> = {
  "punta-espinillo": 225,
  "la-colorada": 215,
  "pajas-blancas": 210,
  zabala: 200,
  "los-cilindros": 200,
  "punta-yeguas": 185,
  "santa-catalina": 185,
  "del-nacional": 180,
  "del-cerro": 140,
  ramirez: 190,
  pocitos: 155,
  buceo: 165,
  malvin: 170,
  brava: 175,
  honda: 170,
  "los-ingleses": 175,
  verde: 175,
  "la-mulata": 170,
  carrasco: 160,
};

export const orientacion = (slug: string) => ORIENTACION[slug] ?? 180;

const PUNTOS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export const puntoCardinal = (deg: number) => PUNTOS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

export type ExposicionViento = { tipo: "frente" | "lateral" | "tierra"; factor: number };

/** factor: 1 = viento de frente puro (desde el agua), -1 = de tierra puro. */
export function exposicion(slug: string, vientoDesde: number): ExposicionViento {
  const d = Math.abs(((vientoDesde - orientacion(slug) + 540) % 360) - 180); // 0 = desde el agua
  const factor = Math.cos((d * Math.PI) / 180);
  return { tipo: d < 60 ? "frente" : d > 120 ? "tierra" : "lateral", factor };
}

// general: describe el momento (noche, frío, lluvia), no a una playa en particular.
export type Motivo = { texto: string; tono: "bien" | "mal" | "info"; general?: boolean };

export type Viaje = { minutos: number; resumen: string }; // resumen: "104", "121 › 104", "a pie"

export type Recomendacion = {
  slug: string;
  puntaje: number; // 0–100
  calidad: Calidad;
  motivos: Motivo[];
  viaje: Viaje | null;
};

export type Calidad = "Ideal" | "Buena" | "Aceptable" | "No recomendable";
export const calidad = (p: number): Calidad =>
  p >= 75 ? "Ideal" : p >= 55 ? "Buena" : p >= 40 ? "Aceptable" : "No recomendable";

const LLUVIA = (code: number) => code >= 51;

export function recomendar(
  playas: Playa[],
  temporada: Temporada,
  viajes: Record<string, Viaje> | null = null,
): Recomendacion[] {
  return playas
    .map((p) => {
      const motivos: Motivo[] = [];
      let s = 60;
      const c = p.clima;

      // Banderas (solo cuentan si están vigentes).
      const banderas = new Set(p.guardavidas.map((g) => g.bandera));
      let tope = 100;
      if (banderas.has("red") || banderas.has("black")) {
        tope = 15;
        motivos.push({ texto: banderas.has("red") ? "Bandera roja" : "Bandera negra", tono: "mal" });
      } else if (banderas.has("yellow")) {
        s -= 10;
        motivos.push({ texto: "Bandera amarilla", tono: "mal" });
      } else if (banderas.has("green")) {
        s += 10;
        motivos.push({ texto: "Bandera verde", tono: "bien" });
      }
      if (p.guardavidas.some((g) => g.banderaSanitaria?.activa)) {
        s -= 40;
        motivos.push({ texto: "Bandera sanitaria", tono: "mal" });
      }

      if (c) {
        // Viento según orientación de la playa.
        const e = exposicion(p.slug, c.windDirection);
        const desde = puntoCardinal(c.windDirection);
        if (c.windSpeed < 10) {
          s += 5;
          motivos.push({ texto: "Poco viento", tono: "bien" });
        } else if (e.tipo === "frente") {
          s -= Math.min(25, c.windSpeed * 0.8 * e.factor);
          motivos.push({ texto: `Viento ${desde} de frente`, tono: "mal" });
        } else if (e.tipo === "tierra") {
          s += 8;
          motivos.push({ texto: `Reparada del viento ${desde}`, tono: "bien" });
        }

        // Confort: con menos de 20° de sensación no es día de playa.
        if (c.feelsLike >= 24) s += 10;
        else if (c.feelsLike < 20) {
          s -= Math.min(50, (20 - c.feelsLike) * 3.5);
          motivos.push({ texto: `Sensación ${Math.round(c.feelsLike)}°`, tono: "mal", general: true });
        }
        if (c.feelsLike > 32) s -= (c.feelsLike - 32) * 3;
        if (!c.isDay) {
          tope = Math.min(tope, 30);
          motivos.unshift({ texto: "De noche", tono: "info", general: true });
        }
        if (LLUVIA(c.weatherCode)) {
          s -= 20;
          motivos.push({ texto: c.description, tono: "mal", general: true });
        }
        if (c.waveHeight != null && c.waveHeight > 1) {
          s -= 10;
          motivos.push({ texto: `Olas de ${c.waveHeight.toFixed(1)} m`, tono: "mal" });
        }
        if (c.uvIndex >= 8) motivos.push({ texto: "UV muy alto", tono: "info" });
      }

      // Cuánto tardás en llegar.
      const viaje = viajes?.[p.slug] ?? null;
      if (viaje) {
        if (viaje.minutos > 15) s -= Math.min(25, (viaje.minutos - 15) * 0.5);
        motivos.push({
          texto: viaje.resumen === "a pie" ? `${viaje.minutos} min a pie` : `${viaje.minutos} min en ${viaje.resumen}`,
          tono: viaje.minutos <= 25 ? "bien" : "info",
        });
      } else if (viajes) {
        s -= 25;
        motivos.push({ texto: "Sin ómnibus directo ahora", tono: "mal" });
      }

      if (!temporada.activa) motivos.push({ texto: "Sin guardavidas", tono: "info" });

      const puntaje = Math.round(Math.max(0, Math.min(tope, s)));
      return { slug: p.slug, puntaje, calidad: calidad(puntaje), motivos, viaje };
    })
    .sort((a, b) => b.puntaje - a.puntaje);
}

// ---------- mejor horario del día ----------

export type Hora = {
  hora: string; // ISO local "2026-11-20T15:00"
  temp: number;
  sensacion: number;
  lluvia: number; // % probabilidad
  uv: number;
  viento: number;
  rafagas: number;
  vientoDesde: number;
  code: number;
  olas: number | null;
};

export type Franja = {
  desde: string; // ISO local
  hasta: string; // ISO local (exclusivo)
  puntaje: number;
  calidad: Calidad;
  motivos: Motivo[];
};

export function puntajeHora(slug: string, h: Hora) {
  let s = 100;
  if (h.sensacion < 24) s -= (24 - h.sensacion) * 4;
  if (h.sensacion > 31) s -= (h.sensacion - 31) * 4;
  s -= h.lluvia * 0.6;
  if (h.uv > 7) s -= (h.uv - 7) * 6;
  const e = exposicion(slug, h.vientoDesde);
  if (e.factor > 0 && h.viento >= 10) s -= Math.min(30, h.viento * e.factor);
  if (h.rafagas > 40) s -= 15;
  if (h.code >= 95) s -= 60;
  else if (h.code >= 61) s -= 40;
  return Math.max(0, Math.min(100, s));
}

/**
 * Mejor franja de 2 a 4 horas de luz entre `desde` y la puesta del sol.
 * `horas` debe estar ordenado; `luz` son pares [amanecer, atardecer] ISO por día.
 */
export function mejorFranja(slug: string, horas: Hora[], ahoraIso: string, luz: [string, string][]): Franja | null {
  // Horas completas con sol: empiezan después del amanecer y terminan antes del atardecer.
  const deDia = (h: Hora) =>
    h.hora >= ahoraIso.slice(0, 13) &&
    luz.some(([sale, pone]) => h.hora > sale && h.hora.slice(0, 13) < pone.slice(0, 13));

  // Probar hoy; si ya no queda luz, mañana.
  const dias = [...new Set(horas.filter(deDia).map((h) => h.hora.slice(0, 10)))];
  for (const dia of dias.slice(0, 2)) {
    const lista = horas.filter((h) => deDia(h) && h.hora.startsWith(dia));
    const puntos = lista.map((h) => puntajeHora(slug, h));
    let mejor: { i: number; n: number; prom: number } | null = null;
    for (let n = 4; n >= 2; n--)
      for (let i = 0; i + n <= lista.length; i++) {
        const prom = puntos.slice(i, i + n).reduce((a, b) => a + b, 0) / n;
        // Preferimos franjas más largas salvo que una corta sea claramente mejor.
        if (!mejor || prom > mejor.prom + (n < mejor.n ? 3 : 0)) mejor = { i, n, prom };
      }
    if (!mejor) continue;
    const tramo = lista.slice(mejor.i, mejor.i + mejor.n);
    const motivos: Motivo[] = [];
    const prom = (f: (h: Hora) => number) => tramo.reduce((a, h) => a + f(h), 0) / tramo.length;
    motivos.push({ texto: `Sensación ${Math.round(prom((h) => h.sensacion))}°`, tono: prom((h) => h.sensacion) >= 22 ? "bien" : "info" });
    const lluvia = Math.max(...tramo.map((h) => h.lluvia));
    motivos.push(lluvia <= 20 ? { texto: "Sin lluvia", tono: "bien" } : { texto: `Lluvia ${lluvia}%`, tono: "mal" });
    const uv = Math.max(...tramo.map((h) => h.uv));
    motivos.push(uv <= 5 ? { texto: `UV ${Math.round(uv)}`, tono: "bien" } : { texto: `UV ${Math.round(uv)}: protegete`, tono: "info" });
    const e = exposicion(slug, tramo[0].vientoDesde);
    if (e.tipo === "tierra") motivos.push({ texto: "Reparada del viento", tono: "bien" });
    else if (e.tipo === "frente" && prom((h) => h.viento) >= 15) motivos.push({ texto: "Viento de frente", tono: "mal" });

    const fin = new Date(`${tramo[tramo.length - 1].hora}:00`);
    fin.setHours(fin.getHours() + 1);
    const p = Math.round(mejor.prom);
    return {
      desde: tramo[0].hora,
      hasta: `${dia}T${String(fin.getHours()).padStart(2, "0")}:00`,
      puntaje: p,
      calidad: calidad(p),
      motivos,
    };
  }
  return null;
}
