// Enlaces del sitio, compartidos por el menú del mapa (MenuSitio), el encabezado (EncabezadoSitio) y
// el pie (PieSitio) de las páginas. Agregar una página acá la suma a los tres (el encabezado omite
// "Playas", que ya tiene su botón "Ver playas").

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
  { href: "/contacto", label: "Contacto", icono: "contacto" },
];
