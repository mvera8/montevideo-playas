import MapaCliente from "@/components/mapa/MapaCliente";
import { getAlertasInumet } from "@/lib/inumet";
import { getPlayas } from "@/lib/playas";
import { SITIO } from "@/lib/sitio";
import { getMontevideoWeather } from "@/lib/weather";

export const revalidate = 300;

export default async function PlayasPage() {
  const [{ fuente, error, temporada, playas }, climaCiudad, alertas] = await Promise.all([
    getPlayas(),
    getMontevideoWeather().catch(() => null),
    getAlertasInumet().catch(() => null),
  ]);

  return (
    <main className="h-dvh">
      <h1 className="sr-only">{SITIO.marca}: playas, guardavidas y calidad del agua</h1>
      <MapaCliente
        playas={playas}
        temporada={temporada}
        fuente={fuente}
        error={error}
        climaCiudad={climaCiudad}
        alertas={alertas}
      />
    </main>
  );
}
