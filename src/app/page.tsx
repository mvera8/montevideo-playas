import { ArrowUpRight, Bus, Drop, Flag, Sun } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import BotonMapa from "@/components/BotonMapa";
import EncabezadoSitio from "@/components/EncabezadoSitio";
import Etiqueta from "@/components/Etiqueta";
import PieSitio from "@/components/PieSitio";
import PodioFavoritas from "@/components/PodioFavoritas";
import PreguntasFrecuentes from "@/components/PreguntasFrecuentes";
import Revelar from "@/components/Revelar";
import TarjetaNovedad from "@/components/TarjetaNovedad";
import { getNovedades } from "@/lib/novedades";
import { getMeGusta } from "@/lib/me-gusta";
import { temporadaMeGusta } from "@/lib/me-gusta-temporada";
import { getTemporada, nombrePlayaPorSlug, playasConocidas } from "@/lib/playas";
import { SITIO } from "@/lib/sitio";
// Import estático: next/image sabe el tamaño, genera el blur y sirve AVIF/WebP al ancho justo.
// Origen y licencia de las fotos: README, "Home y novedades".
import fotoPortada from "../../public/fotos/atardecer-rambla-montevideo.webp";
import fotoCasilla from "../../public/fotos/casilla-guardavidas-buceo.webp";

// Home: qué hace el sitio y cómo llegar al mapa (/playas). El único dato externo es el podio de
// favoritas (totales de me gusta, un pedido chico a Supabase cacheado 5 min, ver src/lib/me-gusta.ts;
// el navegador los vuelve a pedir al cargar, ver `PodioFavoritas`);
// la cuenta regresiva de la temporada es un cálculo local y las novedades están escritas a mano.
// ISR cada 5 min, igual que /favoritas, para que el podio no quede viejo sin volver dinámica la página.
// Estructura y estilos según la skill landing-page-design (.claude/skills): un solo objetivo (abrir el
// mapa), frase destacada que se enciende al hacer scroll y la misma llamada al final que en el hero.
export const revalidate = 300;

// Barra de Safari en el celular del color del hero (si no, queda blanca arriba de la foto): `themeColor`
// para Safari hasta iOS 18; Safari 26 ya no lo usa y toma el fondo del body (ver `fondo-oscuro` en
// globals.css). El pie también es oscuro, así que el rebote del scroll arriba y abajo queda parejo.
// Título y descripción salen del layout raíz.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export const viewport: Viewport = { themeColor: "#000000" };

// Íconos de Phosphor (@phosphor-icons/react), como en el resto del sitio.
const ICONOS = { bandera: Flag, agua: Drop, clima: Sun, omnibus: Bus };

type Icono = keyof typeof ICONOS;

function Ico({ nombre, className = "h-5 w-5" }: { nombre: Icono; className?: string }) {
  const Componente = ICONOS[nombre];
  return <Componente className={className} aria-hidden />;
}

// Las 4 tarjetas de "Qué es" (primero lo que gana quien la usa, después de dónde sale) y la franja al
// pie del hero (`corto`). `tono`: fondo pastel de cada tarjeta.
const FUNCIONES: { icono: Icono; titulo: string; corto: string; texto: string; tono: string }[] = [
  {
    icono: "bandera",
    titulo: "Sabé si te podés meter",
    corto: "Banderas de guardavidas",
    texto: "Cada casilla en un mapa 3D, con la bandera que informa la Intendencia flameando según el viento.",
    tono: "bg-amber-50",
  },
  {
    icono: "agua",
    titulo: "Esquivá el agua no apta",
    corto: "Calidad del agua",
    texto: "Calculada con los muestreos abiertos de la Intendencia. Si el último análisis es viejo, te avisamos.",
    tono: "bg-sky-50",
  },
  {
    icono: "clima",
    titulo: "Elegí según el viento",
    corto: "Clima y mejor playa",
    texto: "Pronóstico hora a hora y una sugerencia de a qué playa ir según el viento, el clima y la bandera.",
    tono: "bg-orange-50",
  },
  {
    icono: "omnibus",
    titulo: "Llegá sin auto",
    corto: "Cómo llegar en ómnibus",
    texto: "Líneas directas o con un trasbordo desde donde estés, con las próximas llegadas en vivo.",
    tono: "bg-emerald-50",
  },
];

