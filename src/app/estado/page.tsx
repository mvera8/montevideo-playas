import type { Metadata } from "next";
import Link from "next/link";
import PaginaSitio from "@/components/PaginaSitio";
import { getEstadoFuentes } from "@/lib/estado";
import DesdeNavegador from "./DesdeNavegador";
import Fila from "./Fila";
import HaceCuanto from "./HaceCuanto";

// Estado de las fuentes de datos (src/lib/estado.ts). ISR de 5 min, igual que /playas: no consulta las
// fuentes en cada visita.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Estado de las fuentes",
  description: "Si las fuentes de datos del sitio (Intendencia, clima, mar y comunidad) están respondiendo.",
  alternates: { canonical: "/estado" },
};

const fmtHora = new Intl.DateTimeFormat("es-UY", {
  timeZone: "America/Montevideo",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function EstadoPage() {
  const { chequeos, hora } = await getEstadoFuentes();
  const grupos = [...new Set(chequeos.map((c) => c.grupo))];
  const caidos = chequeos.filter((c) => c.estado === "caido").length;
  const viejos = chequeos.filter((c) => c.estado === "viejo").length;
  const resumen =
    caidos + viejos === 0
      ? "Todas las fuentes responden."
      : [caidos && `${caidos} no ${caidos > 1 ? "responden" : "responde"}`, viejos && `${viejos} con datos viejos`]
          .filter(Boolean)
          .join(" y ") + ".";

  return (
    <PaginaSitio
      titulo="Estado de las fuentes"
      bajada="El sitio junta datos de varias fuentes. Si una no responde, esa parte del mapa se muestra sin datos o con lo último que llegó."
    >
      <div
        className={`mt-8 rounded-2xl p-4 ring-1 ${caidos ? "bg-red-50 ring-red-200" : viejos ? "bg-amber-50 ring-amber-200" : "bg-emerald-50 ring-emerald-200"}`}
      >
        <p className="font-semibold text-slate-900">{resumen}</p>
        <p className="mt-1 text-sm text-slate-600">
          Verificado el {fmtHora.format(hora)}
          <HaceCuanto hora={hora} />. Se vuelve a verificar cada 5 minutos, con la primera visita.
        </p>
      </div>

      <DesdeNavegador />

      {grupos.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">{g}</h2>
          <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {chequeos
              .filter((c) => c.grupo === g)
              .map((c) => (
                <Fila key={c.id} c={c} />
              ))}
          </ul>
        </section>
      ))}

      <p className="mt-8 text-sm text-slate-500">
        Esta página solo indica si cada fuente responde y qué tan reciente es su último dato; no controla que los datos
        sean correctos. La fuente oficial manda. Más sobre cada fuente en{" "}
        <Link href="/terminos#fuentes" className="underline">
          Términos y fuentes
        </Link>
        .
      </p>
    </PaginaSitio>
  );
}
