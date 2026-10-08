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

async function pedir(url) {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    return { status: r.status, tipo: r.headers.get("content-type") ?? "", texto: await r.text() };
  } catch (e) {
    return { status: 0, tipo: "", texto: "", error: e.cause?.code ?? e.message };
  }
}

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
  return { base, paginas, pedir: (r) => pedir(new URL(r, base)) };
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
