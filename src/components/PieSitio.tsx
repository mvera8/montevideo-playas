import Link from "next/link";
import MarcaSitio from "@/components/MarcaSitio";
import { ENLACES_LEGALES, ENLACES_PRINCIPALES, type EnlaceSitio } from "@/lib/navegacion";

// Pie de todas las páginas menos el mapa. `children`: créditos propios de la página (p. ej. la foto
// de portada de la home). En mobile todo va centrado; desde sm, alineado a la izquierda. Fondo negro
// con el mismo degradado que el ícono del iPhone (src/app/apple-icon.png), igual en modo claro y oscuro.
function Columna({ titulo, enlaces }: { titulo: string; enlaces: EnlaceSitio[] }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-sm font-semibold text-white">{titulo}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {enlaces.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className="text-neutral-300 hover:text-white hover:underline">
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
    <footer className="bg-[#0a0a0a] bg-[radial-gradient(120%_140%_at_25%_0%,#2e2e30_0%,#161617_45%,#050505_100%)] text-neutral-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="mx-auto max-w-sm text-center sm:mx-0 sm:text-left">
          <div className="flex justify-center sm:justify-start">
            <MarcaSitio claro />
          </div>
          <p className="mt-3 text-sm">
            Sitio no oficial que rejunta datos abiertos de las playas de Montevideo en un mapa: banderas, calidad del
            agua, clima y cómo llegar.{" "}
            <strong className="font-semibold text-white">Gratis y sin registro.</strong>
          </p>
        </div>
        <Columna titulo="El sitio" enlaces={ENLACES_PRINCIPALES} />
        <Columna titulo="Legales" enlaces={ENLACES_LEGALES} />
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-5 text-center text-xs text-neutral-400 sm:px-6 sm:text-left">
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
