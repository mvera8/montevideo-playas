import Link from "next/link";
import MarcaSitio from "@/components/MarcaSitio";
import { ENLACES_LEGALES, ENLACES_PRINCIPALES, type EnlaceSitio } from "@/lib/navegacion";

// Pie de todas las páginas menos el mapa. `children`: créditos propios de la página (p. ej. la foto
// de portada de la home).
function Columna({ titulo, enlaces }: { titulo: string; enlaces: EnlaceSitio[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{titulo}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {enlaces.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className="text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PieSitio({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-sm">
          <MarcaSitio />
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            El mapa de las playas de Montevideo: banderas, calidad del agua, clima y cómo llegar.{" "}
            <strong className="font-semibold text-slate-900 dark:text-white">Gratis y sin registro.</strong>
          </p>
        </div>
        <Columna titulo="El sitio" enlaces={ENLACES_PRINCIPALES} />
        <Columna titulo="Legales" enlaces={ENLACES_LEGALES} />
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-5 text-xs text-slate-500 sm:px-6">
          <p>
            Servicio informativo e independiente, no oficial: sin relación con la Intendencia ni con el servicio de
            guardavidas. Datos de la Intendencia de Montevideo y otras fuentes
            abiertas: la fuente oficial manda. En la playa, seguí a los guardavidas. Emergencias: 911.
          </p>
          {children}
        </div>
      </div>
    </footer>
  );
}
