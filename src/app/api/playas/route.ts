import { getPlayas } from "@/lib/playas";

export const revalidate = 300;

// GET /api/playas → playas de Montevideo con sus casillas de guardavidas y clima.
export async function GET() {
  return Response.json(await getPlayas());
}
