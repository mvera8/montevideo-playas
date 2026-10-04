import type { Metadata } from "next";
import Link from "next/link";
import PaginaLegal, { Destacado } from "@/components/legal/PaginaLegal";
import { SITIO } from "@/lib/sitio";

export const metadata: Metadata = {
  title: `Términos de uso y fuentes · ${SITIO.nombre}`,
  description: "Condiciones de uso de Playas UY, alcance de la información y fuentes de datos.",
};

const FUENTES = [
  {
    nombre: "Intendencia de Montevideo — Montevideo API",
    url: "https://api.montevideo.gub.uy",
    usa: "Playas, casillas de guardavidas y banderas; ómnibus en vivo y horarios del STM (GTFS).",
    licencia: "Servicio gratuito del portal Montevideo API.",
  },
  {
    nombre: "Intendencia de Montevideo — Monitoreo de agua de playas",
    url: "https://catalogodatos.gub.uy/dataset/monitoreo-de-agua-de-playas",
    usa: "Enterococos, cianobacterias y temperatura del agua medidos en cada playa.",
    licencia: "Datos abiertos, Licencia de Datos Abiertos – Uruguay.",
  },
  {
    nombre: "Intendencia de Montevideo — Equipamiento urbano",
    url: "https://catalogodatos.gub.uy/dataset/equipamiento-urbano-espacios-publicos",
    usa: "Baños y bebederos públicos (solo los activos).",
    licencia: "Datos abiertos, Licencia de Datos Abiertos – Uruguay.",
  },
  {
    nombre: "MET Norway (Instituto Meteorológico de Noruega)",
    url: "https://api.met.no",
    usa: "Clima actual y pronóstico por hora (temperatura, sensación térmica, viento, lluvia, UV).",
    licencia: "Datos bajo licencia CC BY 4.0, con uso comercial permitido.",
    licenciaUrl: "https://creativecommons.org/licenses/by/4.0/deed.es",
  },
  {
    nombre: "Inumet (Instituto Uruguayo de Meteorología)",
    url: "https://www.inumet.gub.uy/alerta",
    usa: "Advertencias meteorológicas vigentes para Montevideo (nivel, fenómeno, horario y enlace al boletín).",
    licencia: "Información pública de Inumet, tomada de su sitio web; no es una API oficial.",
  },
  {
    nombre: "NOAA — OISST y WaveWatch III (PacIOOS)",
    url: "https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21NrtAgg_LonPM180.html",
    usa: "Temperatura del agua (modelo satelital diario) y altura de olas (pronóstico hora a hora).",
    licencia: "Datos públicos del gobierno de EE. UU. y de PacIOOS, de uso y redistribución libres.",
  },
  {
    nombre: "OpenStreetMap, OpenMapTiles y OpenFreeMap",
    url: "https://www.openstreetmap.org/copyright",
    usa: "Mapa base (calles, costa, edificios) y baños, bebederos y duchas cargados por la comunidad.",
    licencia: "© colaboradores de OpenStreetMap, bajo licencia ODbL.",
  },
  {
    nombre: "Decreto N.º 226/025",
    url: "https://www.impo.com.uy/bases/decretos/226-2025",
    usa: "Criterios de aptitud para baños (art. 16) que usamos para evaluar la calidad del agua.",
    licencia: "Normativa pública (IMPO).",
  },
  {
    nombre: "Wikimedia Commons — “Atardecer 2017”, de Marinna",
    url: "https://commons.wikimedia.org/wiki/File:Atardecer_2017.jpg",
    usa: "Foto de portada de la página de inicio (atardecer desde la Rambla de Montevideo), recortada y comprimida.",
    licencia: "Licencia CC BY-SA 4.0.",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.es",
  },
  {
    nombre: "Wikimedia Commons — “Playa Buceo”, de Agustín Fernández (Intendencia de Montevideo)",
    url: "https://commons.wikimedia.org/wiki/File:Playa_Buceo_-_20230113dicimouyaf0028.jpg",
    usa: "Foto de la casilla de guardavidas en la página de inicio, recortada, comprimida y editada con inteligencia artificial (se reemplazaron las personas y el logo de la Intendencia por otros ficticios). No muestra a guardavidas reales ni el uniforme oficial.",
    licencia: "Licencia CC BY-SA 4.0. La versión editada se distribuye bajo la misma licencia.",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.es",
  },
];

