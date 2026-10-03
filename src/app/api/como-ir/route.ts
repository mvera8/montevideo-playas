import { hasImCredentials } from "@/lib/im";
import { parsePunto } from "@/lib/transporte/coordenadas";
import { planificar } from "@/lib/transporte/planificador";

// GET /api/como-ir?desde=-34.90,-56.16&hasta=-34.91,-56.15
// Opciones para llegar en ómnibus (STM): directas o con un trasbordo, según horarios.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const desde = parsePunto(searchParams.get("desde"));
  const hasta = parsePunto(searchParams.get("hasta"));
  if (!desde || !hasta) {
    return Response.json(
      { error: "Parámetros desde/hasta inválidos o fuera de Montevideo (formato: lat,lon)" },
      { status: 400 },
    );
  }
  if (!hasImCredentials("transporte")) {
    return Response.json(
      { error: "Faltan IM_TRANSPORTE_CLIENT_ID / IM_TRANSPORTE_CLIENT_SECRET" },
      { status: 503 },
    );
  }
  try {
    return Response.json({ opciones: await planificar(desde, hasta) });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "No se pudo calcular el recorrido" }, { status: 502 });
  }
}
