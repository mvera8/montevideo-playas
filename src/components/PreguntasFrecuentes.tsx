import Link from "next/link";
import BotonMapa from "@/components/BotonMapa";
import Etiqueta from "@/components/Etiqueta";
import { DIAS_VIGENCIA } from "@/lib/calidad-agua";
import { SITIO } from "@/lib/sitio";

// Preguntas frecuentes de la home, ordenadas de la más importante a la menos. Resumen los términos
// (/terminos): si cambia algo allá, actualizarlo acá también; ante diferencias, mandan los términos.
// <details> nativo: sin JS en el cliente y la página sigue estática/ISR.
const PREGUNTAS: { pregunta: string; respuesta: React.ReactNode }[] = [
  {
    pregunta: `¿${SITIO.nombre} ${SITIO.alcance} es un sitio oficial?`,
    respuesta: (
      <>
        <strong>No.</strong> Es un sitio informativo e independiente que solo muestra datos públicos ordenados playa por
        playa. No pertenece ni representa a la Intendencia de Montevideo, a Inumet, al STM ni al servicio de guardavidas, y
        no tenemos convenio con ninguno de ellos. Nada de lo que ves acá es una comunicación oficial: la fuente oficial
        siempre manda.
      </>
    ),
  },
  {
    pregunta: "¿Qué hago ante una emergencia?",
    respuesta: (
      <>
        Llamá al <strong>911</strong> y avisá al guardavidas más cercano. Este sitio no es un canal de emergencias: no
        recibimos avisos, no monitoreamos las playas y no podemos enviar ayuda.
      </>
    ),
  },
  {
    pregunta: "¿Me puedo guiar por la bandera que muestra el mapa?",
    respuesta: (
      <>
        Solo como referencia antes de salir. La bandera viene de la Intendencia y puede demorar en actualizarse. En la playa,{" "}
        <strong>seguí siempre la bandera de la casilla y las indicaciones de los guardavidas</strong>, aunque el sitio
        diga otra cosa. Fuera de la temporada (del 15 de noviembre al 30 de abril, aproximadamente) no hay guardavidas ni
        banderas vigentes.
      </>
    ),
  },
  {
    pregunta: "¿La calidad del agua que muestran es la oficial?",
    respuesta: (
      <>
        No. La calculamos nosotros con los muestreos que la Intendencia publica como datos abiertos y los criterios del
        Decreto 226/025, pero <strong>no es la declaración oficial de aptitud</strong>: la habilitación de cada playa la
        decide y comunica la Intendencia. Los muestreos se publican con días de demora y, si el último tiene más de{" "}
        {DIAS_VIGENCIA} días, lo mostramos como “sin muestreo reciente”.
      </>
    ),
  },
  {
    pregunta: "¿Son responsables si la información está mal?",
    respuesta: (
      <>
        No. El sitio se ofrece “tal cual está”, sin garantías de exactitud, disponibilidad ni continuidad, y depende de
        datos de terceros que pueden fallar o llegar tarde. Las decisiones que tomes (bañarte, ir a una playa, tomar un
        ómnibus) son tu responsabilidad. El detalle está en los <Link href="/terminos#responsabilidad">términos de uso</Link>.
      </>
    ),
  },
  {
    pregunta: "¿De dónde salen los datos?",
    respuesta: (
      <>
        De fuentes públicas y abiertas: la API y los datos abiertos de la Intendencia de Montevideo (playas, banderas,
        calidad del agua, baños y ómnibus del STM), MET Norway (clima y pronóstico), Inumet (alertas meteorológicas), NOAA
        (temperatura del agua y olas) y OpenStreetMap (mapa, baños y duchas). Las fuentes y licencias completas están en{" "}
        <Link href="/terminos#fuentes">Términos y fuentes</Link>.
      </>
    ),
  },
  {
    pregunta: "¿Qué tan actualizada está la información?",
    respuesta: (
      <>
        Cada dato se actualiza al ritmo de su fuente: las banderas y los ómnibus en vivo, cada pocos minutos; el clima, cada media
        hora; el agua, cuando la Intendencia publica un muestreo nuevo. Siempre que podemos mostramos la fecha del dato, y si
        es viejo te avisamos en vez de mostrarlo como actual.
      </>
    ),
  },
  {
    pregunta: "¿El clima y las alertas son oficiales?",
    respuesta: (
      <>
        No. El pronóstico sale de modelos meteorológicos que pueden fallar. Las alertas son las de Inumet, consultadas cada
        pocos minutos, pero que no veas una acá <strong>no garantiza que no la haya</strong>: las alertas oficiales son las
        de inumet.gub.uy y las indicaciones del Sinae.
      </>
    ),
  },
  {
    pregunta: "¿Los horarios de ómnibus son exactos?",
    respuesta: (
      <>
        Son estimaciones con los horarios publicados del STM y la posición GPS de los ómnibus. No contemplan feriados,
        desvíos ni cambios de último momento.
      </>
    ),
  },
  {
    pregunta: "¿Qué significan los me gusta y el ranking de favoritas?",
    respuesta: (
      <>
        Son los me gusta de quienes usan el sitio: muestran preferencias, no condiciones. No son una calificación oficial
        ni dicen nada sobre la seguridad o la calidad del agua.
      </>
    ),
  },
  {
    pregunta: "¿Es gratis? ¿Qué hacen con mis datos?",
    respuesta: (
      <>
        Es gratis y no hace falta registrarse. Tu ubicación se usa solo si la pedís, para calcular cómo llegar, y no la
        guardamos. Usamos Google Analytics para contar visitas. Más detalle en la{" "}
        <Link href="/privacidad">política de privacidad</Link>.
      </>
    ),
  },
  {
    pregunta: "Encontré un error, ¿cómo aviso?",
    respuesta: (
      <>
        Escribinos desde <Link href="/contacto">Contacto</Link>. Si el error está en un dato de origen (por ejemplo, una
        bandera o un muestreo), corregirlo depende de la fuente oficial.
      </>
    ),
  },
];

