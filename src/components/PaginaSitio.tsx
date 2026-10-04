import EncabezadoSitio from "@/components/EncabezadoSitio";
import PieSitio from "@/components/PieSitio";
import { SITIO } from "@/lib/sitio";

// Estructura común de las páginas de texto (favoritas, novedades, legales): encabezado arriba,
// antetítulo + título + bajada, el contenido y el pie. La home y el mapa tienen la suya.
// El contenedor mide lo mismo que el encabezado, el pie y las secciones de la home (max-w-6xl), así
// todo queda alineado con el logo. El texto va en una columna de lectura (max-w-3xl) a la izquierda;
// `anchoCompleto` la saca para grillas como la de novedades.
export default function PaginaSitio({
  titulo,
  bajada,
  antetitulo = SITIO.marca,
  anchoCompleto = false,
  children,
}: {
  titulo: string;
  bajada?: React.ReactNode;
  antetitulo?: React.ReactNode;
  anchoCompleto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      <EncabezadoSitio />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wider text-sky-700 dark:text-sky-300">{antetitulo}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{titulo}</h1>
          {bajada && <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">{bajada}</p>}
        </div>
        <div className={anchoCompleto ? "" : "max-w-3xl"}>{children}</div>
      </main>
      <PieSitio />
    </div>
  );
}
