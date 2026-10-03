import { llegadas } from "@/lib/transporte/tiempo-real";

// GET /api/omnibus/llegadas?tramos=8:3009,4585:1234   (variante:parada)
// Estimación en vivo de los próximos ómnibus de cada variante a su parada.
export async function GET(req: Request) {
  const tramos = (new URL(req.url).searchParams.get("tramos") ?? "")
    .split(",")
    .map((t) => t.split(":"))
    .filter(([v, p]) => /^\d+$/.test(v) && /^\d+$/.test(p ?? ""))
    .slice(0, 4);
  if (!tramos.length) {
    return Response.json({ error: "Formato: tramos=variante:parada,..." }, { status: 400 });
  }
  try {
    const resultados = await Promise.all(
      tramos.map(async ([v, p]) => ({ variante: Number(v), parada: p, llegadas: await llegadas(Number(v), p) })),
    );
    return Response.json({ resultados, actualizado: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Sin datos en vivo" }, { status: 502 });
  }
}
