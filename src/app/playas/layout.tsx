import MapaCliente from "@/components/mapa/MapaCliente";
import { getAlertasInumet } from "@/lib/inumet";
import { getPlayas } from "@/lib/playas";
import { getMontevideoWeather } from "@/lib/weather";

// El mapa vive en el layout para que /playas y /playas/[slug] compartan la misma instancia: la dirección
// cambia con replaceState al elegir una playa, y así router.refresh() no lo vuelve a montar.
export const revalidate = 300;

export default async function PlayasLayout({ children }: { children: React.ReactNode }) {
  const [{ fuente, error, temporada, playas }, climaCiudad, alertas] = await Promise.all([
    getPlayas(),
    getMontevideoWeather().catch(() => null),
    getAlertasInumet().catch(() => null),
  ]);

  return (
    <main id="contenido" className="tema-sistema h-dvh">
      {children}
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
