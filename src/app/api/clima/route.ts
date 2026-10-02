import { getMontevideoWeather } from "@/lib/weather";

export const revalidate = 900;

// GET /api/clima → clima actual en Montevideo (aire y agua).
export async function GET() {
  try {
    return Response.json({ ciudad: "Montevideo", clima: await getMontevideoWeather() });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
