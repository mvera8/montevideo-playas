import { SITIO } from "./sitio";

// Enlaces del sitio, compartidos por el menú del mapa (MenuSitio), el encabezado (EncabezadoSitio) y
// el pie (PieSitio) de las páginas. Agregar una página acá la suma a los tres.

export type EnlaceSitio = {
  href: string;
  label: string;
  icono: "inicio" | "playas" | "favoritas" | "novedades" | "terminos" | "privacidad" | "contacto";
};

export const ENLACES_PRINCIPALES: EnlaceSitio[] = [
  { href: "/", label: "Inicio", icono: "inicio" },
  { href: "/playas", label: "Playas", icono: "playas" },
  { href: "/favoritas", label: "Favoritas", icono: "favoritas" },
  { href: "/novedades", label: "Novedades", icono: "novedades" },
];

export const ENLACES_LEGALES: EnlaceSitio[] = [
  { href: "/terminos", label: "Términos", icono: "terminos" },
  { href: "/privacidad", label: "Privacidad", icono: "privacidad" },
  // Se muestra recién cuando SITIO.contacto tenga un correo de verdad.
  ...(SITIO.contacto.includes("@")
    ? [{ href: `mailto:${SITIO.contacto}`, label: "Contacto", icono: "contacto" as const }]
    : []),
];
