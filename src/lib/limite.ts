import "server-only";

// Límite de pedidos por IP, en memoria. Lo usan el formulario de contacto y las rutas de transporte
// (/api/como-ir y /api/viajes), que son las que cuestan: cada pedido arma recorridos sobre el GTFS.
//
// - Es por instancia del servidor (en Vercel cada instancia lleva su cuenta y se reinicia sola):
//   frena el abuso simple de un script, no un ataque distribuido. Para eso, Vercel Firewall →
//   Rate limiting o @upstash/ratelimit.
// - La IP solo se guarda como clave, con las horas de los pedidos de la última ventana; se descarta
//   sola al vencer (limpieza cuando hay más de 1000 IPs). No se registra en ningún lado.
// - La IP sale de x-forwarded-for, que en Vercel pone la propia plataforma (no la manda el cliente).

export function crearLimite({ max, ventanaMs }: { max: number; ventanaMs: number }) {
  const pedidos = new Map<string, number[]>();
  /** true si la IP ya hizo `max` pedidos en la ventana; si no, cuenta este y devuelve false. */
  return function supera(ip: string) {
    const ahora = Date.now();
    const recientes = (pedidos.get(ip) ?? []).filter((t) => ahora - t < ventanaMs);
    if (recientes.length >= max) return true;
    recientes.push(ahora);
    pedidos.set(ip, recientes);
    if (pedidos.size > 1000) for (const [k, v] of pedidos) if (v.every((t) => ahora - t >= ventanaMs)) pedidos.delete(k);
    return false;
  };
}

/** IP del visitante a partir de los headers de la solicitud. */
export function ipDe(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
}

/** Respuesta 429 con Retry-After (en segundos) para las rutas de API. */
export function demasiadosPedidos(mensaje: string, ventanaMs: number) {
  return Response.json(
    { error: mensaje },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil(ventanaMs / 1000)) } },
  );
}
