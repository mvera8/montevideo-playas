// Precarga los horarios del STM al iniciar el servidor, para que la primera
// consulta de "cómo ir" no espere la descarga y el procesamiento del GTFS (~3 s).
// Solo en un servidor propio (dev, `next start`): en Vercel cada instancia nueva corre esto, aunque
// nunca atienda "cómo ir", y gastaba ~17 MB de descarga y 2–3 s de CPU activa (el plan Hobby trae
// 4 h por mes). Ahí el índice se arma la primera vez que se usa (`getIndice`).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.VERCEL) return;
  if (!process.env.IM_TRANSPORTE_CLIENT_ID || !process.env.IM_TRANSPORTE_CLIENT_SECRET) return;

  const { getIndice } = await import("./lib/transporte/gtfs");
  // Sin await: no bloquea el arranque del servidor.
  getIndice().catch((e) => console.error("[gtfs] no se pudo precargar:", e));
}
