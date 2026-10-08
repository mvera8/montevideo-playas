// Producto: lo que se olvida antes de lanzar (pantallas de error y carga, legales, cookies, contacto,
// responsive y textos de relleno).
import fs from "node:fs";
import path from "node:path";
import { lineaDe, recorrer } from "../lib/util.mjs";

const EXT = ["tsx", "jsx", "js", "ts"];

/** Primer archivo de app/ cuya ruta (sin grupos ni extensión) coincida con `re`, p. ej. /terminos/page. */
function rutaApp(ctx, re) {
  if (!ctx.appDir) return null;
  return (
    recorrer(ctx.appDir, EXT.map((e) => `.${e}`))
      .map((abs) => ({ abs, ruta: "/" + ctx.rel(abs).replace(/^(src\/)?app\//, "").replace(/\([^)]*\)\//g, "") }))
      .find((a) => re.test(a.ruta))?.abs ?? null
  );
}

// Analytics que guardan cookies propias (los demás de reglas/analytics.mjs son cookieless).
const CON_COOKIES = [
  { nombre: "Google Analytics", uso: /<Google(Analytics|TagManager)\b|googletagmanager\.com/ },
  { nombre: "PostHog", uso: /posthog\.init\(|PostHogProvider/ },
  { nombre: "Microsoft Clarity", uso: /clarity\.ms/ },
  { nombre: "Meta Pixel", uso: /connect\.facebook\.net|fbq\(/ },
];

const RELLENO = [
  { re: /lorem ipsum/i, que: "Texto lorem ipsum" },
  { re: /\[(COMPLETAR|TODO|TBD)[^\]]*\]/i, que: "Dato sin completar" },
  { re: /\b[\w.+-]+@(example|ejemplo)\.(com|org)\b|tu@(email|correo)/i, que: "Correo de ejemplo" },
  { re: /\+?\b(099|098|09\d) ?(123 ?456|000 ?000)\b|555-\d{4}/, que: "Teléfono de ejemplo" },
  { re: /tu-dominio\.|example\.com/i, que: "Dominio de ejemplo" },
];

const reglas = [
  {
    id: "error-boundary",
    categoria: "Experiencia",
    titulo: "Pantalla de error propia",
    nivel: "warn",
    run(ctx) {
      if (!ctx.appDir) return [];
      const h = [];
      if (!ctx.enApp("error", EXT))
        h.push({
          msg: "No hay app/error.tsx: si algo falla en el servidor o el cliente se ve la pantalla genérica de Next, sin navegación ni forma de reintentar.",
          arreglo: "Creá app/error.tsx (\"use client\") con un mensaje claro, un botón que llame a `retry()` (`reset()` en Next < 16) y link al inicio.",
        });
      if (!ctx.enApp("global-error", EXT))
        h.push({
          msg: "No hay app/global-error.tsx (atrapa errores del layout raíz).",
          nivel: "info",
          arreglo: "Creá app/global-error.tsx (\"use client\") con su propio <html><body>.",
        });
      return h;
    },
  },
  {
    id: "estados-carga",
    categoria: "Experiencia",
    titulo: "Estados de carga",
    nivel: "info",
    run(ctx) {
      if (!ctx.appDir) return [];
      const paginas = recorrer(ctx.appDir, EXT.map((e) => `.${e}`)).filter((f) => /^page\.[jt]sx?$/.test(path.basename(f)));
      const h = [];
      for (const pagina of paginas) {
        const src = fs.readFileSync(pagina, "utf8");
        // Solo las páginas que esperan datos: async o con await en el componente.
        if (!/export\s+default\s+async\s+function/.test(src) || /<Suspense\b/.test(src)) continue;
        // Estáticas o ISR: se sirven ya generadas, el loading nunca se llegaría a ver.
        if (/export\s+const\s+revalidate\s*=\s*[1-9]|export\s+(async\s+)?function\s+generateStaticParams|dynamic\s*=\s*["']force-static/.test(src)) continue;
        let tiene = false;
        for (let d = path.dirname(pagina); d.startsWith(ctx.appDir) && !tiene; d = path.dirname(d))
          tiene = EXT.some((e) => fs.existsSync(path.join(d, `loading.${e}`)));
        if (!tiene)
          h.push({
            msg: "Página async sin loading.tsx ni <Suspense>: si los datos tardan, al navegar no se ve nada hasta que llegan.",
            archivo: ctx.rel(pagina),
            arreglo: "Agregá loading.tsx en esa carpeta (esqueleto o spinner), o envolvé la parte lenta en <Suspense fallback={...}>.",
          });
      }
      return h;
    },
  },
  {
    id: "responsive",
    categoria: "Experiencia",
    titulo: "Responsive en móvil",
    nivel: "warn",
    run(ctx) {
      const h = [];
      if (ctx.layoutRaiz) {
        const { src, rel } = ctx.layoutRaiz;
        const m = /userScalable\s*:\s*false|maximumScale\s*:\s*1\b/.exec(src);
        if (m)
          h.push({
            msg: "El viewport bloquea el zoom: la gente con baja visión no puede agrandar el texto.",
            archivo: rel,
            linea: lineaDe(src, m.index),
            arreglo: "Sacá userScalable/maximumScale del viewport.",
          });
      }
      // Anchos fijos grandes sin variante responsiva: desbordan en un celular de 360–390 px.
      // `min-width:`/`max-width:` no cuentan: son media queries (sizes, matchMedia).
      const ANCHO = /(?<![\w:-])(?:min-)?w-\[(\d{3,4})px\]|(?<![\w-])(?:minWidth|width)\s*:\s*["']?(\d{3,4})(?:px)?["']?/g;
      for (const a of ctx.codigo()) {
        if (!/\.[jt]sx$/.test(a.rel) || /(^|\/)(opengraph-image|twitter-image|icon|apple-icon)\.[jt]sx$/.test(a.rel)) continue;
        for (const m of a.src.matchAll(ANCHO)) {
          const px = Number(m[1] ?? m[2]);
          if (px < 480) continue;
          const linea = a.src.slice(a.src.lastIndexOf("\n", m.index) + 1, a.src.indexOf("\n", m.index));
          if (/max-w-|maxWidth|sm:|md:|lg:|@media/.test(linea)) continue;
          h.push({
            msg: `Ancho fijo de ${px}px: en un celular (≈375px) se sale de la pantalla.`,
            archivo: a.rel,
            linea: lineaDe(a.src, m.index),
            arreglo: "Usá w-full + max-w-[…] o aplicá el ancho desde sm:/md:.",
          });
        }
      }
      return h;
    },
  },
  {
    id: "legales",
    categoria: "Legal",
    titulo: "Términos y privacidad",
    nivel: "warn",
    run(ctx) {
      const h = [];
      if (!rutaApp(ctx, /\/(terminos|terms|condiciones|legal)[^/]*\/page\.[jt]sx?$/i))
        h.push({ msg: "No hay página de términos y condiciones.", arreglo: "Creá app/terminos/page.tsx (alcance del servicio, responsabilidad, fuentes y licencias) y enlazala en el pie." });
      if (!rutaApp(ctx, /\/(privacidad|privacy)[^/]*\/page\.[jt]sx?$/i))
        h.push({ msg: "No hay política de privacidad.", arreglo: "Creá app/privacidad/page.tsx: qué datos se guardan, para qué, quién los procesa y cómo pedir su baja." });
      return h;
    },
  },
  {
    id: "cookies",
    categoria: "Legal",
    titulo: "Aviso de cookies",
    nivel: "warn",
    run(ctx) {
      const codigo = ctx.codigo();
      const usa = CON_COOKIES.filter((p) => codigo.some((a) => p.uso.test(a.src))).map((p) => p.nombre);
      if (codigo.some((a) => /document\.cookie\s*=|cookies\(\)\.set\(/.test(a.src))) usa.push("cookies propias");
      if (!usa.length) return [];
      const privacidad = rutaApp(ctx, /\/(privacidad|privacy)[^/]*\/page\.[jt]sx?$/i);
      const h = [];
      if (!privacidad || !/cookie/i.test(fs.readFileSync(privacidad, "utf8")))
        h.push({
          msg: `El sitio usa cookies (${usa.join(", ")}) y la política de privacidad no las menciona.`,
          archivo: privacidad ? ctx.rel(privacidad) : undefined,
          arreglo: "Explicá qué cookies se guardan, para qué y cómo bloquearlas.",
        });
      if (!codigo.some((a) => /consent|CookieBanner|AvisoCookies|cookie-?banner/i.test(a.src)))
        h.push({
          msg: `No hay aviso ni consentimiento de cookies (${usa.join(", ")}).`,
          nivel: "info",
          arreglo: "Obligatorio si hay usuarios de la UE (GDPR); en otros países alcanza con informarlo en la política de privacidad. Alternativa: un analytics sin cookies (Vercel, Plausible, Umami).",
        });
      return h;
    },
  },
  {
    id: "contacto",
    categoria: "Legal",
    titulo: "Forma real de contacto",
    nivel: "warn",
    run(ctx) {
      if (rutaApp(ctx, /\/(contacto|contact)[^/]*\/page\.[jt]sx?$/i)) return [];
      if (ctx.codigo().some((a) => /mailto:|tel:|wa\.me\//.test(a.src))) return [];
      return [
        {
          msg: "No hay página de contacto ni links mailto:/tel:/WhatsApp: si algo anda mal, nadie te puede avisar.",
          arreglo: "Creá app/contacto/page.tsx con un formulario que mande mail (server action) o al menos un mailto: en el pie.",
        },
      ];
    },
  },
  {
    id: "textos-relleno",
    categoria: "Legal",
    titulo: "Sin datos de relleno",
    nivel: "warn",
    run(ctx) {
      const h = [];
      for (const a of ctx.codigo()) {
        for (const { re, que } of RELLENO) {
          const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
          for (const m of a.src.matchAll(g)) {
            // Comentarios: no se ven en el sitio.
            const inicioLinea = a.src.lastIndexOf("\n", m.index) + 1;
            if (/^\s*(\/\/|\*|\/\*)/.test(a.src.slice(inicioLinea, m.index))) continue;
            h.push({ msg: `${que}: "${m[0]}"`, archivo: a.rel, linea: lineaDe(a.src, m.index) });
          }
        }
      }
      return h;
    },
  },
];

export default reglas;
