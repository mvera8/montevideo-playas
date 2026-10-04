"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MenuSitio from "@/components/MenuSitio";
import { ENLACES_LEGALES, ENLACES_PRINCIPALES } from "@/lib/navegacion";

// Encabezado de las páginas de texto (/favoritas, /terminos, /privacidad): volver al mapa y los
// enlaces del sitio. En escritorio, en línea; en móvil, el mismo menú ☰ del mapa (MenuSitio).
// Client component solo para marcar la página actual.
export default function EncabezadoSitio({ ancho = "max-w-3xl" }: { ancho?: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className={`mx-auto flex items-center justify-between gap-4 px-4 py-3 ${ancho}`}>
        <Link href="/playas" className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-300">
          ← Volver al mapa
        </Link>
        <nav className="hidden gap-4 text-sm md:flex text-slate-600 dark:text-slate-300">
          {[...ENLACES_PRINCIPALES, ...ENLACES_LEGALES].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={href === pathname ? "page" : undefined}
              className="hover:underline aria-[current=page]:font-medium aria-[current=page]:text-slate-900 dark:aria-[current=page]:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="md:hidden">
          <MenuSitio variante="encabezado" />
        </div>
      </div>
    </header>
  );
}
