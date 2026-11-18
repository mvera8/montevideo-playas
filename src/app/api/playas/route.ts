import { getPlayas } from "@/lib/playas";
import { CACHE_API_5_MIN } from "@/lib/cache-api";

// GET /api/playas → playas de Montevideo con sus casillas de guardavidas y clima.
export async function GET() {
  return Response.json(await getPlayas(), { headers: { "Cache-Control": CACHE_API_5_MIN } });
}
