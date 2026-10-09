// Novedades del sitio: notas propias escritas a mano (no hay CMS ni base de datos). Para publicar una,
// agregarla a NOVEDADES. Una nota con `fecha` futura queda oculta y aparece sola ese día (las páginas
// se regeneran cada hora), así se puede dejar escrita, p. ej., la del inicio de la temporada.
// Son textos informativos: las fechas y avisos oficiales los da la Intendencia.

export type BloqueNovedad =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "lista"; items: string[] };

export type Novedad = {
  slug: string;
  /**
   * Titular de la nota, en la página, las tarjetas y el `<title>`. Máximo 38 caracteres: el layout le suma
   * " · Montevideo · Playas" (22) y con más de 60 en total Google lo corta.
   */
  titulo: string;
  /** Día de publicación (AAAA-MM-DD, hora de Montevideo). */
  fecha: string;
  etiqueta: "Temporada" | "El sitio" | "Consejos";
  resumen: string;
  cuerpo: BloqueNovedad[];
};

const NOVEDADES: Novedad[] = [
  {
    slug: "arranca-la-temporada-2026-27",
    titulo: "Arrancó la temporada de playas 2026-27",
    fecha: "2026-11-15",
    etiqueta: "Temporada",
    resumen: "Vuelven los guardavidas a las casillas y las banderas al mapa. Qué cambia en Playas UY desde hoy.",
    cuerpo: [
      {
        tipo: "parrafo",
        texto:
          "Desde mediados de noviembre las casillas de guardavidas de Montevideo vuelven a tener servicio. En el mapa, las casillas dejan el gris de “sin servicio” y muestran la bandera que informa la Intendencia, flameando hacia donde sopla el viento.",
      },
      { tipo: "subtitulo", texto: "Qué mirar antes de ir" },
      {
        tipo: "lista",
        items: [
          "El color de la bandera de cada casilla, tal como lo publica la Intendencia.",
          "La calidad del agua, calculada con los últimos muestreos de la Intendencia.",
          "El clima y el pronóstico hora a hora, con la mejor franja para ir.",
          "Cómo llegar en ómnibus desde donde estés, con las próximas llegadas en vivo.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Las fechas y horarios oficiales del servicio los define y comunica la Intendencia de Montevideo. En la playa, la bandera de la casilla y las indicaciones de los guardavidas mandan siempre. Ante una emergencia, llamá al 911.",
      },
    ],
  },
  {
    slug: "falta-poco-para-la-temporada",
    titulo: "Falta poco para la temporada",
    fecha: "2026-10-04",
    etiqueta: "Temporada",
    resumen:
      "Los guardavidas vuelven a mediados de noviembre, pero la calidad del agua y el clima ya están en el mapa todo el año.",
    cuerpo: [
      {
        tipo: "parrafo",
        texto:
          "La temporada de guardavidas en Montevideo suele ir de mediados de noviembre a fines de abril. Hasta que arranque, las casillas aparecen en gris en el mapa: no hay vigilancia ni banderas vigentes.",
      },
      { tipo: "subtitulo", texto: "Lo que funciona todo el año" },
      {
        tipo: "lista",
        items: [
          "Calidad del agua: la Intendencia muestrea las playas cada pocos días durante todo el año. Si un análisis tiene más de 21 días, lo mostramos como “sin muestreo reciente”.",
          "Clima, temperatura del agua y pronóstico por playa.",
          "Baños, bebederos y duchas cercanos.",
          "Cómo llegar en ómnibus y “¿A qué playa voy?”, que te sugiere una según el viento, el clima y lo que tardás en llegar.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Y ya empezó la temporada de me gusta 2026-27 (cierra el 30 de abril, con la temporada de guardavidas): marcá tus playas favoritas y mirá el ranking en la página de Favoritas.",
      },
    ],
  },
  {
    slug: "lanzamos-playas-uy",
    titulo: "Lanzamos Playas UY: un mapa de playas",
    fecha: "2026-10-04",
    etiqueta: "El sitio",
    resumen: "Un mapa gratuito y sin registro para elegir playa con la información pública en un solo lugar.",
    cuerpo: [
      {
        tipo: "parrafo",
        texto:
          "Playas UY junta en un solo mapa la información pública sobre las playas de Montevideo, que hoy está repartida en varios lugares: las casillas de guardavidas y sus banderas, los muestreos de calidad del agua de la Intendencia, el clima y el transporte.",
      },
      { tipo: "subtitulo", texto: "Gratis y sin registro" },
      {
        tipo: "parrafo",
        texto:
          "No hay que crear una cuenta ni instalar nada: abrís el mapa en el celular o la computadora y listo.",
      },
      { tipo: "subtitulo", texto: "De dónde salen los datos" },
      {
        tipo: "parrafo",
        texto:
          "De la Intendencia de Montevideo (playas, banderas, calidad del agua, ómnibus), de MET Norway y NOAA (clima y mar) y de OpenStreetMap (mapa). Es un servicio informativo e independiente: la fuente oficial manda.",
      },
    ],
  },
];

/** Hoy en Montevideo como AAAA-MM-DD (comparable como texto con `fecha`). */
function hoyMontevideo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(now);
}

/** Notas ya publicadas, de la más nueva a la más vieja. */
export function getNovedades(now = new Date()) {
  const hoy = hoyMontevideo(now);
  return NOVEDADES.filter((n) => n.fecha <= hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function getNovedad(slug: string, now = new Date()) {
  return getNovedades(now).find((n) => n.slug === slug) ?? null;
}

const formatoFecha = new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "4 de octubre de 2026" */
export function fechaNovedad(fecha: string) {
  return formatoFecha.format(new Date(`${fecha}T12:00:00Z`));
}
