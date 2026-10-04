import Image from "next/image";
import Link from "next/link";
import BotonMapa from "@/components/BotonMapa";
import EncabezadoSitio from "@/components/EncabezadoSitio";
import Etiqueta from "@/components/Etiqueta";
import PieSitio from "@/components/PieSitio";
import TarjetaNovedad from "@/components/TarjetaNovedad";
import { getNovedades } from "@/lib/novedades";
import { getMeGusta } from "@/lib/me-gusta";
import { temporadaMeGusta } from "@/lib/me-gusta-temporada";
import { getTemporada, nombrePlayaPorSlug } from "@/lib/playas";
import { SITIO } from "@/lib/sitio";
// Import estático: next/image sabe el tamaño, genera el blur y sirve AVIF/WebP al ancho justo.
// Origen y licencia de las fotos: README, "Home y novedades".
import fotoPortada from "../../public/fotos/atardecer-rambla-montevideo.jpg";
import fotoCasilla from "../../public/fotos/casilla-guardavidas-buceo.jpg";

// Home: qué hace el sitio y cómo llegar al mapa (/playas). El único dato externo es el podio de
// favoritas (totales de me gusta, un pedido chico a Supabase cacheado 5 min, ver src/lib/me-gusta.ts);
// la cuenta regresiva de la temporada es un cálculo local y las novedades están escritas a mano.
// ISR cada 5 min, igual que /favoritas, para que el podio no quede viejo sin volver dinámica la página.
export const revalidate = 300;

const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONOS = {
  bandera: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h11l-2.5 4 2.5 4H6" />
    </>
  ),
  agua: <path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5Z" />,
  clima: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </>
  ),
  brujula: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  omnibus: (
    <>
      <rect x="4.5" y="3.5" width="15" height="14" rx="2.5" />
      <path d="M4.5 11h15M8 20.5v-3M16 20.5v-3M8 14.5h.01M16 14.5h.01" />
    </>
  ),
  corazon: <path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z" />,
};

type Icono = keyof typeof ICONOS;

function Ico({ nombre, className = "h-5 w-5" }: { nombre: Icono; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...trazo}>
      {ICONOS[nombre]}
    </svg>
  );
}

// Las 4 tarjetas de "Qué es" y la franja al pie del hero. `tono`: fondo pastel de cada tarjeta.
const FUNCIONES: { icono: Icono; titulo: string; texto: string; tono: string }[] = [
  {
    icono: "bandera",
    titulo: "Banderas de guardavidas",
    texto: "Cada casilla en un mapa 3D, con la bandera que informa la Intendencia flameando según el viento.",
    tono: "bg-amber-50 dark:bg-amber-500/10",
  },
  {
    icono: "agua",
    titulo: "Calidad del agua",
    texto: "Calculada con los muestreos abiertos de la Intendencia. Si el último análisis es viejo, te avisamos.",
    tono: "bg-sky-50 dark:bg-sky-500/10",
  },
  {
    icono: "clima",
    titulo: "Clima y mejor playa",
    texto: "Pronóstico hora a hora y una sugerencia de a qué playa ir según el viento, el clima y la bandera.",
    tono: "bg-orange-50 dark:bg-orange-500/10",
  },
  {
    icono: "omnibus",
    titulo: "Cómo llegar en ómnibus",
    texto: "Líneas directas o con un trasbordo desde donde estés, con las próximas llegadas en vivo.",
    tono: "bg-emerald-50 dark:bg-emerald-500/10",
  },
];

// Las dos fotos son CC BY-SA 4.0: la atribución es obligatoria (también en /terminos#fuentes).
const CREDITOS_FOTOS = [
  { titulo: "“Atardecer 2017”", autor: "Marinna", url: "https://commons.wikimedia.org/wiki/File:Atardecer_2017.jpg" },
  {
    titulo: "“Playa Buceo”",
    autor: "Agustín Fernández (Intendencia de Montevideo)",
    url: "https://commons.wikimedia.org/wiki/File:Playa_Buceo_-_20230113dicimouyaf0028.jpg",
  },
];

// Píldoras sobre la foto de "¿Por qué Playas UY?".
const VENTAJAS = ["100% gratis", "Sin registro", "Funciona en el celular", "Datos de la Intendencia", "Baños y duchas", "Ranking de favoritas"];

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
      <defs>
        <linearGradient id="mm-agua" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      <rect width="300" height="160" fill="#fef3c7" />
      {/* Calles */}
      <path d="M0 22h300M0 48h300M60 0v80M150 0v90M230 0v90" stroke="#fde68a" strokeWidth="3" />
      {/* Arena y agua */}
      <path d="M0 78c30-6 50 10 85 8s55 14 95 6 60 4 120 14v54H0Z" fill="#fcd9a0" />
      <path d="M0 86c30-6 50 10 85 8s55 14 95 6 60 4 120 14v46H0Z" fill="url(#mm-agua)" />
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
    <aside className="w-full max-w-sm justify-self-center rounded-[1.75rem] bg-white/12 p-3 text-white shadow-2xl ring-1 ring-white/25 backdrop-blur-xl lg:justify-self-end">
      <div className="overflow-hidden rounded-2xl ring-1 ring-black/10">
        <MiniMapa />
      </div>
      <div className="px-2 pb-1 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold leading-snug">Cada playa, con su casilla y su bandera</h2>
          <Link
            href="/playas"
            aria-label="Abrir el mapa de playas"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-900 transition-transform hover:-translate-y-0.5 hover:translate-x-0.5 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden {...trazo} strokeWidth={2.4}>
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Link>
        </div>
        <p className="mt-2 text-sm text-white/75">
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