const PASOS = [
  { titulo: "Abrí el mapa", texto: "Desde el celular o la compu. No hay que registrarse ni instalar nada." },
  {
    titulo: "Tocá tu playa",
    texto: "Ves la bandera de la casilla, el último análisis del agua, el clima hora a hora y si hay baños y duchas.",
  },
  { titulo: "Elegí cómo llegar", texto: "Líneas directas o con un trasbordo desde donde estés, con las llegadas en vivo." },
];

// Frase destacada (skill landing-page-design B11): cada palabra se enciende al hacer scroll (`Revelar`).
const FRASE = "Antes de cargar la sombrilla, sabé qué bandera hay, cómo está el agua y qué ómnibus te deja en la arena.";

// Las dos fotos son CC BY-SA 4.0: la atribución es obligatoria (también en /terminos#fuentes).
const CREDITOS_FOTOS = [
  {
    titulo: "“Atardecer 2017”",
    autor: "Marinna",
    url: "https://commons.wikimedia.org/wiki/File:Atardecer_2017.jpg",
    cambios: "recortada",
  },
  {
    titulo: "“Playa Buceo”",
    autor: "Agustín Fernández (Intendencia de Montevideo)",
    url: "https://commons.wikimedia.org/wiki/File:Playa_Buceo_-_20230113dicimouyaf0028.jpg",
    cambios: "recortada y editada con IA: personas y logo reemplazados",
  },
];

// Píldoras sobre la foto de "¿Por qué Playas UY?".
const VENTAJAS = ["100% gratis", "Sin registro", "Funciona en el celular", "Datos de la Intendencia", "Baños y duchas", "Ranking de favoritas"];

// Transición escalonada de `data-revelar` (ver globals.css): 100 ms más por elemento.
const demora = (i: number) => ({ transitionDelay: `${i * 100}ms` });

/** Ilustración del mapa para el widget del hero (decorativa, no son datos reales). */
function MiniMapa() {
  const casillas = [
    { x: 46, y: 70, color: "#22c55e", nombre: "Ramírez" },
    { x: 118, y: 92, color: "#eab308", nombre: "Pocitos" },
    { x: 196, y: 84, color: "#22c55e", nombre: "Malvín" },
    { x: 266, y: 104, color: "#ef4444", nombre: "Carrasco" },
  ];
  return (
    <svg viewBox="0 0 300 160" className="block h-auto w-full" aria-hidden>
      <rect width="300" height="160" fill="#fef3c7" />
      {/* Calles */}
      <path d="M0 22h300M0 48h300M60 0v80M150 0v90M230 0v90" stroke="#fde68a" strokeWidth="3" />
      {/* Arena y agua */}
      <path d="M0 78c30-6 50 10 85 8s55 14 95 6 60 4 120 14v54H0Z" fill="#fcd9a0" />
      <path d="M0 86c30-6 50 10 85 8s55 14 95 6 60 4 120 14v46H0Z" fill="#0ea5e9" />
      <path d="M20 128c20-4 40 4 60 0M150 138c20-4 40 4 60 0M230 124c14-3 28 3 42 0" stroke="#e0f2fe" strokeOpacity=".6" strokeWidth="2" fill="none" strokeLinecap="round" />
      {casillas.map((c) => (
        <g key={c.nombre} transform={`translate(${c.x} ${c.y})`}>
          <ellipse cx="0" cy="2" rx="7" ry="2.5" fill="#000" opacity=".15" />
          <path d="M0 0v-26" stroke="#334155" strokeWidth="1.6" />
          <path d="M0-26h14l-3.5 5 3.5 5H0Z" fill={c.color} />
          <rect x="-6" y="-9" width="12" height="9" rx="1.5" fill="#fff" stroke="#334155" strokeWidth="1.2" />
        </g>
      ))}
    </svg>
  );
}

