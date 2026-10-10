import type { Metadata } from "next";
import Link from "next/link";
import PaginaLegal, { Destacado } from "@/components/legal/PaginaLegal";
import { SITIO } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Qué datos usa Playas UY, para qué y qué no hacemos con ellos.",
  alternates: { canonical: "/privacidad" },
};

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad" bajada="Qué datos usa el sitio, para qué, y qué no hacemos con ellos.">
      <Destacado>
        <p className="font-semibold text-slate-900">En resumen</p>
        <ul className="mt-2">
          <li>No tenés que crear una cuenta ni darnos tu nombre o correo (solo si nos escribís por el formulario de contacto).</li>
          <li>
            Si das <strong>“me gusta”</strong> a una playa, se crea una cuenta anónima en tu navegador y guardamos qué playas
            te gustan. Nadie más ve quién dio cada me gusta: solo se muestra el total.
          </li>
          <li>
            Usamos <strong>Google Analytics</strong> para contar visitas y ver qué páginas se usan, con cookies de
            medición. No usamos publicidad ni vendemos datos.
          </li>
          <li>
            Tu <strong>ubicación</strong> se usa solo si la pedís, para calcular cómo llegar a una playa.{" "}
            <strong>No la guardamos</strong> ni la asociamos a vos.
          </li>
          <li>Tus preferencias (panel abierto o cerrado, estilo del mapa) quedan solo en tu dispositivo.</li>
        </ul>
      </Destacado>

      <h2 id="responsable">Quién es responsable</h2>
      <p>
        El responsable del sitio y del tratamiento de datos es <strong>{SITIO.responsable}</strong>. Podés escribirnos a{" "}
        <strong>{SITIO.contacto}</strong> por cualquier consulta sobre esta política.
      </p>
      <p>
        {SITIO.nombre} es un servicio independiente: no pertenece a la Intendencia de Montevideo, al servicio de guardavidas
        ni a ningún organismo público (ver <Link href="/terminos">Términos de uso</Link>).
      </p>

      <h2 id="ubicacion">Tu ubicación</h2>
      <p>Usamos tu ubicación únicamente cuando vos lo pedís, de estas formas:</p>
      <ul>
        <li>
          <strong>“Usar mi ubicación” y “Sumar mi viaje”</strong>: tu navegador te pide permiso. Si aceptás, enviamos tu
          ubicación a nuestro servidor para calcular los recorridos en ómnibus y el tiempo de viaje a cada playa. Para
          evitar abusos, tu dirección IP se usa un rato para limitar cuántos cálculos se piden por minuto, y luego se
          descarta; no se guarda junto con tu ubicación.
        </li>
        <li>
          <strong>“Elegir en el mapa”</strong>: se usa el punto que tocás, de la misma manera.
        </li>
        <li>
          <strong>El botón de ubicación del mapa</strong> solo muestra dónde estás en tu pantalla; esa ubicación no se envía
          a nuestro servidor.
        </li>
      </ul>
      <p>Cómo la cuidamos:</p>
      <ul>
        <li>Antes de enviarla, la redondeamos a unos 100 metros: alcanza para planificar el viaje.</li>
        <li>
          Viaja en el cuerpo de la solicitud y no en la dirección web, para que no quede en historiales ni en registros de
          acceso.
        </li>
        <li>Se usa para calcular la respuesta y se descarta. No la guardamos, no armamos historiales ni perfiles.</li>
        <li>Podés retirar el permiso cuando quieras desde la configuración de tu navegador.</li>
      </ul>

      <h2 id="me-gusta">Me gusta</h2>
      <p>
        La primera vez que tocás “Me gusta”, se crea una <strong>cuenta anónima</strong>: no te pedimos nombre, correo ni
        ningún dato. Lo que guardamos:
      </p>
      <ul>
        <li>un identificador aleatorio de esa cuenta y la fecha en que se creó;</li>
        <li>a qué playas les diste me gusta, en qué temporada y cuándo.</li>
      </ul>
      <p>
        Para qué: contar un solo me gusta por persona y mostrarte cuáles marcaste. <strong>Solo publicamos el total por
        playa</strong>; nunca mostramos quién dio cada me gusta ni lo usamos para hacer perfiles.
      </p>
      <p>
        Dónde: en <strong>Supabase</strong>, el proveedor de base de datos y cuentas del sitio, con servidores en Estados
        Unidos. Como en cualquier conexión, Supabase recibe tu dirección IP al crear la cuenta y al guardar un me gusta, y
        puede registrarla por seguridad (por ejemplo, para limitar abusos) según{" "}
        <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">
          su política
        </a>
        . La base es tu consentimiento, que das al tocar “Me gusta”.
      </p>
      <p>
        Cuánto tiempo: mientras exista la cuenta. Podés sacar un me gusta tocándolo de nuevo. Si borrás los datos del sitio
        en tu navegador, perdés el acceso a la cuenta (no se puede recuperar porque es anónima); para borrarla por
        completo, escribinos a <strong>{SITIO.contacto}</strong>. Podemos borrar cuentas anónimas que no se usen hace más
        de un año.
      </p>

      <h2 id="contacto">Formulario de contacto</h2>
      <p>
        Si nos escribís desde <Link href="/contacto">Contacto</Link>, usamos tu <strong>nombre, correo y mensaje</strong>{" "}
        solo para leerlo y responderte. La base es tu consentimiento, que das al enviar el formulario.
      </p>
      <p>
        El mensaje no se guarda en nuestro servidor: se envía por correo a <strong>{SITIO.contacto}</strong> a través de{" "}
        <a href="https://www.mailgun.com/legal/privacy-policy/" target="_blank" rel="noreferrer">
          Mailgun
        </a>
        , un servicio de envío de correos con servidores en Estados Unidos, que guarda un registro de los envíos por un
        tiempo limitado. Para evitar abusos, tu dirección IP se usa un rato para limitar cuántos mensajes se envían
        seguidos, y luego se descarta. Conservamos el correo mientras haga falta para responderte; podés pedirnos que lo
        borremos.
      </p>

      <h2 id="foto">Foto de playa</h2>
      <p>
        Si usás el botón de cámara de una playa, la foto se procesa <strong>solo en tu dispositivo</strong>: le agregamos
        los datos de la playa en tu navegador y no la enviamos a nuestro servidor ni a terceros, no la guardamos y no
        registramos que la sacaste. Al rearmarla se borran los datos ocultos de la foto original (EXIF), incluida la
        ubicación GPS que guardan muchos celulares. Si la compartís, lo hacés con la aplicación que elijas, bajo sus
        propias condiciones.
      </p>

      <h2 id="dispositivo">Lo que queda en tu dispositivo</h2>
      <p>
        Guardamos dos preferencias en el almacenamiento local de tu navegador (no son cookies y no se envían a ningún
        lado): si dejaste el panel lateral abierto o cerrado, y el estilo del mapa que elegiste. Podés borrarlas borrando
        los datos del sitio en tu navegador.
      </p>
      <p>
        Si diste me gusta, también queda ahí la sesión de tu cuenta anónima (una clave que se envía a Supabase solo para
        guardar o leer tus me gusta).
      </p>

      <h2 id="analitica">Estadísticas de uso (Google Analytics)</h2>
      <p>
        Para saber cuántas personas usan el sitio, qué páginas visitan y desde qué tipo de dispositivo, usamos{" "}
        <strong>Google Analytics 4</strong>, de Google LLC. Tu navegador le envía datos como las páginas que visitás, la
        página de la que llegaste, el tipo de dispositivo y navegador, el idioma, la ubicación aproximada (país y
        ciudad, deducida de tu IP) y un identificador aleatorio que se guarda en cookies (<code>_ga</code> y{" "}
        <code>_ga_*</code>, que duran hasta 2 años). Google Analytics 4 no guarda tu dirección IP completa.
      </p>
      <p>
        Usamos esos datos solo en forma de estadísticas agregadas para mejorar el sitio: no los cruzamos con otros datos,
        no identificamos a nadie y no tenemos activadas las funciones de publicidad ni de compartir datos con otros
        productos de Google. Los servidores de Google pueden estar fuera de Uruguay. Más información en la{" "}
        <a href="https://policies.google.com/technologies/partner-sites?hl=es" target="_blank" rel="noreferrer">
          explicación de Google
        </a>
        .
      </p>
      <p>
        Para no ser contado podés borrar o bloquear las cookies del sitio en tu navegador, usar un bloqueador de
        contenido o instalar el{" "}
        <a href="https://tools.google.com/dlpage/gaoptout?hl=es" target="_blank" rel="noreferrer">
          complemento de inhabilitación de Google Analytics
        </a>
        . El sitio funciona igual.
      </p>

      <h2 id="tecnicos">Datos técnicos</h2>
      <p>
        Como cualquier sitio web, al visitarlo tu navegador envía datos técnicos como tu dirección IP, el tipo de
        navegador y las páginas que pedís. El sitio se aloja en <strong>{SITIO.hosting}</strong>, que puede registrarlos
        por seguridad y funcionamiento según su propia política, y cuyos servidores pueden estar fuera de Uruguay. No
        usamos esos datos para identificarte ni para seguir tu actividad.
      </p>
      <p>
        <strong>Registro de errores:</strong> si una página falla, guardamos un registro técnico para poder arreglarlo:
        el mensaje del error, la página donde ocurrió (sin los parámetros de la dirección), en qué parte del sitio pasó y
        el tipo de navegador y sistema operativo. <strong>No guardamos tu dirección IP</strong> ni nada que te identifique o
        que se asocie a tu cuenta anónima. Se guarda en Supabase (ver <Link href="#me-gusta">Me gusta</Link>), solo
        podemos verlo nosotros y se borra a los 30 días. La base es nuestro interés legítimo en que el sitio funcione.
      </p>

      <h2 id="terceros">Servicios de terceros</h2>
      <p>
        Para dibujar el mapa, tu navegador descarga las imágenes y tipografías del mapa directamente de{" "}
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>
        , que por eso recibe tu dirección IP y la zona del mapa que estás mirando. OpenFreeMap no usa cookies ni requiere
        registro.
      </p>
      <p>
        Las estadísticas de visitas las procesa Google, como se explica en{" "}
        <Link href="#analitica">Estadísticas de uso</Link>. Los me gusta y el registro de errores se guardan en Supabase, como se explica en <Link href="#me-gusta">Me gusta</Link> y <Link href="#tecnicos">Datos técnicos</Link>. Los mensajes de
        contacto se envían con Mailgun, como se explica en <Link href="#contacto">Formulario de contacto</Link>.
      </p>
      <p>
        El clima, las alertas meteorológicas, los datos de playas, la calidad del agua, las aguas vivas reportadas, los
        baños y bebederos y los horarios de ómnibus los consultamos desde nuestro servidor (MET Norway, NOAA, Inumet,
        Intendencia de Montevideo, iNaturalist y OpenStreetMap), sin enviarles ningún dato tuyo. De las observaciones
        de iNaturalist, que son públicas, mostramos solo la especie, la fecha y el lugar aproximado, sin el nombre de
        quien la cargó; si abrís el enlace a una observación, pasás al sitio de iNaturalist y rige su política de
        privacidad.
      </p>

      <h2 id="finalidad">Para qué usamos los datos</h2>
      <p>
        Solo para mostrarte la información que pediste, contar los me gusta, responder tus mensajes, medir en forma
        agregada cómo se usa el sitio y arreglar los errores. No vendemos datos personales, no mostramos publicidad y no hacemos perfiles. La base para usar tu ubicación es tu consentimiento,
        que das al aceptar el permiso del navegador y podés retirar en cualquier momento; la de los me gusta, también tu
        consentimiento, que das al tocar el botón.
      </p>

      <h2 id="derechos">Tus derechos</h2>
      <p>
        Según la Ley N.º 18.331 de Protección de Datos Personales, tenés derecho a acceder, rectificar, actualizar, incluir
        o suprimir tus datos personales. No guardamos tu ubicación ni datos que te identifiquen; si diste me gusta, la cuenta
        es anónima y para encontrarla necesitamos su identificador. Escribinos a <strong>{SITIO.contacto}</strong>.
      </p>
      <p>
        Si considerás que no se respetaron tus derechos, podés presentar una denuncia ante la{" "}
        <a href="https://www.gub.uy/unidad-reguladora-control-datos-personales" target="_blank" rel="noreferrer">
          Unidad Reguladora y de Control de Datos Personales (URCDP)
        </a>
        .
      </p>

      <h2 id="menores">Menores de edad</h2>
      <p>
        El sitio no está dirigido especialmente a menores y no pide datos personales. Si sos menor, pedile a un adulto
        responsable que te acompañe al usar tu ubicación.
      </p>

      <h2 id="cambios">Cambios en esta política</h2>
      <p>
        Si cambiamos cómo usamos los datos, vamos a actualizar esta página y la fecha de “Última actualización”. Si el
        cambio es importante, lo vamos a avisar en el sitio.
      </p>
    </PaginaLegal>
  );
}
