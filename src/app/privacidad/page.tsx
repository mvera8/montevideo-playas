import type { Metadata } from "next";
import Link from "next/link";
import PaginaLegal, { Destacado } from "@/components/legal/PaginaLegal";
import { SITIO } from "@/lib/sitio";

export const metadata: Metadata = {
  title: `Privacidad · ${SITIO.nombre}`,
  description: "Qué datos usa Playas UY, para qué y qué no hacemos con ellos.",
};

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad" bajada="Qué datos usa el sitio, para qué, y qué no hacemos con ellos.">
      <Destacado>
        <p className="font-semibold text-slate-900 dark:text-white">En resumen</p>
        <ul className="mt-2">
          <li>No tenés que crear una cuenta ni darnos tu nombre o correo.</li>
          <li>No usamos cookies, publicidad ni herramientas de analítica o seguimiento.</li>
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
        {SITIO.nombre} es un servicio independiente: no pertenece a la Intendencia de Montevideo ni a ningún organismo
        público (ver <Link href="/terminos">Términos de uso</Link>).
      </p>

      <h2 id="ubicacion">Tu ubicación</h2>
      <p>Usamos tu ubicación únicamente cuando vos lo pedís, de estas formas:</p>
      <ul>
        <li>
          <strong>“Usar mi ubicación” y “Sumar mi viaje”</strong>: tu navegador te pide permiso. Si aceptás, enviamos tu
          ubicación a nuestro servidor para calcular los recorridos en ómnibus y el tiempo de viaje a cada playa.
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

      <h2 id="dispositivo">Lo que queda en tu dispositivo</h2>
      <p>
        Guardamos dos preferencias en el almacenamiento local de tu navegador (no son cookies y no se envían a ningún
        lado): si dejaste el panel lateral abierto o cerrado, y el estilo del mapa que elegiste. Podés borrarlas borrando
        los datos del sitio en tu navegador.
      </p>

      <h2 id="tecnicos">Datos técnicos</h2>
      <p>
        Como cualquier sitio web, al visitarlo tu navegador envía datos técnicos como tu dirección IP, el tipo de
        navegador y las páginas que pedís. El sitio se aloja en <strong>{SITIO.hosting}</strong>, que puede registrarlos
        por seguridad y funcionamiento según su propia política, y cuyos servidores pueden estar fuera de Uruguay. No
        usamos esos datos para identificarte ni para seguir tu actividad.
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
        El clima, los datos de playas, la calidad del agua, los baños y bebederos y los horarios de ómnibus los
        consultamos desde nuestro servidor (Open-Meteo, Intendencia de Montevideo y OpenStreetMap), sin enviarles ningún
        dato tuyo.
      </p>

      <h2 id="finalidad">Para qué usamos los datos</h2>
      <p>
        Solo para mostrarte la información que pediste. No vendemos ni compartimos datos personales, no mostramos
        publicidad y no hacemos perfiles. La base para usar tu ubicación es tu consentimiento, que das al aceptar el
        permiso del navegador y podés retirar en cualquier momento.
      </p>

      <h2 id="derechos">Tus derechos</h2>
      <p>
        Según la Ley N.º 18.331 de Protección de Datos Personales, tenés derecho a acceder, rectificar, actualizar, incluir
        o suprimir tus datos personales. Como no guardamos tu ubicación ni otros datos que te identifiquen, normalmente no
        vamos a tener información tuya para entregar; igual podés escribirnos a <strong>{SITIO.contacto}</strong>.
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
