import type { Metadata } from "next";
import MapaCliente from "@/components/mapa/MapaCliente";
import { getAlertasInumet } from "@/lib/inumet";
import { getPlayas } from "@/lib/playas";
import { SITIO } from "@/lib/sitio";
import { getMontevideoWeather } from "@/lib/weather";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Mapa de playas",
  description: `Mapa de las playas de ${SITIO.nombre}: bandera de guardavidas, calidad del agua, clima, pronóstico y cómo llegar en ómnibus.`,
  alternates: { canonical: "/playas" },
};

export default async function PlayasPage() {
  const [{ fuente, error, temporada, playas }, climaCiudad, alertas] = await Promise.all([
    getPlayas(),
    getMontevideoWeather().catch(() => null),
    getAlertasInumet().catch(() => null),
  ]);

  return (
    <main id="contenido" className="tema-sistema h-dvh">
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
