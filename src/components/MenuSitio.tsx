"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ENLACES_LEGALES, ENLACES_PRINCIPALES, type EnlaceSitio } from "@/lib/navegacion";
import { SITIO } from "@/lib/sitio";

// Menú del mapa: botón ☰ y un cajón que entra desde la derecha. Los enlaces son los mismos del
// encabezado de las demás páginas (src/lib/navegacion.ts). Queda siempre montado (inert cuando
// está cerrado) para animar solo transform/opacity. El cajón va en un portal a <body>: si no, un
// padre con backdrop-blur/transform (p. ej. el encabezado) lo encierra.

const sinSuscripcion = () => () => {};

const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONOS: Record<EnlaceSitio["icono"], React.ReactNode> = {
  inicio: <path d="M4 11.5 12 5l8 6.5M6 10v9h4.5v-5h3v5H18v-9" />,
  playas: (
    <>
      <path d="M3 18c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" />
      <circle cx="16.5" cy="7.5" r="3" />
      <path d="M3 14c2-3 5-4.5 9-4" />
    </>
  ),
  favoritas: <path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z" />,
  novedades: (
    <>
      <rect x="4" y="4.5" width="16" height="15" rx="2" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </>
  ),
  terminos: (
    <>
      <path d="M6 3.5h8l4 4v13H6Z" />
      <path d="M9 12h6M9 15.5h6" />
    </>
  ),
  privacidad: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  contacto: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
};

const TINTA = "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white";

const BOTON = {
  // Flotante sobre el mapa, como el selector de estilo.
  flotante: `h-12 w-12 rounded-2xl bg-white/95 shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/95 dark:ring-white/10 ${TINTA}`,
  // Dentro de EncabezadoSitio (móvil).
  encabezado: `-my-1 h-10 w-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 ${TINTA}`,
  // Dentro de EncabezadoSitio sobre la foto de la home.
  foto: "-my-1 h-10 w-10 rounded-xl text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/15",
};

export default function MenuSitio({ variante = "flotante" }: { variante?: keyof typeof BOTON }) {
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
    const actual = href === pathname;
    return (
      <li key={href}>
        <Link
          href={href}
          onClick={() => setAbierto(false)}
          aria-current={actual ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${
            actual
              ? "bg-sky-50 font-medium text-sky-900 dark:bg-slate-800 dark:text-white"
              : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${actual ? "text-sky-600 dark:text-sky-300" : "text-slate-400"}`} aria-hidden {...trazo}>
            {ICONOS[icono]}
          </svg>
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
        className={`fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl ring-1 ring-black/5 transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-slate-900 dark:ring-white/10 ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {SITIO.nombre} <span className="font-normal text-slate-500 dark:text-slate-400">· {SITIO.alcance}</span>
          </p>
          <button
            onClick={() => {
              setAbierto(false);
              boton.current?.focus();
            }}
            aria-label="Cerrar menú"
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...trazo} strokeWidth={2}>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <ul className="space-y-0.5 px-2.5">{ENLACES_PRINCIPALES.map(enlace)}</ul>
        <div className="mx-5 my-3 h-px bg-slate-100 dark:bg-slate-800" />
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
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...trazo} strokeWidth={2}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {enCliente && createPortal(cajonMenu, document.body)}
    </>
  );
}
