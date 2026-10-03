// Precarga los horarios del STM al iniciar el servidor, para que la primera
// consulta de "cómo ir" no espere la descarga y el procesamiento del GTFS (~3 s).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.IM_TRANSPORTE_CLIENT_ID || !process.env.IM_TRANSPORTE_CLIENT_SECRET) return;

  const { getIndice } = await import("./lib/transporte/gtfs");
  // Sin await: no bloquea el arranque del servidor.
  getIndice().catch((e) => console.error("[gtfs] no se pudo precargar:", e));
}
