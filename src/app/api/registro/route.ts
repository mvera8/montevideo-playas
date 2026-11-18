import { armarRegistro } from "@/lib/registro";

// GET /api/registro → foto de banderas, clima y agua para el registro de la temporada. La pide Supabase
// cada 30 min (pg_cron, ver src/lib/registro.ts); no la usa el sitio.
export const maxDuration = 60;

export async function GET() {
  // 2 min en el CDN: alcanza para que pedidos repetidos no lleguen a la función, y la foto siguiente
  // (30 min después) siempre es nueva.
  return Response.json(await armarRegistro(), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=120" },
  });
}
