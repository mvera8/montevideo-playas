import { getPlaya } from "@/lib/playas";

// GET /api/clima/pocitos → clima en una playa puntual (por slug).
export async function GET(_req: Request, ctx: RouteContext<"/api/clima/[playa]">) {
  const { playa: slug } = await ctx.params;
  const { playa } = await getPlaya(slug);
  if (!playa) {
    return Response.json({ error: `No existe la playa "${slug}"` }, { status: 404 });
  }
  return Response.json(
    {
      playa: playa.nombre,
      slug: playa.slug,
      lat: playa.lat,
      lon: playa.lon,
      clima: playa.clima,
    },
    // Cacheada en el CDN de Vercel: el clima se renueva cada 30 min (src/lib/weather.ts).
    { headers: { "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=1800" } },
  );
}
