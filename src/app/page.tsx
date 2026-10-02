import MapaCliente from "@/components/mapa/MapaCliente";
import { getPlayas } from "@/lib/playas";
import { getMontevideoWeather } from "@/lib/weather";

export const revalidate = 300;

export default async function Home() {
  const [{ fuente, error, temporada, playas }, climaCiudad] = await Promise.all([
    getPlayas(),
    getMontevideoWeather().catch(() => null),
  ]);

  return (
    <main className="h-dvh">
      <h1 className="sr-only">Playas y guardavidas de Montevideo</h1>
      <MapaCliente
        playas={playas}
        temporada={temporada}
        fuente={fuente}
        error={error}
        climaCiudad={climaCiudad}
      />
    </main>
  );
}
