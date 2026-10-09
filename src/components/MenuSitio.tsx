"use client";

import { EnvelopeSimple, FileText, Heart, House, List, Newspaper, ShieldCheck, Umbrella, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ENLACES_LEGALES, ENLACES_PRINCIPALES, type EnlaceSitio } from "@/lib/navegacion";
import { SITIO } from "@/lib/sitio";

// Menú del mapa: botón ☰ y un cajón que entra desde la derecha. Los enlaces son los mismos del
// encabezado de las demás páginas (src/lib/navegacion.ts). Queda siempre montado (inert cuando
// está cerrado) para animar solo transform/opacity. El cajón va en un portal a <body>: si no, un
// padre con backdrop-blur/transform (p. ej. el encabezado) lo encierra. `children`: controles
// propios de la página que van en el cajón (en el mapa móvil, el estilo del mapa); reciben `cerrar`
// para cerrar el cajón al elegir.

const sinSuscripcion = () => () => {};

const ICONOS: Record<EnlaceSitio["icono"], typeof House> = {
  inicio: House,
  playas: Umbrella,
  favoritas: Heart,
  novedades: Newspaper,
  terminos: FileText,
  privacidad: ShieldCheck,
  contacto: EnvelopeSimple,
};

const TINTA = "text-slate-600 hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white";

const BOTON = {
  // Flotante sobre el mapa, como el selector de estilo. En móvil, del alto de la marca.
  flotante: `h-10 w-10 rounded-xl md:h-12 md:w-12 md:rounded-2xl bg-white/95 shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-oscuro-1/95 dark:ring-white/10 ${TINTA}`,
  // Dentro de EncabezadoSitio (móvil).
  encabezado: `-my-1 h-10 w-10 rounded-xl hover:bg-slate-100 dark:hover:bg-oscuro-3 ${TINTA}`,
  // Dentro de EncabezadoSitio sobre la foto de la home.
  foto: "-my-1 h-10 w-10 rounded-xl text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/15",
};

export default function MenuSitio({
  variante = "flotante",
  children,
}: {
  variante?: keyof typeof BOTON;
  children?: (cerrar: () => void) => React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  // El portal necesita document: en el HTML del servidor va solo el botón.
  const enCliente = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const pathname = usePathname();
  const boton = useRef<HTMLButtonElement>(null);
  const cajon = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    cajon.current?.querySelector<HTMLElement>("a")?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [abierto]);

  const enlace = ({ href, label, icono }: EnlaceSitio) => {
    const Icono = ICONOS[icono];
    const actual = href === pathname;
    return (
      <li key={href}>
        <Link
          href={href}
          onClick={() => setAbierto(false)}
          aria-current={actual ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${
            actual
              ? "bg-sky-50 font-medium text-sky-900 dark:bg-oscuro-3 dark:text-white"
              : "text-slate-700 hover:bg-slate-50 dark:text-neutral-200 dark:hover:bg-oscuro-3"
          }`}
        >
          <Icono className={`h-5 w-5 shrink-0 ${actual ? "text-sky-600 dark:text-sky-300" : "text-slate-400"}`} aria-hidden />
          {label}
        </Link>
      </li>
    );
  };

  const cajonMenu = (
    <>
      {/* Fondo */}
      <div
        onClick={() => setAbierto(false)}
        aria-hidden
        className={`fixed inset-0 z-40 bg-slate-950/30 transition-opacity duration-300 motion-reduce:transition-none ${
          abierto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <nav
        id="menu-sitio"
        ref={cajon}
        aria-label="Menú del sitio"
        inert={!abierto}
        className={`fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl ring-1 ring-black/5 transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-oscuro-1 dark:ring-white/10 ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {SITIO.nombre} <span className="font-normal text-slate-500 dark:text-neutral-400">· {SITIO.alcance}</span>
          </p>
          <button
            onClick={() => {
              setAbierto(false);
              boton.current?.focus();
            }}
            aria-label="Cerrar menú"
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-oscuro-3 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <ul className="space-y-0.5 px-2.5">{ENLACES_PRINCIPALES.map(enlace)}</ul>
        <div className="mx-5 my-3 h-px bg-slate-100 dark:bg-oscuro-3" />
        {children?.(() => setAbierto(false))}
        <ul className="space-y-0.5 px-2.5">{ENLACES_LEGALES.map(enlace)}</ul>

        <p className="mt-auto px-5 pb-5 text-xs text-slate-500">
          Datos de la Intendencia de Montevideo y otras fuentes abiertas. La fuente oficial manda.
        </p>
      </nav>
    </>
  );

  return (
    <>
      <button
        ref={boton}
        onClick={() => setAbierto(true)}
        aria-expanded={abierto}
        aria-controls="menu-sitio"
        aria-label="Menú"
        title="Menú"
        className={`grid shrink-0 place-items-center ${BOTON[variante]}`}
      >
        <List className="h-5 w-5" aria-hidden />
      </button>

      {enCliente && createPortal(cajonMenu, document.body)}
    </>
  );
}