export default function PreguntasFrecuentes() {
  return (
    <section id="preguntas-frecuentes" className="scroll-mt-8 bg-sky-50 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <Etiqueta className="bg-white/60">Preguntas frecuentes</Etiqueta>
          <h2 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-balance text-slate-900 sm:text-5xl">
            Todo lo que querías <em className="font-serif font-normal italic text-sky-600">saber.</em>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            Lo primero: no somos un sitio oficial, solo mostramos datos públicos. En la playa mandan los guardavidas y, ante
            una emergencia, llamá al <strong className="font-semibold text-slate-700">911</strong>.
          </p>
        </div>

        <ul className="mt-12 space-y-3">
          {PREGUNTAS.map((p) => (
            <li key={p.pregunta}>
              <details className="group rounded-2xl bg-white shadow-sm ring-1 ring-sky-100 open:ring-sky-200">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-left font-medium text-slate-900 hover:text-sky-700 sm:px-6 [&::-webkit-details-marker]:hidden">
                  {p.pregunta}
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    className="h-5 w-5 shrink-0 text-sky-700 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  >
                    <path d="M12 4v16M4 12h16" />
                  </svg>
                </summary>
                <p className="px-5 pb-6 leading-relaxed text-slate-600 sm:px-6 sm:pr-14 [&_a]:text-sky-700 [&_a]:underline [&_strong]:font-semibold [&_strong]:text-slate-800">
                  {p.respuesta}
                </p>
              </details>
            </li>
          ))}
        </ul>

        <div className="mt-16 flex flex-col items-center text-center">
          <svg
            viewBox="0 0 48 48"
            aria-hidden
            className="h-14 w-14 text-sky-700"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 10.5a10 10 0 1 1 9.5 13.6l-1 .1 6 3.3-1.4-5.2A10 10 0 0 1 20 10.5Z" fill="white" />
            <path d="M24 14h10M24 18h8" />
            <path d="M8 31a9 9 0 1 1 5.3 8.2L7 41l2-5.3A9 9 0 0 1 8 31Z" fill="white" />
            <path d="M14.7 28.6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-.9.8-.9 1.4v.6M17 35.5h.01" />
          </svg>
          <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">¿Te quedó alguna duda?</h3>
          <p className="mt-3 max-w-md text-slate-500">
            Escribinos para consultas, errores en los datos o ideas para el sitio.
          </p>
          <BotonMapa href="/contacto" texto="Escribinos" tamano="chico" className="mt-7" />
        </div>

        <p className="mt-14 text-center text-xs text-slate-500">
          Estas respuestas son un resumen. Ante cualquier diferencia, mandan los{" "}
          <Link href="/terminos" className="underline">
            términos de uso
          </Link>{" "}
          y la información de las fuentes oficiales.
        </p>
      </div>
    </section>
  );
}
