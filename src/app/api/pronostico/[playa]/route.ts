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
      { headers: { "Cache-Control": "public, max-age=600" } },
    );
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Sin pronóstico" }, { status: 502 });
  }
}
