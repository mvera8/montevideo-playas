import type { Instrumentation } from "next";
import { registrarError } from "./lib/errores";

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

// Cualquier error del servidor (render, rutas de API, server actions, proxy) va a la tabla `errores` de
// Supabase (src/lib/errores.ts): en el plan Hobby, Vercel guarda los logs solo un rato y no avisa.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err instanceof Error ? err : null;
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  const ua = request.headers["user-agent"];
  await registrarError({
    origen: "servidor",
    mensaje: e?.message ?? String(err),
    ruta: request.path,
    contexto: `${context.routeType} ${context.routePath}`,
    digest,
    stack: e?.stack,
    navegador: Array.isArray(ua) ? ua[0] : ua,
  });
};
