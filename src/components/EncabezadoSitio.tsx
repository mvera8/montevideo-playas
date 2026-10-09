"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BotonMapa from "@/components/BotonMapa";
import MarcaSitio from "@/components/MarcaSitio";
import MenuSitio from "@/components/MenuSitio";
import { ENLACES_PRINCIPALES } from "@/lib/navegacion";

// Encabezado de todas las páginas menos el mapa: marca, enlaces principales y el botón al mapa. Los
// legales van en el pie (PieSitio). En móvil, el mismo menú ☰ del mapa (MenuSitio).
// Isla flotante (skill landing-page-design B7): una píldora de vidrio separada del borde de arriba,
// centrada y del ancho de su contenido. En las páginas de texto queda fija a 24 px del borde al
// hacer scroll; `sobreFoto`: vidrio oscuro y letras blancas, encima de la foto de la home.
// Client component solo para marcar la página actual.

// Sin "Playas": al mapa se llega con el botón destacado "Ver playas", que va al lado.
const ENLACES = ENLACES_PRINCIPALES.filter((e) => e.href !== "/playas");

export default function EncabezadoSitio({ sobreFoto = false }: { sobreFoto?: boolean }) {
  const pathname = usePathname();
  return (
    <header
      className={`pointer-events-none inset-x-0 z-20 px-4 ${sobreFoto ? "absolute top-6" : "sticky top-6 mt-6"}`}
    >
      <div
        className={`pointer-events-auto mx-auto flex w-max max-w-full items-center gap-2 rounded-full py-2 pl-4 pr-2 shadow-lg backdrop-blur-xl sm:gap-6 ${
          sobreFoto ? "bg-white/10 ring-1 ring-white/20 shadow-black/20" : "bg-white/80 ring-1 ring-black/5 shadow-black/5"
        }`}
      >
        <MarcaSitio claro={sobreFoto} />

        <nav className={`hidden items-center gap-1 text-sm md:flex ${sobreFoto ? "text-white/85" : "text-slate-600"}`}>
          {ENLACES.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={href === pathname ? "page" : undefined}
              className={`rounded-full px-3 py-2 transition-colors duration-700 ease-fluido ${
                sobreFoto
                  ? "hover:bg-white/15 hover:text-white aria-[current=page]:bg-white/20 aria-[current=page]:text-white"
                  : "hover:bg-slate-100 hover:text-slate-900 aria-[current=page]:bg-slate-100 aria-[current=page]:font-medium aria-[current=page]:text-slate-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <BotonMapa tamano="chico" tono={sobreFoto ? "claro" : "oscuro"} texto="Ver playas" className="hidden sm:inline-flex" />
          <div className="md:hidden">
            <MenuSitio variante={sobreFoto ? "foto" : "encabezado"} />
          </div>
        </div>
      </div>
    </header>
  );
}
