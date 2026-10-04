import PaginaSitio from "@/components/PaginaSitio";
import { SITIO } from "@/lib/sitio";

// Tipografía compartida por /terminos y /privacidad, sobre la estructura común (PaginaSitio).
export default function PaginaLegal({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada: string;
  children: React.ReactNode;
}) {
  return (
    <PaginaSitio titulo={titulo} bajada={bajada}>
      <p className="mt-2 text-sm text-slate-500">Última actualización: {SITIO.actualizado}</p>

      <div
        className="mt-8 space-y-4 leading-relaxed text-slate-700 dark:text-slate-300
          [&_a]:text-sky-700 [&_a]:underline dark:[&_a]:text-sky-300
          [&_h2]:mt-10 [&_h2]:scroll-mt-20 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-white
          [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-slate-900 dark:[&_h3]:text-white
          [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5
          [&_strong]:text-slate-900 dark:[&_strong]:text-white"
      >
        {children}
      </div>
    </PaginaSitio>
  );
}

/** Recuadro destacado para resúmenes y avisos importantes. */
export function Destacado({ children, tono = "info" }: { children: React.ReactNode; tono?: "info" | "aviso" }) {
  const clases =
    tono === "aviso"
      ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/50"
      : "border-sky-200 bg-white dark:border-sky-900 dark:bg-slate-900";
  return <div className={`rounded-2xl border p-5 ${clases}`}>{children}</div>;
}