function WidgetMapa({ diasParaInicio, activa }: { diasParaInicio: number; activa: boolean }) {
  return (
    <aside
      data-revelar
      style={demora(3)}
      className="w-full max-w-sm justify-self-center rounded-3xl bg-white/12 p-3 text-white shadow-2xl ring-1 ring-white/25 backdrop-blur-xl lg:justify-self-end"
    >
      {/* Radio interno = 24 px del borde − 12 px de relleno. */}
      <div className="overflow-hidden rounded-xl ring-1 ring-black/10">
        <MiniMapa />
      </div>
      <div className="px-2 pb-1 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-balance">Cada playa, con su casilla y su bandera</h2>
          <Link
            href="/playas"
            aria-label="Abrir el mapa de playas"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-900 transition-transform duration-700 ease-fluido hover:-translate-y-0.5 hover:translate-x-0.5 active:scale-[0.98] motion-reduce:transition-none"
          >
            <ArrowUpRight className="h-4 w-4" weight="bold" aria-hidden />
          </Link>
        </div>
        <p className="mt-2 text-sm text-pretty text-white/75">
          Agua, clima, ómnibus y baños, playa por playa. Funciona en el celular, sin instalar nada.
        </p>
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs text-white/85">
          <span className={`h-2 w-2 shrink-0 rounded-full ${activa ? "bg-emerald-400" : "bg-amber-300"}`} aria-hidden />
          {activa
            ? "Temporada de guardavidas en curso"
            : diasParaInicio === 1
              ? "Falta 1 día para la temporada de guardavidas (aprox.)"
              : `Faltan ${diasParaInicio} días para la temporada de guardavidas (aprox.)`}
        </p>
      </div>
    </aside>
  );
}

/** Todas las playas con sus totales de me gusta (el podio lo arma el cliente con los totales al día);
 *  null si la base no responde. */
async function getFavoritas() {
  const totales = await getMeGusta();
  if (!totales) return null;
  const lista = playasConocidas().map((p) => ({ ...p, ...(totales.get(p.slug) ?? { temporada: 0, siempre: 0 }) }));
  for (const [slug, t] of totales) {
    if (!lista.some((p) => p.slug === slug)) lista.push({ slug, nombre: nombrePlayaPorSlug(slug), ...t });
  }
  return lista;
}