/** Las 3 playas con más me gusta en la temporada; null si la base no responde. */
async function getPodio() {
  const totales = await getMeGusta();
  if (!totales) return null;
  return [...totales.entries()]
    .filter(([, t]) => t.temporada > 0)
    .sort(([a, x], [b, y]) => y.temporada - x.temporada || a.localeCompare(b, "es"))
    .slice(0, 3)
    .map(([slug, t]) => ({ slug, nombre: nombrePlayaPorSlug(slug), total: t.temporada }));
}

const numero = new Intl.NumberFormat("es-UY");
const MEDALLAS = ["🥇", "🥈", "🥉"];

function PodioFavoritas({ podio }: { podio: Awaited<ReturnType<typeof getPodio>> }) {
  if (!podio || podio.length === 0) {
    return (
      <div className="rounded-3xl bg-white/10 p-6 text-center ring-1 ring-white/20 backdrop-blur">
        <p className="text-4xl" aria-hidden>
          🏖️
        </p>
        <p className="mt-3 text-lg font-semibold">
          {podio ? "Todavía nadie votó esta temporada" : "Ahora no pudimos cargar el ranking"}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {podio ? "Abrí el mapa y dale el primer me gusta a tu playa." : "Probá de nuevo en unos minutos."}
        </p>
      </div>
    );
  }
  return (
    <ol className="space-y-3">
      {podio.map((p, i) => (
        <li key={p.slug}>
          <Link
            href={`/playas?playa=${p.slug}`}
            className="flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/20 backdrop-blur transition-colors hover:bg-white/15"
          >
            <span className="text-2xl" aria-hidden>
              {MEDALLAS[i]}
            </span>
            <span className="min-w-0 flex-1 truncate text-lg font-semibold">
              <span className="sr-only">{i + 1}.º </span>
              {p.nombre}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-rose-300">
              <Ico nombre="corazon" className="h-4 w-4 fill-current" />
              {numero.format(p.total)}
              <span className="sr-only"> me gusta</span>
            </span>
          </Link>
        </li>
      ))}
      {/* Puestos libres: el podio siempre muestra 3 lugares */}
      {MEDALLAS.slice(podio.length).map((m) => (
        <li
          key={m}
          className="flex items-center gap-4 rounded-2xl px-5 py-4 border border-dashed border-white/30 text-white/60"
        >
          <span className="text-2xl opacity-60" aria-hidden>
            {m}
          </span>
          <span className="text-sm">Puesto libre: puede ser tu playa</span>
        </li>
      ))}
    </ol>
  );
}

