import { CACHE_API_15_MIN } from "@/lib/cache-api";
import { getMontevideoWeather } from "@/lib/weather";

// GET /api/clima → clima actual en Montevideo (aire y agua).
export async function GET() {
  try {
    return Response.json(
      { ciudad: "Montevideo", clima: await getMontevideoWeather() },
      { headers: { "Cache-Control": CACHE_API_15_MIN } },
    );
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
