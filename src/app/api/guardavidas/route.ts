import { getPlayas } from "@/lib/playas";
import { CACHE_API_5_MIN } from "@/lib/cache-api";

// GET /api/guardavidas → casillas de guardavidas (aplanadas) y estado de la temporada.
export async function GET() {
  const { fuente, error, temporada, playas } = await getPlayas();
  const guardavidas = playas.flatMap((p) =>
    p.guardavidas.map((g) => ({ ...g, playa: p.nombre, playaSlug: p.slug })),
  );
  return Response.json({ fuente, error, temporada, guardavidas }, { headers: { "Cache-Control": CACHE_API_5_MIN } });
}