export default async function Home() {
  const temporada = getTemporada();
  const novedades = getNovedades().slice(0, 2);
  const podio = await getPodio();

  return (
    <div className="flex min-h-dvh flex-col bg-[#fbf8f2] dark:bg-slate-950">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-slate-900 text-white">
        <Image
          src={fotoPortada}
          alt="Atardecer sobre el Río de la Plata desde la Rambla de Montevideo"
          fill
          preload
          placeholder="blur"
          sizes="100vw"
          className="-z-20 object-cover object-[50%_55%]"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-slate-950/10" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-slate-950/70 to-transparent" />

        <EncabezadoSitio sobreFoto />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-32 sm:px-6 lg:min-h-[100svh] lg:grid-cols-[1.3fr_1fr] lg:pb-40">
          <div>
            <Etiqueta tono="foto" punto>
              100% gratis · sin registro
            </Etiqueta>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Todas las playas de {SITIO.alcance}, en un{" "}
              <em className="font-serif font-normal italic tracking-normal text-amber-200">mapa.</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              Antes de salir, mirá la bandera de cada casilla, la calidad del agua, el clima y cómo llegar en ómnibus. Elegí
              tu playa en segundos.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <BotonMapa tono="claro" />
              <a href="#que-hace" className="text-sm font-medium text-white/85 underline-offset-4 hover:text-white hover:underline">
                Cómo funciona
              </a>
            </div>
            <p className="mt-4 text-sm text-white/60">Gratis, sin cuentas y sin instalar nada.</p>
          </div>

          <WidgetMapa diasParaInicio={temporada.diasParaInicio} activa={temporada.activa} />
        </div>

        {/* Franja de funciones, al pie de la foto */}
        <div className="absolute inset-x-0 bottom-0 hidden border-t border-white/15 bg-slate-950/20 backdrop-blur-md lg:block">
          <ul className="mx-auto grid max-w-6xl grid-cols-4 divide-x divide-white/15 px-6">
            {FUNCIONES.map((f) => (
              <li key={f.titulo} className="flex items-center gap-3 px-5 py-5 text-sm text-white/85 first:pl-0">
                <Ico nombre={f.icono} className="h-5 w-5 text-amber-200" />
                {f.titulo}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main className="flex-1">
        {/* Qué hace */}
        <section id="que-hace" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 sm:py-28">
          <div className="text-center">
            <Etiqueta>Qué es {SITIO.nombre}</Etiqueta>
            <h2 className="mx-auto mt-6 max-w-4xl text-3xl font-medium leading-[1.15] tracking-tight text-balance text-slate-900 sm:text-5xl dark:text-white">
              Hicimos el lugar para elegir playa antes de salir:{" "}
              <span className="text-sky-600 dark:text-sky-400">banderas, agua, clima y ómnibus</span> en un solo mapa,{" "}
              <span className="text-amber-600 dark:text-amber-400">gratis para todos</span>.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-slate-500 dark:text-slate-400">
              Juntamos la información pública de la Intendencia de Montevideo y de fuentes abiertas, y la ordenamos playa por
              playa. La fuente oficial manda: en la playa, seguí siempre a los guardavidas.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Foto grande */}
            <div className="relative isolate flex min-h-[26rem] flex-col justify-between overflow-hidden rounded-3xl p-6 text-white sm:col-span-2 sm:p-8 lg:row-span-2 lg:min-h-[34rem]">
              <Image
                src={fotoCasilla}
                alt="Guardavidas en su casilla de Playa Buceo, con la bandera verde izada"
                fill
                placeholder="blur"
                sizes="(min-width: 1152px) 576px, (min-width: 640px) 100vw, 100vw"
                className="-z-20 object-cover object-[40%_50%]"
              />
              <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/55 via-transparent to-slate-950/70" />
              <h3 className="text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
                ¿Por qué
                <br />
                <em className="font-serif font-normal italic text-amber-200">{SITIO.nombre}?</em>
              </h3>
              <ul className="flex flex-wrap gap-2">
                {VENTAJAS.map((v) => (
                  <li key={v} className="rounded-full bg-white/15 px-3.5 py-1.5 text-sm ring-1 ring-white/30 backdrop-blur-md">
                    {v}
                  </li>
                ))}
              </ul>
            </div>

            {FUNCIONES.map((f) => (
              <div key={f.titulo} className={`flex min-h-[16rem] flex-col rounded-3xl p-6 ${f.tono}`}>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                  <Ico nombre={f.icono} />
                </span>
                <h3 className="mt-auto pt-8 text-2xl font-medium leading-tight tracking-tight text-slate-900 dark:text-white">
                  {f.titulo}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.texto}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-3">
            <BotonMapa />
            <p className="text-sm text-slate-500">Es gratis. No hace falta registrarse.</p>
          </div>
        </section>

        {/* Favoritas */}
        <section className="px-4 sm:px-6">
          <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-slate-900 px-6 py-14 text-white sm:px-12 sm:py-16">
            <Image src={fotoPortada} alt="" fill sizes="(min-width: 1152px) 1152px, 100vw" className="-z-20 object-cover object-[50%_70%]" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-slate-950/65" />
            <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <Etiqueta tono="foto" punto>
                  Temporada {temporadaMeGusta()}
                </Etiqueta>
                <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  Las playas <em className="font-serif font-normal italic text-amber-200">favoritas.</em>
                </h2>
                <p className="mt-4 max-w-lg text-lg text-white/80">
                  Dale me gusta a tus playas en el mapa y mirá cuál va ganando. El ranking arranca de cero cada temporada,
                  de julio a junio.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <BotonMapa tono="claro" texto="Elegí tu favorita" />
                  <Link href="/favoritas" className="text-sm font-medium text-white/85 underline-offset-4 hover:text-white hover:underline">
                    Ver el ranking completo
                  </Link>
                </div>
              </div>

              <PodioFavoritas podio={podio} />
            </div>
            <p className="mt-10 text-xs text-white/55">
              Son los me gusta de quienes usan el sitio: no es una calificación oficial ni dice nada sobre la seguridad o la
              calidad del agua.
            </p>
          </div>
        </section>

        {/* Novedades */}
        {novedades.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="flex items-end justify-between gap-4">
              <div>
                <Etiqueta>Novedades</Etiqueta>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">La temporada, al día</h2>
              </div>
              <Link href="/novedades" className="shrink-0 text-sm font-medium text-sky-700 hover:underline dark:text-sky-300">
                Ver todas →
              </Link>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {novedades.map((n) => (
                <li key={n.slug}>
                  <TarjetaNovedad novedad={n} />
                </li>
              ))}
            </ul>
          </section>
        )}
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
              </a>
            </span>
          ))}{" "}
          (recortadas).
        </p>
      </PieSitio>
    </div>
  );
}
