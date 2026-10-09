import "server-only";
import { crearLimite } from "./limite";
import { SITIO } from "./sitio";

// Envío del formulario de /contacto por correo con Mailgun (https://www.mailgun.com).
//
// - API: POST https://api.mailgun.net/v3/<MAILGUN_DOMAIN>/messages (cuentas en la región UE:
//   https://api.eu.mailgun.net, con MAILGUN_REGION=eu). Autenticación HTTP Basic, usuario `api` y la
//   clave como contraseña. Cuerpo en form-urlencoded: from, to, subject, text, h:Reply-To. Responde
//   200 con { id, message } o 4xx con { message }. Un 401 "Forbidden" con la clave correcta suele
//   ser la región equivocada (la cuenta de Playas UY es de la región US: sin MAILGUN_REGION).
// - Plan gratis: 100 correos/día, un dominio de envío. La clave se crea en Dashboard → API Security
//   (o Sending → Domain settings → Sending API keys) y va en MAILGUN_API_KEY; el dominio en
//   MAILGUN_DOMAIN (.env.local y en el hosting).
// - Sin tarjeta cargada se usa el dominio sandbox (`sandboxXXXX.mailgun.org`), que SOLO envía a hasta
//   5 "Authorized Recipients": agregar SITIO.contacto ahí (Sending → Domains → el sandbox → Authorized
//   Recipients) y aceptar el correo de verificación. Si no, Mailgun responde 403. Con dominio propio
//   verificado, cambiar MAILGUN_DOMAIN y se puede enviar a cualquier dirección.
// - Dominio propio: en Mailgun se usa el subdominio `mg.playas.uy` (lo recomienda Mailgun y deja libre
//   el MX de playas.uy para recibir). Registros DNS (panel de ANTEL, NS anteldata.com.uy): los TXT de
//   SPF y DKIM y el CNAME de tracking que muestra Mailgun para mg.playas.uy, y `_dmarc.playas.uy` TXT
//   `v=DMARC1; p=none`. El remitente sale como contacto@playas.uy (sin el `mg.`): DMARC en modo
//   relajado acepta la firma DKIM de mg.playas.uy para playas.uy.
// - Recibir en contacto@playas.uy NO pasa por acá: lo hace un reenvío (MX de playas.uy, ver README).
// - Responder: el correo de quien escribe va en `h:Reply-To`, así "Responder" le contesta directo.
// - No se guarda nada en el servidor: el mensaje solo queda en la bandeja de entrada y en los
//   registros de Mailgun (Dashboard → Send → Logs, retención corta en el plan gratis).
// - Validar: completar el formulario en /contacto y ver que llegue; o
//   curl -s --user "api:$MAILGUN_API_KEY" https://api.mailgun.net/v3/$MAILGUN_DOMAIN/messages
//     -F from="Playas UY <contacto@$MAILGUN_DOMAIN>" -F to=<SITIO.contacto> -F subject=prueba -F text=hola
const API = process.env.MAILGUN_REGION === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";

export const LIMITES = { nombre: 100, correo: 200, mensaje: 5000 } as const;

/** El formulario solo funciona con un correo de destino real y la clave y el dominio de Mailgun. */
export function contactoActivo() {
  return SITIO.contacto.includes("@") && Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

export async function enviarContacto({ nombre, correo, mensaje }: { nombre: string; correo: string; mensaje: string }) {
  const dominio = process.env.MAILGUN_DOMAIN!;
  // Con un subdominio de envío (mg.playas.uy) el remitente usa el dominio principal; con el sandbox, el sandbox.
  const remitente = `contacto@${dominio.replace(/^mg\./, "")}`;
  const res = await fetch(`${API}/v3/${dominio}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64")}` },
    body: new URLSearchParams({
      from: `${SITIO.nombre} ${SITIO.alcance} <${remitente}>`,
      to: SITIO.contacto,
      "h:Reply-To": correo,
      subject: `Contacto de ${nombre} · ${SITIO.nombre}`,
      text: `${mensaje}\n\n—\n${nombre} <${correo}>\nEnviado desde el formulario de contacto de ${SITIO.nombre}.`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Mailgun ${res.status}: ${await res.text()}`);
}

// Tope por IP: 5 mensajes por hora (ver src/lib/limite.ts). Si llega spam en serio, sumar Turnstile al formulario.
export const superaLimite = crearLimite({ max: 5, ventanaMs: 60 * 60 * 1000 });
