"use client";

import { EnvelopeSimple, FileText, Heart, House, Newspaper, ShieldCheck, Umbrella } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ENLACES_LEGALES, ENLACES_PRINCIPALES, type EnlaceSitio } from "@/lib/navegacion";
import { SITIO } from "@/lib/sitio";

// Menú del mapa y del encabezado móvil (skill landing-page-design B7): botón ☰ que se transforma en X
// y una capa de vidrio a pantalla completa con los enlaces subiendo escalonados. Los enlaces son los
// mismos del encabezado de las demás páginas (src/lib/navegacion.ts). Queda siempre montado (inert
// cuando está cerrado) para animar solo transform/opacity. La capa va en un portal a <body>: si no, un
// padre con backdrop-blur/transform (p. ej. el encabezado) la encierra. Por eso la X no puede ser el
// mismo botón (quedaría debajo de la capa): la capa pone su propio botón en el lugar exacto del ☰
// (medido al abrir) y es ese el que se transforma. `children`: controles propios de la página que van
// en el menú (en el mapa móvil, el estilo del mapa); reciben `cerrar` para cerrar el menú al elegir.

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

/** Tres rayas que giran hasta formar una X (nunca desaparecen de golpe): solo translate, rotate y scale. */
function Hamburguesa({ abierto }: { abierto: boolean }) {
  const raya =
    "absolute left-0 top-1/2 -mt-px h-0.5 w-5 rounded-full bg-current transition-[translate,rotate,scale] duration-700 ease-fluido motion-reduce:transition-none";
  return (
    <span className="relative block h-5 w-5" aria-hidden>
      <span className={`${raya} ${abierto ? "rotate-45" : "-translate-y-1.5"}`} />
      <span className={`${raya} ${abierto ? "scale-x-0" : ""}`} />
      <span className={`${raya} ${abierto ? "-rotate-45" : "translate-y-1.5"}`} />
    </span>
  );
}

export default function MenuSitio({
  variante = "flotante",
  children,
}: {
  variante?: keyof typeof BOTON;
  children?: (cerrar: () => void) => React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  // Lugar del ☰ en pantalla, para poner la X de la capa exactamente encima.
  const [lugar, setLugar] = useState<DOMRect | null>(null);
  // El portal necesita document: en el HTML del servidor va solo el botón.
  const enCliente = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const pathname = usePathname();
  const boton = useRef<HTMLButtonElement>(null);
  const capa = useRef<HTMLDivElement>(null);

  const abrir = () => {
    setLugar(boton.current?.getBoundingClientRect() ?? null);
    // Un cuadro después: así la X de la capa se pinta primero como ☰ y la transformación se ve.
    requestAnimationFrame(() => requestAnimationFrame(() => setAbierto(true)));
  };
  const cerrar = () => {
    setAbierto(false);
    boton.current?.focus();
  };

  useEffect(() => {
    if (!abierto) return;
    capa.current?.querySelector<HTMLElement>("nav a")?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [abierto]);

  // Escalonado de la aparición: 100 ms y 50 ms más por enlace (delay-100, delay-150, delay-200…).
  let orden = 0;
  const entrada = () => ({ transitionDelay: abierto ? `${100 + orden++ * 50}ms` : "0ms" });
  const subir = `transition-[translate,opacity] duration-700 ease-fluido motion-reduce:transition-none ${
    abierto ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
  }`;

  const enlace = ({ href, label, icono }: EnlaceSitio, grande: boolean) => {
    const Icono = ICONOS[icono];
    const actual = href === pathname;
    return (
      // La caja recorta: cada enlace sube desde abajo de su propio renglón.
      <li key={href} className="overflow-hidden">
        <Link
          href={href}
          onClick={() => setAbierto(false)}
          aria-current={actual ? "page" : undefined}
          style={entrada()}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 ${grande ? "text-2xl font-semibold tracking-tight" : "text-base"} ${subir} ${
            actual
              ? "text-sky-700 dark:text-sky-300"
              : "text-slate-800 hover:bg-black/5 dark:text-neutral-100 dark:hover:bg-white/10"
          }`}
        >
          <Icono
            className={`${grande ? "h-6 w-6" : "h-5 w-5"} shrink-0 ${actual ? "text-sky-600 dark:text-sky-300" : "text-slate-400"}`}
            weight={actual ? "fill" : "regular"}
            aria-hidden
          />
          {label}
        </Link>
      </li>
    );
  };

  const capaMenu = (
    <div
      ref={capa}
      inert={!abierto}
      className={`fixed inset-0 z-50 overflow-y-auto bg-white/80 backdrop-blur-3xl transition-opacity duration-700 ease-fluido motion-reduce:transition-none dark:bg-black/80 ${
        abierto ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {lugar && (
        <button
          onClick={cerrar}
          aria-label="Cerrar menú"
          style={{ top: lugar.top, left: lugar.left, width: lugar.width, height: lugar.height }}
          className="fixed grid place-items-center rounded-xl text-slate-900 hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
        >
          <Hamburguesa abierto={abierto} />
        </button>
      )}

      <div className="mx-auto flex min-h-full max-w-sm flex-col px-4 pb-6 pt-24">
        <p style={entrada()} className={`px-3 text-sm font-semibold tracking-tight text-slate-900 dark:text-white ${subir}`}>
          {SITIO.nombre} <span className="font-normal text-slate-500 dark:text-neutral-400">· {SITIO.alcance}</span>
        </p>
        <nav id="menu-sitio" aria-label="Menú del sitio" className="mt-4">
          <ul className="space-y-1">{ENLACES_PRINCIPALES.map((e) => enlace(e, true))}</ul>
          <div className="mx-3 my-4 h-px bg-black/10 dark:bg-white/10" />
          {children && (
            <div style={entrada()} className={subir}>
              {children(() => setAbierto(false))}
            </div>
          )}
          <ul className="space-y-1">{ENLACES_LEGALES.map((e) => enlace(e, false))}</ul>
        </nav>

        <p style={entrada()} className={`mt-auto px-3 pt-8 text-xs text-slate-500 dark:text-neutral-400 ${subir}`}>
          Datos de la Intendencia de Montevideo y otras fuentes abiertas. La fuente oficial manda.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={boton}
        onClick={abrir}
        aria-expanded={abierto}
        aria-controls="menu-sitio"
        aria-label="Menú"
        title="Menú"
        className={`grid shrink-0 place-items-center ${BOTON[variante]}`}
      >
        <Hamburguesa abierto={false} />
      </button>

      {enCliente && createPortal(capaMenu, document.body)}
    </>
  );
}
