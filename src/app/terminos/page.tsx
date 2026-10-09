import type { Metadata } from "next";
import Link from "next/link";
import PaginaLegal, { Destacado } from "@/components/legal/PaginaLegal";
import { SITIO } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Términos de uso y fuentes",
  description: "Condiciones de uso de Playas UY, alcance de la información y fuentes de datos.",
  alternates: { canonical: "/terminos" },
};

const FUENTES = [
  {
    nombre: "Intendencia de Montevideo — Montevideo API",
    url: "https://api.montevideo.gub.uy",
    usa: "Playas, casillas de guardavidas y banderas; ómnibus en vivo y horarios del STM (GTFS).",
    licencia: "Servicio gratuito del portal Montevideo API.",
  },
  {
    nombre: "Intendencia de Montevideo — Sitio de playas",
    url: "https://m.montevideo.gub.uy/playas/",
    usa: "Hasta cuándo vale cada bandera (de seguridad y sanitaria) y la recomendación que acompaña a la bandera sanitaria.",
    licencia: "Información pública del sitio de la Intendencia.",
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
    nombre: "iNaturalist",
    url: "https://www.inaturalist.org",
    usa: "Avistamientos de aguas vivas cargados por la comunidad en la costa de Montevideo (especie, fecha y lugar aproximado, con enlace a cada observación).",
    licencia: "Cada observación conserva la licencia que eligió su autor (CC0, CC BY, CC BY-NC u otras). Solo mostramos hechos con enlace a la fuente; no reproducimos fotos ni textos.",
    licenciaUrl: "https://www.inaturalist.org/pages/terms",
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
        <p className="font-semibold text-slate-900">Lo más importante</p>
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
        clima y alertas de Inumet, aguas vivas reportadas por la comunidad, recomendaciones y cómo llegar en ómnibus. También podés darle “me gusta” a las playas, sacarte una foto con los datos de la playa, leer novedades de la
        temporada y escribirnos desde el formulario de contacto. Usarlo es gratuito y
        no requiere registro. Al usar el sitio aceptás estos términos.
      </p>

      <h2 id="alcance">Alcance de la información</h2>
      <p>Toda la información es orientativa y puede estar desactualizada o tener errores. En particular:</p>

      <h3>Banderas y guardavidas</h3>
      <p>
        Vienen de la Intendencia de Montevideo y pueden demorar en actualizarse. Fuera de la temporada de guardavidas (del
        15 de noviembre al 30 de abril, aproximadamente) no hay vigilancia ni banderas de seguridad vigentes.
      </p>
      <p>
        La <strong>bandera sanitaria</strong> (roja con cruz verde, “no apta para baños”) la informa la Intendencia
        todo el año, por ejemplo durante las 24 horas posteriores a lluvias. La mostramos junto con la bandera de
        seguridad, solo mientras la Intendencia la da por vigente. Si no podemos saber hasta cuándo vale, fuera de
        temporada no la mostramos: ante la duda, consultá el sitio de la Intendencia y respetá lo que indique la casilla.
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

      <h3 id="aguas-vivas">Aguas vivas</h3>
      <p>
        No hay un monitoreo oficial de aguas vivas en Montevideo. Mostramos los avistamientos que personas voluntarias
        cargan en iNaturalist, con la distancia a cada playa: algunos están identificados por la comunidad y otros no
        (lo indicamos), y la ubicación puede ser aproximada. Solo mostramos los de los últimos 10 días; si no hay ninguno, no mostramos la sección.
        El agua viva que aparece en el mapa frente a una playa indica que hubo al menos un reporte a menos de 5 km en
        ese período, no que haya aguas vivas en ese lugar exacto ni ahora.
        Se reportan muy pocas por temporada, así que <strong>que no haya reportes no significa que no haya aguas
        vivas</strong>. Los consejos que acompañan los reportes son generales y no reemplazan la atención médica: ante una
        picadura, consultá al guardavidas o a un servicio de salud.
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
        posición GPS de los ómnibus. No contemplan feriados, desvíos ni cambios de último momento. Para que el servicio
        siga disponible para todos, hay un límite de cálculos por minuto desde una misma conexión.
      </p>

      <h3 id="me-gusta">Me gusta</h3>
      <p>
        Los “me gusta” son una función propia del sitio: muestran cuántas personas marcaron que les gusta cada playa, no
        sus condiciones. <strong>No son una calificación oficial</strong> ni dicen nada sobre la seguridad o la calidad del
        agua, y no se suman al puntaje de “¿A qué playa voy?”. Se cuentan por temporada y en total. Cada temporada cierra el 30 de abril, cuando termina la de guardavidas;
        lo que se vota desde el 1 de mayo suma a la temporada siguiente. El
        número se actualiza cada pocos minutos y puede no reflejar los últimos cambios. La página de{" "}
        <Link href="/favoritas">playas favoritas</Link> (y el podio de la página de inicio) ordena las playas por los me
        gusta de la temporada: es un ranking
        de preferencias de quienes usan el sitio, no una recomendación ni una evaluación de las playas.
      </p>

      <h3 id="foto">Foto de playa</h3>
      <p>
        El botón de cámara del detalle de cada playa (en celulares y tablets) le agrega a tu foto el nombre de la playa, el estado
        del cielo, la temperatura del aire, el viento, la bandera (en gris fuera de temporada o si no hay dato vigente) y
        la cantidad de me gusta de la playa en la temporada, junto con la marca del sitio y el
        hashtag #MontevideoPlayas. Son <strong>los mismos datos orientativos del sitio en ese momento, no un registro
        oficial</strong>: no sirven como constancia de las condiciones de la playa. La foto se arma en tu dispositivo y no
        la subimos ni la guardamos. Sos responsable de lo que fotografiás y compartís (por ejemplo, de contar con el
        consentimiento de las personas que aparecen).
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
      <p>
        Las preguntas frecuentes de la página de inicio son un resumen de estos términos en lenguaje simple. Ante
        cualquier diferencia, mandan estos términos y la información de las fuentes oficiales.
      </p>

      <h2 id="uso">Uso aceptable</h2>
      <p>
        No uses el sitio ni sus interfaces de datos de forma automatizada o masiva, ni intentes afectar su funcionamiento.
        No infles los “me gusta” con programas, cuentas múltiples ni ningún otro mecanismo: es un gesto por persona.
        No uses el formulario de contacto para enviar publicidad, spam ni contenido ofensivo.
        Podemos limitar el acceso, y anular o borrar me gusta, ante usos abusivos. Si necesitás los datos para otro proyecto, usá directamente las
        fuentes oficiales listadas abajo.
      </p>

      <h2 id="fuentes">Fuentes de datos y licencias</h2>
      <p>Agradecemos a quienes publican estos datos. Los derechos sobre cada dato pertenecen a su fuente.</p>
      <div className="not-prose mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
        El sitio usa además software libre: MapLibre GL JS (licencia BSD), three.js (licencia MIT) y los íconos de Phosphor (licencia MIT).
      </p>

      <h2 id="propiedad">Propiedad intelectual</h2>
      <p>
        El diseño, los textos y el código de {SITIO.nombre} pertenecen a {SITIO.responsable}. Los datos y las imágenes de
        terceros se usan según las licencias indicadas arriba.
      </p>

      <h2 id="privacidad">Privacidad</h2>
      <p>
        Cómo usamos tu ubicación, los datos del formulario de contacto, las estadísticas de visitas (Google Analytics) y otros datos está explicado en la <Link href="/privacidad">Política de privacidad</Link>.
      </p>

      <h2 id="cambios">Cambios y ley aplicable</h2>
      <p>
        Podemos actualizar estos términos; la versión vigente es la publicada en esta página. Se rigen por las leyes de la
        República Oriental del Uruguay. Consultas: <strong>{SITIO.contacto}</strong> o desde{" "}
        <Link href="/contacto">Contacto</Link>.
      </p>
    </PaginaLegal>
  );
}