export default function Terminos() {
  return (
    <PaginaLegal
      titulo="Términos de uso y fuentes"
      bajada="Qué es este sitio, cuánto podés confiar en cada dato y de dónde sale la información."
    >
      <Destacado tono="aviso">
        <p className="font-semibold text-slate-900 dark:text-white">Lo más importante</p>
        <ul className="mt-2">
          <li>
            {SITIO.nombre} es un servicio <strong>informativo e independiente</strong>. No es un sitio oficial y no
            pertenece a la Intendencia de Montevideo, a Inumet, al STM ni al servicio de guardavidas. No tenemos
            relación, convenio ni representación con ninguno de ellos y no hablamos en su nombre. Las imágenes de
            guardavidas del sitio son ilustrativas: no muestran a guardavidas reales ni el uniforme oficial.
          </li>
          <li>
            En la playa, <strong>siempre seguí las indicaciones de los guardavidas y la bandera de la casilla</strong>,
            aunque el sitio diga otra cosa.
          </li>
          <li>
            Ante una emergencia, llamá al <strong>911</strong>.
          </li>
        </ul>
      </Destacado>

      <h2 id="servicio">El servicio</h2>
      <p>
        {SITIO.nombre} reúne información pública sobre las playas de Montevideo: casillas y banderas, calidad del agua,
        clima y alertas de Inumet, recomendaciones y cómo llegar en ómnibus. También podés darle “me gusta” a las playas y leer novedades de la
        temporada. Usarlo es gratuito y
        no requiere registro. Al usar el sitio aceptás estos términos.
      </p>

      <h2 id="alcance">Alcance de la información</h2>
      <p>Toda la información es orientativa y puede estar desactualizada o tener errores. En particular:</p>

      <h3>Banderas y guardavidas</h3>
      <p>
        Vienen de la Intendencia de Montevideo y pueden demorar en actualizarse. Fuera de la temporada de guardavidas (del
        15 de noviembre al 30 de abril, aproximadamente) no hay vigilancia ni banderas vigentes.
      </p>

      <h3>Calidad del agua</h3>
      <p>
        La calculamos nosotros con los muestreos que la Intendencia publica como datos abiertos, aplicando los criterios
        del artículo 16 del Decreto 226/025: la media de cinco muestras no debe superar 200 enterococos/100 ml y ninguna
        muestra puede superar 500. <strong>No es la declaración oficial de aptitud</strong>: la habilitación de cada playa la
        decide y comunica la Intendencia (bandera sanitaria). Los datos se publican con algunos días de demora, y si un
        muestreo tiene más de 21 días lo mostramos como “sin muestreo reciente”.
      </p>

      <h3>Clima y pronóstico</h3>
      <p>
        Provienen de modelos meteorológicos (MET Norway para el clima, NOAA para el mar) y pueden fallar. La
        temperatura del agua es estimada por un modelo satelital diario, salvo cuando indicamos “medida IM”, y si
        tiene más de 4 días no la mostramos. Las olas salen de un modelo global de baja resolución y son orientativas
        en el Río de la Plata. El índice UV es el que habría con cielo despejado (el máximo posible). La lluvia es la
        cantidad prevista por hora, no una probabilidad. El amanecer y el atardecer los calculamos nosotros.
      </p>

      <h3 id="alertas">Alertas meteorológicas</h3>
      <p>
        Mostramos las advertencias de Inumet que incluyen a Montevideo, tal como las publica en su sitio web. Las
        consultamos cada pocos minutos, así que pueden aparecer o terminar con algo de demora, y si no pudimos
        consultarlas en la última hora lo indicamos en vez de decir que no hay alertas. Que no veas una alerta acá{" "}
        <strong>no garantiza que no la haya</strong>: <strong>las alertas oficiales son las de Inumet</strong>{" "}
        (inumet.gub.uy) y, ante una emergencia, las indicaciones del Sinae y del 911.
      </p>

      <h3>Recomendaciones</h3>
      <p>
        “¿A qué playa voy?” y “Mejor horario” son un puntaje propio que combina bandera, calidad del agua, viento según
        hacia dónde mira cada playa (calculado con la línea de costa de OpenStreetMap), temperatura, lluvia y tiempo de viaje. Es una sugerencia, no una
        garantía de que la playa esté en buenas condiciones.
      </p>

      <h3>Baños, bebederos y duchas</h3>
      <p>
        Combinamos el registro oficial de la Intendencia (solo los marcados como activos) con datos de OpenStreetMap,
        que carga la comunidad. Pueden estar cerrados, fuera de horario o haber dejado de existir; los baños químicos
        suelen instalarse solo en temporada. Para los de OpenStreetMap mostramos la fecha de la última verificación o
        edición, y marcamos como “dato viejo” los que no se actualizan hace más de dos años. Los de la Intendencia no
        traen fecha por punto.
      </p>

      <h3>Cómo llegar en ómnibus</h3>
      <p>
        Los recorridos se calculan con los horarios publicados del STM y las llegadas “en vivo” se estiman a partir de la
        posición GPS de los ómnibus. No contemplan feriados, desvíos ni cambios de último momento.
      </p>

      <h3 id="me-gusta">Me gusta</h3>
      <p>
        Los “me gusta” son una función propia del sitio: muestran cuántas personas marcaron que les gusta cada playa, no
        sus condiciones. <strong>No son una calificación oficial</strong> ni dicen nada sobre la seguridad o la calidad del
        agua, y no se suman al puntaje de “¿A qué playa voy?”. Se cuentan por temporada (de julio a junio) y en total. El
        número se actualiza cada pocos minutos y puede no reflejar los últimos cambios. La página de{" "}
        <Link href="/favoritas">playas favoritas</Link> (y el podio de la página de inicio) ordena las playas por los me
        gusta de la temporada: es un ranking
        de preferencias de quienes usan el sitio, no una recomendación ni una evaluación de las playas.
      </p>

      <h3 id="novedades">Novedades</h3>
      <p>
        Las notas de <Link href="/novedades">Novedades</Link> son textos propios e informativos sobre la temporada y el
        sitio. Las fechas que mencionan (por ejemplo, el inicio de la temporada de guardavidas) son aproximadas:{" "}
        <strong>las fechas, horarios y avisos oficiales los define y comunica la Intendencia de Montevideo</strong>. La
        cuenta regresiva de la página de inicio usa esa misma fecha aproximada (15 de noviembre).
      </p>

      <h2 id="responsabilidad">Responsabilidad</h2>
      <p>
        El sitio se ofrece “tal cual está”, sin garantías de exactitud, disponibilidad o continuidad. Las decisiones que
        tomes a partir de la información (bañarte, ir a una playa, tomar un ómnibus) son tu responsabilidad. En la medida
        que la ley lo permita, {SITIO.responsable} no es responsable por daños derivados del uso del sitio o de errores en
        la información de terceros.
      </p>

      <h2 id="uso">Uso aceptable</h2>
      <p>
        No uses el sitio ni sus interfaces de datos de forma automatizada o masiva, ni intentes afectar su funcionamiento.
        No infles los “me gusta” con programas, cuentas múltiples ni ningún otro mecanismo: es un gesto por persona.
        Podemos limitar el acceso, y anular o borrar me gusta, ante usos abusivos. Si necesitás los datos para otro proyecto, usá directamente las
        fuentes oficiales listadas abajo.
      </p>

      <h2 id="fuentes">Fuentes de datos y licencias</h2>
      <p>Agradecemos a quienes publican estos datos. Los derechos sobre cada dato pertenecen a su fuente.</p>
      <div className="not-prose mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {FUENTES.map((f) => (
          <div key={f.nombre} className="p-4">
            <a href={f.url} target="_blank" rel="noreferrer" className="font-semibold">
              {f.nombre}
            </a>
            <p className="mt-1 text-sm">{f.usa}</p>
            <p className="mt-1 text-sm text-slate-500">
              {f.licenciaUrl ? (
                <a href={f.licenciaUrl} target="_blank" rel="noreferrer">
                  {f.licencia}
                </a>
              ) : (
                f.licencia
              )}
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        El mapa usa además software libre: MapLibre GL JS (licencia BSD) y three.js (licencia MIT).
      </p>

      <h2 id="propiedad">Propiedad intelectual</h2>
      <p>
        El diseño, los textos y el código de {SITIO.nombre} pertenecen a {SITIO.responsable}. Los datos y las imágenes de
        terceros se usan según las licencias indicadas arriba.
      </p>

      <h2 id="privacidad">Privacidad</h2>
      <p>
        Cómo usamos tu ubicación y otros datos está explicado en la <Link href="/privacidad">Política de privacidad</Link>.
      </p>

      <h2 id="cambios">Cambios y ley aplicable</h2>
      <p>
        Podemos actualizar estos términos; la versión vigente es la publicada en esta página. Se rigen por las leyes de la
        República Oriental del Uruguay. Consultas: <strong>{SITIO.contacto}</strong>.
      </p>
    </PaginaLegal>
  );
}
