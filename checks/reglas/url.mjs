import { gzipSync } from "node:zlib";
import { PROVEEDORES } from "./analytics.mjs";

// Modo --url: revisa el HTML que realmente sirve el sitio (next start, preview o producción).
// Atrapa lo que el análisis estático no ve: títulos armados con variables, metadata dinámica, links rotos.

const meta = (html, clave) => {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const nombre = /\b(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (nombre?.toLowerCase() === clave) return /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
  }
  return null;
};
const link = (html, rel) => {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const rels = /\brel\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1].toLowerCase().split(/\s+/) ?? [];
    if (rels.includes(rel)) return /\bhref\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1] ?? null;
  }
  return null;
};
const titulo = (html) => /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1].trim() ?? null;
const decodificar = (s) => s?.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');

async function pedir(url, { redirect = "follow" } = {}) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { redirect, signal: AbortSignal.timeout(15000) });
    const ms = Math.round(performance.now() - t0); // hasta el primer byte (headers)
    return { status: r.status, tipo: r.headers.get("content-type") ?? "", headers: r.headers, ms, texto: await r.text() };
  } catch (e) {
    return { status: 0, tipo: "", headers: new Headers(), ms: 0, texto: "", error: e.cause?.code ?? e.message };
  }
}

const esLocal = (base) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(base);

/** Páginas a revisar: las pasadas por --paginas, o las del sitemap, o solo la home. */
export async function descubrirPaginas(base, { paginas, max = 20 }) {
  if (paginas?.length) return paginas;
  const sm = await pedir(new URL("/sitemap.xml", base));
  const rutas = [...sm.texto.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => {
    const u = new URL(m[1]);
    return u.pathname + u.search;
  });
  return rutas.length ? [...new Set(rutas)].slice(0, max) : ["/"];
}

export async function crearContextoUrl(base, rutas) {
  const paginas = await Promise.all(rutas.map(async (ruta) => ({ ruta, ...(await pedir(new URL(ruta, base))) })));
  return { base, paginas, pedir: (r, opts) => pedir(new URL(r, base), opts) };
}

const porPagina = (ctx, fn) => ctx.paginas.filter((p) => p.status === 200).flatMap((p) => fn(p).map((h) => ({ archivo: p.ruta, ...h })));

