import { hasImCredentials } from "@/lib/im";
import { crearLimite, demasiadosPedidos, ipDe } from "@/lib/limite";
import { SIN_CACHE, leerCuerpo, validarPunto } from "@/lib/transporte/coordenadas";
import { planificar } from "@/lib/transporte/planificador";

// POST /api/como-ir  { desde: {lat, lon}, hasta: {lat, lon} }
// Opciones para llegar en ómnibus (STM): directas o con un trasbordo, según horarios.
// La ubicación se usa solo para calcular la respuesta: no se guarda ni se registra.
// Cada pedido arma recorridos sobre el GTFS: tope de 20 por minuto por IP (una persona cambiando
// origen y destino no llega ni cerca).
const VENTANA_MS = 60_000;
const superaLimite = crearLimite({ max: 20, ventanaMs: VENTANA_MS });

export async function POST(req: Request) {
  if (superaLimite(ipDe(req.headers))) return demasiadosPedidos("Hiciste muchas búsquedas seguidas. Probá de nuevo en un minuto.", VENTANA_MS);
  const cuerpo = await leerCuerpo(req);
  const desde = validarPunto(cuerpo?.desde);
  const hasta = validarPunto(cuerpo?.hasta);
  if (!desde || !hasta) {
    return Response.json(
      { error: "Origen o destino inválidos o fuera de Montevideo" },
      { status: 400, headers: SIN_CACHE },
    );
  }
  if (!hasImCredentials("transporte")) {
    return Response.json(
      { error: "Faltan IM_TRANSPORTE_CLIENT_ID / IM_TRANSPORTE_CLIENT_SECRET" },
      { status: 503, headers: SIN_CACHE },
    );
  }
  try {
    return Response.json({ opciones: await planificar(desde, hasta) }, { headers: SIN_CACHE });
  } catch (e) {
    console.error(e instanceof Error ? e.message : e); // sin coordenadas en los logs
    return Response.json({ error: "No se pudo calcular el recorrido" }, { status: 502, headers: SIN_CACHE });
  }
}
