import { hasImCredentials } from "@/lib/im";
import { getPlayas } from "@/lib/playas";
import type { Viaje } from "@/lib/recomendacion";
import { SIN_CACHE, leerCuerpo, validarPunto } from "@/lib/transporte/coordenadas";
import { planificar } from "@/lib/transporte/planificador";

// POST /api/viajes  { desde: {lat, lon} } → mejor forma de llegar ahora a cada playa (para el ranking).
// Solo viajes directos o a pie: es rápido y alcanza para comparar playas.
// La ubicación se usa solo para calcular la respuesta: no se guarda ni se registra.
export async function POST(req: Request) {
  const desde = validarPunto((await leerCuerpo(req))?.desde);
  if (!desde) return Response.json({ error: "Origen inválido o fuera de Montevideo" }, { status: 400, headers: SIN_CACHE });
  if (!hasImCredentials("transporte")) return Response.json({ viajes: {} }, { headers: SIN_CACHE });

  const { playas } = await getPlayas();
  const viajes: Record<string, Viaje> = {};
  for (const p of playas) {
    const [mejor] = await planificar(desde, { lat: p.lat, lon: p.lon }, { trasbordos: false });
    if (!mejor) continue;
    const lineas = mejor.tramos.filter((t) => t.tipo === "omnibus").map((t) => t.linea);
    viajes[p.slug] = { minutos: mejor.minutos, resumen: lineas.length ? lineas.join(" › ") : "a pie" };
  }
  return Response.json({ viajes }, { headers: SIN_CACHE });
}
