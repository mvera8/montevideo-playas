// Registro de errores propio, en vez de Sentry: los guarda en la tabla `errores` de Supabase (mismo
// proyecto que los me gusta, ver README → "Errores"). Sirve en el servidor y en el navegador.
//
// - Servidor: `onRequestError` de src/instrumentation.ts (render, rutas de API, server actions, proxy).
// - Navegador: src/app/error.tsx y global-error.tsx (errores al renderizar), y src/instrumentation-client.ts
//   para lo que queda fuera de React (handlers de eventos, mapa, promesas sin catch). Si el error trae
//   `digest` viene del servidor y ya quedó registrado ahí, así que no se manda de nuevo. Se descarta
//   el ruido (sin conexión, pedidos cancelados, extensiones; ver `RUIDO`).
// - Destino: POST {NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/registrar_error con header `apikey` (clave
//   publicable). La función agrupa el mismo error del día (columna `veces`), recorta los textos, pone un
//   tope de 200 errores distintos por día y borra lo de más de 30 días. La tabla no se puede leer con la API.
// - Qué se manda: mensaje, ruta sin query string, contexto, digest, stack y user-agent. Nunca IP ni
//   datos de la cuenta.
// - Solo en producción (en dev el error ya se ve en la consola) y nunca falla: si Supabase no responde,
//   se pierde el registro y listo.
// - Ver los errores: Supabase → Table Editor → `errores`, o
//   `select dia, origen, veces, mensaje, ruta, contexto from errores order by ultima desc limit 50;`

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type ReporteError = {
  origen: "servidor" | "cliente";
  mensaje: string;
  ruta?: string;
  contexto?: string;
  digest?: string;
  stack?: string;
  navegador?: string;
};

export async function registrarError(r: ReporteError) {
  if (!URL_SUPABASE || !CLAVE || process.env.NODE_ENV !== "production") return;
  try {
    await fetch(`${URL_SUPABASE}/rest/v1/rpc/registrar_error`, {
      method: "POST",
      headers: { apikey: CLAVE, "Content-Type": "application/json" },
      // Recortado también acá (la base vuelve a recortar) para mandar poco y entrar en `keepalive` (64 kB).
      body: JSON.stringify({
        p_origen: r.origen,
        p_mensaje: r.mensaje.slice(0, 500),
        p_ruta: r.ruta?.split("?")[0].slice(0, 200),
        p_contexto: r.contexto?.slice(0, 100),
        p_digest: r.digest?.slice(0, 40),
        p_stack: r.stack?.slice(0, 2000),
        p_navegador: r.navegador?.slice(0, 200),
      }),
      keepalive: true, // que llegue aunque la persona cierre o recargue la página
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Sin registro: no hay a quién avisarle.
  }
}

const enviados = new Set<string>();

// Errores del navegador que no son bugs del sitio: pedidos cancelados, sin conexión (pasa mucho en la
// playa), el aviso inofensivo de ResizeObserver, scripts de otro origen sin datos y extensiones.
const RUIDO = /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|Script error\.?|ResizeObserver loop.*)$/;

function mensajeDe(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/**
 * Para los error boundaries y los errores fuera de React (src/instrumentation-client.ts). Manda cada
 * error una sola vez por carga y como mucho 5 distintos. `ubicacion` reemplaza al stack cuando el
 * navegador no da el objeto del error (solo archivo:línea:columna).
 */
export function reportarErrorCliente(error: unknown, contexto: string, ubicacion?: string) {
  const e = error instanceof Error ? (error as Error & { digest?: string }) : null;
  if (e?.digest) return; // viene del servidor: ya lo registró onRequestError
  if (e && (e.name === "AbortError" || e.name === "TimeoutError")) return;
  const mensaje = mensajeDe(error);
  const stack = e?.stack ?? ubicacion;
  if (RUIDO.test(mensaje) || stack?.includes("-extension://")) return;
  if (enviados.has(mensaje) || enviados.size >= 5) return;
  enviados.add(mensaje);
  void registrarError({
    origen: "cliente",
    mensaje,
    ruta: location.pathname,
    contexto,
    stack,
    navegador: navigator.userAgent,
  });
}
