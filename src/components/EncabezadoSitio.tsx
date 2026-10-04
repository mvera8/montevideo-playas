"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BotonMapa from "@/components/BotonMapa";
import MarcaSitio from "@/components/MarcaSitio";
import MenuSitio from "@/components/MenuSitio";
import { ENLACES_PRINCIPALES } from "@/lib/navegacion";

// Encabezado de todas las páginas menos el mapa: marca, enlaces principales y el botón al mapa. Los
// legales van en el pie (PieSitio). En móvil, el mismo menú ☰ del mapa (MenuSitio).
// `sobreFoto`: transparente y en blanco, encima de la foto de la home.
// Client component solo para marcar la página actual.
export default function EncabezadoSitio({ sobreFoto = false }: { sobreFoto?: boolean }) {
  const pathname = usePathname();
  return (
    <header
      className={
        sobreFoto
          ? "absolute inset-x-0 top-0 z-20"
          : "sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85"
      }
    >
      <div className={`mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 ${sobreFoto ? "py-5" : "py-3"}`}>
        <MarcaSitio claro={sobreFoto} />

        <nav
          className={`hidden items-center gap-1 rounded-full p-1 text-sm md:flex ${
            sobreFoto ? "bg-white/10 text-white/85 ring-1 ring-white/20 backdrop-blur-md" : "text-slate-600 dark:text-slate-300"
          }`}
        >
          {ENLACES_PRINCIPALES.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={href === pathname ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 transition-colors ${
                sobreFoto
                  ? "hover:bg-white/15 hover:text-white aria-[current=page]:bg-white/20 aria-[current=page]:text-white"
                  : "hover:bg-slate-100 hover:text-slate-900 aria-[current=page]:bg-slate-100 aria-[current=page]:font-medium aria-[current=page]:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white dark:aria-[current=page]:bg-slate-800 dark:aria-[current=page]:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <BotonMapa tamano="chico" tono={sobreFoto ? "claro" : "oscuro"} texto="Ver playas" className="hidden sm:inline-flex" />
          <div className="md:hidden">
            <MenuSitio variante={sobreFoto ? "foto" : "encabezado"} />
          </div>
        </div>
      </div>
    </header>
  );
}
