import { getPlayas } from "@/lib/playas";
import { mejorFranja } from "@/lib/recomendacion";
import { getPronostico } from "@/lib/weather";

// GET /api/pronostico/pocitos → pronóstico hora a hora (hoy y mañana) y mejor franja para ir.
export async function GET(_req: Request, ctx: RouteContext<"/api/pronostico/[playa]">) {
  const { playa: slug } = await ctx.params;
  const { playas } = await getPlayas();
  const playa = playas.find((p) => p.slug === slug);
  if (!playa) return Response.json({ error: `No existe la playa "${slug}"` }, { status: 404 });

  try {
    const { ahora, horas, luz } = await getPronostico(playa.lat, playa.lon);
    // Desde la hora actual hasta el final de mañana.
    const proximas = horas.filter((h) => h.hora >= ahora.slice(0, 13));
    return Response.json(
      { ahora, horas: proximas, luz, mejor: mejorFranja(playa.orientacion, horas, ahora, luz) },
      // s-maxage: la sirve el CDN de Vercel sin invocar la función (el clima de base se renueva cada 30 min).
      { headers: { "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=1800" } },
    );
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Sin pronóstico" }, { status: 502 });
  }
}
