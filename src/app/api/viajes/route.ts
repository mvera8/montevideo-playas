import { hasImCredentials } from "@/lib/im";
import { getPlayas } from "@/lib/playas";
import type { Viaje } from "@/lib/recomendacion";
import { parsePunto } from "@/lib/transporte/coordenadas";
import { planificar } from "@/lib/transporte/planificador";

// GET /api/viajes?desde=lat,lon → mejor forma de llegar ahora a cada playa (para el ranking).
// Solo viajes directos o a pie: es rápido y alcanza para comparar playas.
export async function GET(req: Request) {
  const desde = parsePunto(new URL(req.url).searchParams.get("desde"));
  if (!desde) return Response.json({ error: "desde inválido (lat,lon en Montevideo)" }, { status: 400 });
  if (!hasImCredentials("transporte")) return Response.json({ viajes: {} });

  const { playas } = await getPlayas();
  const viajes: Record<string, Viaje> = {};
  for (const p of playas) {
    const [mejor] = await planificar(desde, { lat: p.lat, lon: p.lon }, { trasbordos: false });
    if (!mejor) continue;
    const lineas = mejor.tramos.filter((t) => t.tipo === "omnibus").map((t) => t.linea);
    viajes[p.slug] = { minutos: mejor.minutos, resumen: lineas.length ? lineas.join(" › ") : "a pie" };
  }
  return Response.json({ viajes });
}
