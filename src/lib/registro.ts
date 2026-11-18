import "server-only";
import { getImUv } from "./im";
import { getPlayas } from "./playas";

// Registro de la temporada: una foto de banderas, clima y agua para analizar la temporada al final (README →
// "Registro de la temporada"). La toma Supabase, no Vercel:
//
// - `pg_cron` corre `public.registrar_hora()` cada 30 min de 8 a 20 h (Montevideo), que pide
//   GET https://montevideo.playas.uy/api/registro con la extensión `http` y guarda la respuesta en las tablas
//   `registro_*` (migración supabase/migrations/20261118115513_registro_temporada.sql). Así Vercel no
//   escribe en la base y no hace falta ninguna clave: la secreta de Supabase nunca va a Vercel.
// - La foto sale de lo mismo que ya muestra el mapa (`getPlayas`, con sus cachés): no hay pedidos nuevos
//   a las fuentes. Las banderas, solo si el servidor llegó a la IM (`fuente === "im"`): desde Vercel la
//   IM responde a veces sí y a veces no (filtra IP de fuera de Uruguay). Si no llega, esa media hora queda
//   sin banderas (`registro_corridas.banderas_ok = false`) y la base guarda solo clima y agua.
// - Las banderas ya vienen filtradas por vigencia (`banderasDe`): null = sin bandera vigente, como en el mapa.
// - El clima lleva la hora del paso del pronóstico (`pronostico_hora`): las vistas descartan los de más
//   de 3 h (caché vieja). Es el pronóstico de MET Norway, no una medición.
// - El agua: estado de la playa (criterio del Decreto 226/025, ver calidad-agua-datos.ts) y las últimas
//   muestras de cada punto. Las muestras se repiten entre fotos; la base las guarda una vez (clave playa,
//   punto y fecha), y la primera foto ya trae ~40 días hacia atrás (10 muestras por punto).
// - Peso: ~30 KB de JSON por foto, 24 fotos por día (dos por hora; la segunda pisa a la primera).

const n = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? null : v);

export async function armarRegistro() {
  const [{ fuente, error, temporada, playas }, uv] = await Promise.all([getPlayas(), getImUv()]);
  const conBanderas = fuente === "im" && temporada.activa;

  return {
    generado: new Date().toISOString(),
    fuente,
    error,
    temporada_activa: temporada.activa,
    uv_im: uv?.valor ?? null,
    // Vacío si no hay banderas de la IM: "sin dato" no es lo mismo que "sin bandera vigente".
    casillas: conBanderas
      ? playas.flatMap((p) =>
          p.guardavidas.map((g) => ({
            casilla: g.id,
            playa: p.slug,
            bandera: g.bandera,
            sanitaria: g.banderaSanitaria?.activa ?? null,
            sanitaria_causa: g.banderaSanitaria?.activa ? g.banderaSanitaria.causa : null,
          })),
        )
      : [],
    playas: playas.map((p) => ({
      playa: p.slug,
      // Hora local de Montevideo (UTC−3 fijo) → con zona, para que Postgres la lea como timestamptz.
      pronostico_hora: p.clima ? `${p.clima.time}:00-03:00` : null,
      temp_aire: n(p.clima?.airTemp),
      sensacion: n(p.clima?.feelsLike),
      humedad: n(p.clima?.humidity),
      viento_kmh: n(p.clima?.windSpeed),
      viento_dir: p.clima ? Math.round(p.clima.windDirection) : null,
      cielo: n(p.clima?.weatherCode),
      uv_max: n(p.clima?.uvMax),
      temp_agua: n(p.clima?.waterTemp),
      ola_m: n(p.clima?.waveHeight),
      agua_estado: p.agua?.estado ?? null,
      ciano: p.agua?.ciano ?? null,
    })),
    muestras: playas.flatMap((p) =>
      (p.agua?.puntos ?? []).flatMap((pt) =>
        pt.historial.map((m) => ({
          playa: p.slug,
          punto: pt.codigo,
          fecha: m.fecha,
          enterococos: n(m.enterococos),
          ciano: m.ciano,
          representativa: m.representativa,
        })),
      ),
    ),
  };
}