export default async function Home() {
  const temporada = getTemporada();
  const novedades = getNovedades().slice(0, 2);
  const favoritas = await getFavoritas();
  const cantidadPlayas = playasConocidas().length;

  return (
    <div className="fondo-oscuro flex min-h-dvh flex-col bg-[#fbf8f2]">
      <Revelar />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-black text-white">
        <Image
          src={fotoPortada}
          alt="Atardecer sobre el Río de la Plata desde la Rambla de Montevideo"
          fill
          preload
          placeholder="blur"
          sizes="100vw"
          className="-z-20 object-cover object-[50%_55%]"
        />
        {/* Velo plano (sin degradé) para leer el texto sobre la foto. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-black/55" />

        <EncabezadoSitio sobreFoto />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-24 sm:px-6 lg:min-h-[100svh] lg:grid-cols-[1.3fr_1fr] lg:pb-40 lg:pt-32">
          {/* En mobile el texto va centrado; desde sm, alineado a la izquierda. */}
          <div className="text-center sm:text-left">
            <div data-revelar>
              <Etiqueta tono="foto" punto>
                Gratis · sin registro · sin instalar nada
              </Etiqueta>
            </div>
            {/* Degradé solo en el texto del título (blanco a gris), nunca en fondos. */}
            <h1
              data-revelar
              style={demora(1)}
              className="mx-auto mt-6 max-w-[680px] bg-linear-to-r from-white to-[#9b9b9b] bg-clip-text pb-2 text-5xl font-semibold tracking-tight text-balance text-transparent sm:mx-0 sm:text-6xl lg:text-7xl"
            >
              Todas las playas de {SITIO.nombre}, en un{" "}
              {/* Color propio: tapa el degradé del título (que va recortado al texto). */}
              <em className="font-serif font-normal italic tracking-normal text-amber-200">mapa.</em>
            </h1>
            <p
              data-revelar
              style={demora(2)}
              className="mx-auto mt-6 max-w-[680px] text-lg text-pretty text-white/80 sm:mx-0"
            >
              Mirá la bandera de cada casilla, la calidad del agua, el clima y qué ómnibus te deja en la arena. Antes de
              salir de casa.
            </p>
            <div data-revelar style={demora(3)} className="mt-8">
              <BotonMapa tono="claro" />
              <p className="mt-4 text-sm text-white/65">
                Datos públicos de la Intendencia de Montevideo · {cantidadPlayas}&nbsp;playas en el mapa
              </p>
            </div>
          </div>

          <WidgetMapa diasParaInicio={temporada.diasParaInicio} activa={temporada.activa} />
        </div>

        {/* Franja de funciones, al pie de la foto */}
        <div className="absolute inset-x-0 bottom-0 hidden border-t border-white/15 bg-slate-950/20 backdrop-blur-md lg:block">
          <ul className="mx-auto grid max-w-6xl grid-cols-4 divide-x divide-white/15 px-6">
            {FUNCIONES.map((f) => (
              <li key={f.titulo} className="flex items-center gap-3 px-5 py-5 text-sm text-white/85 first:pl-0">
                <Ico nombre={f.icono} className="h-5 w-5 text-amber-200" />
                {f.corto}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main id="contenido" className="flex-1">
        {/* Qué hace */}
        <section id="que-hace" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 sm:py-24">
          <div data-revelar className="text-center">
            <Etiqueta>Qué es {SITIO.nombre} {SITIO.alcance}</Etiqueta>
            <h2 className="mx-auto mt-6 max-w-[680px] text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl">
              Lo que tenés que saber de cada playa, en un solo lugar
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-slate-500">
              Juntamos la información pública de la Intendencia de Montevideo y de fuentes abiertas, y la ordenamos playa por
              playa. Somos un servicio informativo e independiente, <strong className="font-semibold">no oficial</strong>:
              no tenemos relación con la Intendencia ni con el servicio de guardavidas. La fuente oficial manda: en la playa,
              seguí siempre a los guardavidas.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Foto grande */}
            <div
              data-revelar
              className="relative isolate flex min-h-96 flex-col justify-between overflow-hidden rounded-3xl p-6 text-white sm:col-span-2 sm:p-8 lg:row-span-2 lg:min-h-136"
            >
              <Image
                src={fotoCasilla}
                alt="Imagen ilustrativa: guardavidas en una casilla de playa con la bandera verde izada"
                fill
                placeholder="blur"
                sizes="(min-width: 1152px) 576px, (min-width: 640px) 100vw, 100vw"
                className="-z-20 object-cover object-[40%_50%]"
              />
              <div aria-hidden className="absolute inset-0 -z-10 bg-black/35" />
              <h3 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                ¿Por qué
                <br />
                <em className="font-serif font-normal italic tracking-normal text-amber-200">{SITIO.nombre}?</em>
              </h3>
              <ul className="flex flex-wrap gap-2">
                {VENTAJAS.map((v) => (
                  <li key={v} className="rounded-full bg-white/15 px-3 py-1 text-sm ring-1 ring-white/30 backdrop-blur-md">
                    {v}
                  </li>
                ))}
              </ul>
              <p className="absolute bottom-2 right-3 text-xs text-white/70">
                Imagen ilustrativa editada con IA. No son guardavidas reales.
              </p>
            </div>

            {FUNCIONES.map((f, i) => (
              <div key={f.titulo} data-revelar style={demora(i + 1)} className={`flex min-h-64 flex-col rounded-3xl p-6 ${f.tono}`}>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Ico nombre={f.icono} className="h-6 w-6" />
                </span>
                <h3 className="mt-auto pt-8 text-2xl font-semibold tracking-tight text-balance text-slate-900">{f.titulo}</h3>
                <p className="mt-3 text-sm text-pretty text-slate-600">{f.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Frase destacada: cada palabra se enciende al pasar la línea del 60% de la pantalla. */}
        <section className="px-4 py-24 sm:px-6">
          <p className="mx-auto max-w-[680px] text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl">
            {FRASE.split(" ").map((palabra, i) => (
              <span key={i} data-palabra>
                {palabra}{" "}
              </span>
            ))}
          </p>
        </section>

        {/* Cómo funciona */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div data-revelar className="text-center">
            <Etiqueta>Cómo funciona</Etiqueta>
            <h2 className="mx-auto mt-6 max-w-[680px] text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl">
              Tres pasos y estás en la arena
            </h2>
          </div>
          <ol className="mt-12 grid gap-4 sm:grid-cols-3">
            {PASOS.map((p, i) => (
              <li key={p.titulo} data-revelar style={demora(i)} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 font-mono text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">{p.titulo}</h3>
                <p className="mt-2 text-pretty text-slate-600">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Favoritas */}
        <section className="px-4 sm:px-6">
          <div
            data-revelar
            className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-4xl bg-black px-6 py-12 text-white sm:p-12"
          >
            <Image src={fotoPortada} alt="" fill sizes="(min-width: 1152px) 1152px, 100vw" className="-z-20 object-cover object-[50%_70%]" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-black/60" />
            <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <Etiqueta tono="foto" punto>
                  Temporada {temporadaMeGusta()}
                </Etiqueta>
                <h2 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  Las playas <em className="font-serif font-normal italic tracking-normal text-amber-200">favoritas.</em>
                </h2>
                <p className="mt-4 max-w-lg text-lg text-pretty text-white/80">
                  Dale me gusta a tus playas en el mapa y mirá cuál va ganando. El ranking arranca de cero cada temporada:
                  cierra el 30 de abril, cuando terminan los guardavidas.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <BotonMapa tono="claro" texto="Elegí tu favorita" />
                  <Link href="/favoritas" className="text-sm font-medium text-white/85 underline-offset-4 hover:text-white hover:underline">
                    Ver el ranking completo
                  </Link>
                </div>
              </div>

              <PodioFavoritas inicial={favoritas ?? playasConocidas().map((p) => ({ ...p, temporada: 0, siempre: 0 }))} errorServidor={!favoritas} />
            </div>
            <p className="mt-10 text-xs text-white/55">
              Son los me gusta de quienes usan el sitio: no es una calificación oficial ni dice nada sobre la seguridad o la
              calidad del agua.
            </p>
          </div>
        </section>

        {/* Novedades */}
        {novedades.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <div data-revelar className="flex items-end justify-between gap-4">
              <div>
                <Etiqueta>Novedades</Etiqueta>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-slate-900">La temporada, al día</h2>
              </div>
              <Link href="/novedades" className="hidden shrink-0 text-sm font-medium text-sky-700 hover:underline sm:block">
                Ver todas →
              </Link>
            </div>
            {/* En mobile, carrusel horizontal (scroll nativo con snap; se asoma la tarjeta siguiente). */}
            <ul className="-mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
              {novedades.map((n, i) => (
                <li key={n.slug} data-revelar style={demora(i)} className="w-[85%] shrink-0 snap-start sm:w-auto">
                  <TarjetaNovedad novedad={n} />
                </li>
              ))}
            </ul>
            <Link
              href="/novedades"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-black/5 hover:ring-sky-300 sm:hidden"
            >
              Ver todas las novedades <span aria-hidden>→</span>
            </Link>
          </section>
        )}

        <PreguntasFrecuentes />

        {/* Llamada final: la misma del hero. */}
        <section className="px-4 py-24 sm:px-6">
          <div data-revelar className="mx-auto max-w-[680px] text-center">
            <h2 className="text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl">
              Mirá tu playa antes de salir
            </h2>
            <p className="mt-4 text-lg text-pretty text-slate-500">
              Bandera, agua, clima y ómnibus de las {cantidadPlayas}&nbsp;playas de {SITIO.nombre}.
            </p>
            <BotonMapa className="mt-8" />
            <p className="mt-4 text-sm text-slate-500">Gratis, sin registro y sin instalar nada.</p>
          </div>
        </section>
      </main>

      <PieSitio>
        <p>
          Fotos:{" "}
          {CREDITOS_FOTOS.map((c, i) => (
            <span key={c.url}>
              {i > 0 && " · "}
              <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                {c.titulo}
              </a>{" "}
              de {c.autor}, Wikimedia Commons,{" "}
              <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noreferrer" className="underline">
                CC BY-SA 4.0
              </a>{" "}
              ({c.cambios})
            </span>
          ))}
          .
        </p>
      </PieSitio>
    </div>
  );
}
