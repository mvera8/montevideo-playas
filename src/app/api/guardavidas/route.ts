import { getPlayas } from "@/lib/playas";

export const revalidate = 300;

// GET /api/guardavidas → casillas de guardavidas (aplanadas) y estado de la temporada.
export async function GET() {
  const { fuente, error, temporada, playas } = await getPlayas();
  const guardavidas = playas.flatMap((p) =>
    p.guardavidas.map((g) => ({ ...g, playa: p.nombre, playaSlug: p.slug })),
  );
  return Response.json({ fuente, error, temporada, guardavidas });
}