const reglas = [
  {
    id: "url-estado",
    categoria: "Sitio en vivo",
    titulo: "Páginas responden 200",
    nivel: "error",
    run: (ctx) =>
      ctx.paginas.filter((p) => p.status !== 200).map((p) => ({ archivo: p.ruta, msg: p.error ? `No responde (${p.error}).` : `Responde ${p.status}.` })),
  },
  {
    id: "url-titulo",
    categoria: "Sitio en vivo",
    titulo: "<title> y meta description",
    nivel: "error",
    run: (ctx) =>
      porPagina(ctx, (p) => {
        const h = [];
        const t = decodificar(titulo(p.texto));
        const d = decodificar(meta(p.texto, "description"));
        if (!t) h.push({ msg: "Sin <title>." });
        else if (t.length < 10 || t.length > 60) h.push({ msg: `Título de ${t.length} caracteres (ideal 10–60): "${t}"`, nivel: "warn" });
        if (d == null) h.push({ msg: "Sin meta description." });
        else if (d.length < 50 || d.length > 160) h.push({ msg: `Descripción de ${d.length} caracteres (ideal 50–160).`, nivel: "warn" });
        return h;
      }),
  },
  {
    id: "url-duplicados",
    categoria: "Sitio en vivo",
    titulo: "Títulos y descripciones únicos",
    nivel: "warn",
    run(ctx) {
      const h = [];
      for (const [nombre, sacar] of [
        ["Mismo título", (p) => titulo(p.texto)],
        ["Misma descripción", (p) => meta(p.texto, "description")],
      ]) {
        const grupos = new Map();
        for (const p of ctx.paginas.filter((p) => p.status === 200)) {
          const v = sacar(p);
          if (v) grupos.set(v, [...(grupos.get(v) ?? []), p.ruta]);
        }
        for (const [v, rutas] of grupos)
          if (rutas.length > 1) h.push({ msg: `${nombre} en ${rutas.join(", ")}: "${decodificar(v).slice(0, 70)}"` });
      }
      return h;
    },
  },
  {
    id: "url-open-graph",
    categoria: "Sitio en vivo",
    titulo: "Open Graph y Twitter card",
    nivel: "warn",
    run: (ctx) =>
      porPagina(ctx, (p) => {
        const faltan = ["og:title", "og:description", "og:image", "twitter:card"].filter((k) => meta(p.texto, k) == null);
        const h = faltan.length ? [{ msg: `Faltan: ${faltan.join(", ")}.` }] : [];
        const img = meta(p.texto, "og:image");
        if (img && !/^https?:\/\//.test(img)) h.push({ msg: `og:image es relativa (${img}): definí metadataBase.`, nivel: "error" });
        if (img && /localhost|127\.0\.0\.1/.test(img) && !/localhost|127\.0\.0\.1/.test(ctx.base))
          h.push({ msg: `og:image apunta a localhost: falta metadataBase.`, nivel: "error" });
        if (!link(p.texto, "canonical")) h.push({ msg: "Sin <link rel=\"canonical\"> (alternates.canonical en metadata).", nivel: "info" });
        return h;
      }),
  },
  {
    id: "url-h1",
    categoria: "Sitio en vivo",
    titulo: "Un solo <h1> por página",
    nivel: "warn",
    run: (ctx) =>
      porPagina(ctx, (p) => {
        const n = (p.texto.match(/<h1\b/gi) ?? []).length;
        return n === 1 ? [] : [{ msg: n ? `Tiene ${n} <h1>.` : "No tiene <h1>." }];
      }),
  },
  {
    id: "url-alt",
    categoria: "Sitio en vivo",
    titulo: "Imágenes renderizadas con alt",
    nivel: "error",
    run: (ctx) =>
      porPagina(ctx, (p) => {
        const sin = [...p.texto.matchAll(/<img\b[^>]*>/gi)].filter((m) => !/\balt\s*=/i.test(m[0]));
        return sin.length ? [{ msg: `${sin.length} <img> sin alt (ej: ${/src="([^"]+)"/.exec(sin[0][0])?.[1] ?? "?"}).` }] : [];
      }),
  },
  {
    id: "url-iconos",
    categoria: "Sitio en vivo",
    titulo: "Favicon, apple-touch-icon y manifest accesibles",
    nivel: "error",
    async run(ctx) {
      const home = ctx.paginas.find((p) => p.status === 200);
      if (!home) return [];
      const h = [];
      if (!/<html\b[^>]*\blang=/i.test(home.texto)) h.push({ msg: "<html> sin lang." });
      if (!meta(home.texto, "viewport")) h.push({ msg: "Sin meta viewport." });
      for (const [rel, nombre] of [
        ["icon", "favicon"],
        ["apple-touch-icon", "apple-touch-icon (inicio del iPhone)"],
        ["manifest", "manifest"],
      ]) {
        const href = link(home.texto, rel);
        if (!href) {
          h.push({ msg: `No hay <link rel="${rel}"> (${nombre}).`, nivel: rel === "manifest" ? "warn" : "error" });
          continue;
        }
        const r = await ctx.pedir(decodificar(href));
        if (r.status !== 200) h.push({ msg: `${nombre} (${href}) responde ${r.status || r.error}.` });
        else if (rel === "manifest") {
          try {
            const m = JSON.parse(r.texto);
            const tams = (m.icons ?? []).map((i) => i.sizes).join(" ");
            for (const t of ["192x192", "512x512"]) if (!tams.includes(t)) h.push({ msg: `El manifest no tiene ícono ${t}.`, nivel: "warn" });
          } catch {
            h.push({ msg: "El manifest no es JSON válido." });
          }
        }
      }
      const img = meta(home.texto, "og:image");
      if (img) {
        const r = await ctx.pedir(decodificar(img));
        if (r.status !== 200) h.push({ msg: `og:image (${img}) responde ${r.status || r.error}.` });
      }
      return h.map((x) => ({ archivo: home.ruta, ...x }));
    },
  },
  {
    id: "url-404",
    categoria: "Sitio en vivo",
    titulo: "404 real y con la navegación del sitio",
    nivel: "warn",
    async run(ctx) {
      const r = await ctx.pedir(`/no-existe-${Date.now().toString(36)}`);
      if (r.status === 200) return [{ msg: "Una ruta inexistente responde 200 (soft 404): Google la indexa como página válida.", nivel: "error" }];
      if (r.status !== 404) return [{ msg: `Una ruta inexistente responde ${r.status || r.error} en vez de 404.` }];
      if (/This page could not be found/i.test(r.texto))
        return [{ msg: "El 404 es el genérico de Next (en inglés y sin navegación).", arreglo: "Creá app/not-found.tsx con un mensaje y link al inicio." }];
      return [];
    },
  },
  {
    id: "url-responsive",
    categoria: "Sitio en vivo",
    titulo: "Viewport para móvil",
    nivel: "error",
    run: (ctx) =>
      porPagina(ctx, (p) => {
        const v = meta(p.texto, "viewport");
        if (v == null) return [{ msg: "Sin meta viewport: en el celular se ve como escritorio achicado." }];
        const h = [];
        if (!/width\s*=\s*device-width/i.test(v)) h.push({ msg: `El viewport no tiene width=device-width ("${v}").` });
        if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(v))
          h.push({ msg: "El viewport bloquea el zoom (accesibilidad).", nivel: "warn" });
        return h;
      }).slice(0, 1),
  },
  {
    id: "url-headers",
    categoria: "Sitio en vivo",
    titulo: "Headers de seguridad servidos",
    nivel: "warn",
    run(ctx) {
      const home = ctx.paginas.find((p) => p.status === 200);
      if (!home) return [];
      const hd = home.headers;
      const h = [];
      const faltan = ["x-content-type-options", "referrer-policy", "permissions-policy"].filter((k) => !hd.has(k));
      if (!hd.has("x-frame-options") && !/frame-ancestors/i.test(hd.get("content-security-policy") ?? "")) faltan.push("x-frame-options (o frame-ancestors)");
      if (faltan.length) h.push({ msg: `La respuesta no trae: ${faltan.join(", ")}.`, arreglo: "headers() en next.config (ver la regla headers-seguridad)." });
      if (ctx.base.startsWith("https:") && !hd.has("strict-transport-security"))
        h.push({ msg: "Sin Strict-Transport-Security (HSTS): la primera visita por http:// se puede interceptar.", arreglo: '{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" } (Vercel ya lo pone en sus dominios).' });
      if (hd.get("x-powered-by")) h.push({ msg: `Expone X-Powered-By: ${hd.get("x-powered-by")}.`, nivel: "info", arreglo: "poweredByHeader: false en next.config." });
      return h.map((x) => ({ archivo: home.ruta, ...x }));
    },
  },
  {
    id: "url-https",
    categoria: "Sitio en vivo",
    titulo: "HTTPS forzado y sin contenido mixto",
    nivel: "error",
    async run(ctx) {
      const h = [];
      if (ctx.base.startsWith("https:")) {
        const http = await pedir(ctx.base.replace(/^https:/, "http:"), { redirect: "manual" });
        const destino = http.headers.get("location") ?? "";
        if (http.status && !(http.status >= 300 && http.status < 400 && destino.startsWith("https:")))
          h.push({ msg: `http:// responde ${http.status} sin redirigir a https://.`, arreglo: "En Vercel es automático; en otro hosting, redirigí todo http a https (301/308)." });
      }
      // Recursos cargados por http:// en una página https: el navegador los bloquea.
      h.push(
        ...porPagina(ctx, (p) => {
          const mixtos = [...p.texto.matchAll(/<(?:img|script|link|iframe|source|video|audio)\b[^>]*\b(?:src|href|srcset)\s*=\s*["'](http:\/\/(?!localhost|127\.0\.0\.1)[^"']+)/gi)].map((m) => m[1]);
          return mixtos.length ? [{ msg: `${mixtos.length} recurso(s) por http:// (ej: ${mixtos[0].slice(0, 70)}): el navegador los bloquea en https.`, nivel: "warn" }] : [];
        }),
      );
      return h;
    },
  },
  {
    id: "url-enlaces",
    categoria: "Sitio en vivo",
    titulo: "Links internos sin romper",
    nivel: "error",
    async run(ctx) {
      // Links internos que aparecen en las páginas revisadas (máx. 50 distintos).
      const revisadas = new Set(ctx.paginas.map((p) => p.ruta));
      const origen = new Map();
      for (const p of ctx.paginas.filter((p) => p.status === 200))
        for (const m of p.texto.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)/gi)) {
          let u;
          try {
            u = new URL(decodificar(m[1]), new URL(p.ruta, ctx.base));
          } catch {
            continue;
          }
          if (u.origin !== new URL(ctx.base).origin || revisadas.has(u.pathname + u.search)) continue;
          if (!origen.has(u.pathname + u.search)) origen.set(u.pathname + u.search, p.ruta);
        }
      const h = [];
      const lista = [...origen].slice(0, 50);
      const res = await Promise.all(lista.map(([ruta]) => ctx.pedir(ruta)));
      lista.forEach(([ruta, desde], i) => {
        const r = res[i];
        if (r.status >= 400 || r.status === 0) h.push({ archivo: desde, msg: `Link a ${ruta} responde ${r.status || r.error}.` });
      });
      return h;
    },
  },
  {
    id: "url-velocidad",
    categoria: "Sitio en vivo",
    titulo: "Respuesta rápida y HTML liviano",
    nivel: "warn",
    run(ctx) {
      // En localhost con `next dev` todo es lento (compila al pedir): solo vale con next start o producción.
      const dev = ctx.paginas.some((p) => /__nextDevClient|next-devtools|webpack-hmr|turbopack-hmr|\/_next\/static\/chunks\/[^"']*hmr/i.test(p.texto));
      if (dev) return [{ msg: "El sitio corre con next dev: los tiempos no son reales. Para medir: npm run build && npm start.", nivel: "info" }];
      return porPagina(ctx, (p) => {
        const h = [];
        // Lo que viaja es el HTML comprimido (gzip/brotli): medir el texto crudo exagera 10–15 veces.
        const kb = Math.round(gzipSync(p.texto).length / 1024);
        const crudoKb = Math.round(Buffer.byteLength(p.texto) / 1024);
        if (p.ms > (esLocal(ctx.base) ? 800 : 1500))
          h.push({ msg: `Tardó ${p.ms} ms en responder.`, arreglo: "Revisá consultas lentas o en cadena (Promise.all), cacheá lo que no cambia ('use cache' / revalidate) y mostrá loading.tsx." });
        if (kb > 100)
          h.push({ msg: `El HTML pesa ${kb} KB comprimido (${crudoKb} KB sin comprimir; ideal < 100 KB).`, nivel: kb > 200 ? "warn" : "info", arreglo: "Suele ser por pasar datos enormes a componentes cliente (mandá solo los campos que usan) o por listas larguísimas sin paginar." });
        return h;
      });
    },
  },
  {
    id: "url-analytics",
    categoria: "Sitio en vivo",
    titulo: "Analytics cargando de verdad",
    nivel: "error",
    async run(ctx) {
      const home = ctx.paginas.find((p) => p.status === 200);
      if (!home || !ctx.estatico) return [];
      const montados = PROVEEDORES.filter((p) => ctx.estatico.codigo().some((a) => p.uso.test(a.src))).map((p) => p.nombre);
      const h = [];
      if (montados.some((n) => n.startsWith("Google Analytics"))) {
        // El ID tiene que llegar al HTML (gtag/js?id=G-… o en el payload de React): si la variable
        // no estaba definida en el build, el componente no se renderiza y no mide nada.
        const id = /googletagmanager\.com\/gtag\/js\?id=((?:G|GT|AW|UA)-[\w-]+)|"gaId":"((?:G|GT)-[\w-]+)"|\b(G-[A-Z0-9]{6,12})\b/.exec(home.texto);
        if (!id)
          h.push({
            msg: "Google Analytics está en el código pero la página no trae ningún ID (G-…): no mide nada.",
            arreglo: "Definí NEXT_PUBLIC_GA_ID en el hosting (Production) y volvé a hacer el deploy: las NEXT_PUBLIC_ se fijan en el build.",
          });
      }
      if (montados.includes("Vercel Analytics") && !esLocal(ctx.base)) {
        const r = await ctx.pedir("/_vercel/insights/script.js");
        if (r.status !== 200) h.push({ msg: "Vercel Analytics está en el código pero no está activado en el proyecto (/_vercel/insights/script.js da " + (r.status || r.error) + ").", arreglo: "Vercel → proyecto → Analytics → Enable." });
      }
      return h.map((x) => ({ archivo: home.ruta, ...x }));
    },
  },
  {
    id: "url-robots-sitemap",
    categoria: "Sitio en vivo",
    titulo: "robots.txt y sitemap.xml",
    nivel: "warn",
    async run(ctx) {
      const h = [];
      const robots = await ctx.pedir("/robots.txt");
      if (robots.status !== 200) h.push({ msg: `/robots.txt responde ${robots.status || robots.error}.` });
      else {
        if (!/^sitemap:/im.test(robots.texto)) h.push({ msg: "robots.txt no indica el Sitemap." });
        if (/^disallow:\s*\/\s*$/im.test(robots.texto)) h.push({ msg: "robots.txt bloquea todo el sitio (Disallow: /).", nivel: "error" });
      }
      const sm = await ctx.pedir("/sitemap.xml");
      if (sm.status !== 200) h.push({ msg: `/sitemap.xml responde ${sm.status || sm.error}.` });
      return h;
    },
  },
];

export default reglas;
