// SEO: metadata del layout raíz, metadata por página, idioma, viewport, robots, sitemap y Open Graph.
import fs from "node:fs";
import path from "node:path";
import { exportaMetadata } from "../lib/contexto.mjs";
import { recorrer } from "../lib/util.mjs";

const sinLayout = (ctx) => (ctx.layoutRaiz ? null : [{ msg: "No encontré app/layout.tsx.", nivel: "error" }]);

/** Texto de un string literal `clave: "..."` dentro del archivo (solo si es literal, sin variables). */
function literal(src, clave) {
  const m = new RegExp(`\\b${clave}\\s*:\\s*(["'])((?:(?!\\1).)*)\\1`).exec(src);
  return m ? m[2] : null;
}

const reglas = [
  {
    id: "metadata-raiz",
    categoria: "SEO",
    titulo: "Metadata del layout raíz",
    nivel: "error",
    run(ctx) {
      const falta = sinLayout(ctx);
      if (falta) return falta;
      const { src, rel } = ctx.layoutRaiz;
      if (!exportaMetadata(src)) {
        return [{ msg: "El layout raíz no exporta `metadata` ni `generateMetadata`.", archivo: rel, arreglo: "export const metadata: Metadata = { title: { default, template: \"%s · Sitio\" }, description, metadataBase: new URL(\"https://...\") }" }];
      }
      const h = [];
      if (!/\btitle\s*:/.test(src)) h.push({ msg: "La metadata no tiene `title`.", archivo: rel });
      if (!/\bdescription\s*:/.test(src)) h.push({ msg: "La metadata no tiene `description`.", archivo: rel });
      if (!/\bmetadataBase\s*:/.test(src))
        h.push({
          msg: "Falta `metadataBase`: sin eso las URLs de og:image y canonical quedan relativas (o en localhost).",
          archivo: rel,
          nivel: "warn",
          arreglo: "metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? \"https://tu-dominio\")",
        });
      if (!/\btemplate\s*:/.test(src))
        h.push({ msg: "El título no usa `template` (\"%s · Marca\"): cada página tiene que repetir la marca a mano.", archivo: rel, nivel: "info" });
      const titulo = literal(src, "title");
      if (titulo && (titulo.length < 10 || titulo.length > 60))
        h.push({ msg: `El título "${titulo}" tiene ${titulo.length} caracteres (ideal 10–60).`, archivo: rel, nivel: "warn" });
      const desc = literal(src, "description");
      if (desc && (desc.length < 50 || desc.length > 160))
        h.push({ msg: `La descripción tiene ${desc.length} caracteres (ideal 50–160).`, archivo: rel, nivel: "warn" });
      return h;
    },
  },
  {
    id: "metadata-paginas",
    categoria: "SEO",
    titulo: "Cada página con su título y descripción",
    nivel: "warn",
    run(ctx) {
      if (!ctx.appDir) return [];
      const paginas = recorrer(ctx.appDir, [".tsx", ".jsx", ".js", ".ts"]).filter((f) => /^page\.[jt]sx?$/.test(path.basename(f)));
      const h = [];
      for (const pagina of paginas) {
        const dir = path.dirname(pagina);
        if (dir === ctx.appDir) continue; // la home usa la metadata del layout raíz
        // Vale si la página o algún layout entre ella y la raíz exporta metadata.
        let tiene = false;
        for (let d = dir; d.startsWith(ctx.appDir) && d !== ctx.appDir && !tiene; d = path.dirname(d)) {
          for (const f of [path.join(d, path.basename(pagina)), ...["tsx", "jsx", "js", "ts"].map((e) => path.join(d, `layout.${e}`))]) {
            if (fs.existsSync(f) && exportaMetadata(fs.readFileSync(f, "utf8"))) tiene = true;
          }
        }
        if (tiene) continue;
        const esCliente = /^\s*["']use client["']/.test(fs.readFileSync(pagina, "utf8"));
        h.push({
          msg: "Página sin metadata propia: hereda el título del sitio y queda duplicada en Google.",
          archivo: ctx.rel(pagina),
          arreglo: esCliente
            ? "Es \"use client\" y no puede exportar metadata: agregá un layout.tsx en esa carpeta con `export const metadata`."
            : "export const metadata: Metadata = { title: \"...\", description: \"...\" } (o generateMetadata si es dinámica).",
        });
      }
      return h;
    },
  },
  {
    id: "html-lang",
    categoria: "SEO",
    titulo: "Idioma en <html lang>",
    nivel: "error",
    run(ctx) {
      const falta = sinLayout(ctx);
      if (falta) return falta;
      const m = /<html\b([^>]*)>/.exec(ctx.layoutRaiz.src);
      if (m && /\blang\s*=/.test(m[1])) return [];
      return [{ msg: "<html> no tiene `lang` (lectores de pantalla y Google lo usan).", archivo: ctx.layoutRaiz.rel, arreglo: "<html lang=\"es\">" }];
    },
  },
  {
    id: "viewport",
    categoria: "SEO",
    titulo: "Viewport y color de tema",
    nivel: "warn",
    run(ctx) {
      if (!ctx.layoutRaiz) return [];
      const { src, rel } = ctx.layoutRaiz;
      const h = [];
      const tieneViewport = /export\s+(const\s+viewport\b|(async\s+)?function\s+generateViewport\b)/.test(src);
      if (/\bthemeColor\s*:/.test(src) && !tieneViewport)
        h.push({ msg: "`themeColor` dentro de metadata está deprecado; va en `export const viewport`.", archivo: rel });
      else if (!tieneViewport || !/\bthemeColor\s*:/.test(src))
        h.push({
          msg: "No hay `themeColor`: la barra de Safari/Chrome en el celular queda con el color por defecto.",
          archivo: rel,
          nivel: "info",
          arreglo: "export const viewport: Viewport = { themeColor: \"#0ea5e9\" }",
        });
      return h;
    },
  },
  {
    id: "robots",
    categoria: "SEO",
    titulo: "robots.txt",
    nivel: "warn",
    run(ctx) {
      if (ctx.enApp("robots", ["ts", "js", "txt"]) || ctx.enPublic("robots.txt")) return [];
      return [{ msg: "No hay robots.txt.", arreglo: "Creá app/robots.ts con `rules: { userAgent: \"*\", allow: \"/\" }` y `sitemap: \"https://.../sitemap.xml\"`." }];
    },
  },
  {
    id: "sitemap",
    categoria: "SEO",
    titulo: "sitemap.xml",
    nivel: "warn",
    run(ctx) {
      if (ctx.enApp("sitemap", ["ts", "js", "xml"]) || ctx.enPublic("sitemap.xml")) return [];
      return [{ msg: "No hay sitemap.", arreglo: "Creá app/sitemap.ts que devuelva las URLs del sitio (incluí las dinámicas)." }];
    },
  },
  {
    id: "open-graph",
    categoria: "SEO",
    titulo: "Imagen para compartir (Open Graph)",
    nivel: "warn",
    run(ctx) {
      if (ctx.enApp("opengraph-image", ["png", "jpg", "jpeg", "tsx", "ts", "js"])) return [];
      if (ctx.layoutRaiz && /openGraph\s*:\s*\{[\s\S]*?\bimages\s*:/.test(ctx.layoutRaiz.src)) return [];
      return [
        {
          msg: "No hay imagen para compartir: en WhatsApp/Twitter/LinkedIn el link sale sin preview.",
          arreglo: "Agregá app/opengraph-image.png (1200×630) o generala con app/opengraph-image.tsx (ImageResponse).",
        },
      ];
    },
  },
  {
    id: "not-found",
    categoria: "SEO",
    titulo: "Página 404 propia",
    nivel: "info",
    run(ctx) {
      if (ctx.enApp("not-found", ["tsx", "jsx", "js", "ts"])) return [];
      return [{ msg: "No hay app/not-found.tsx: se muestra el 404 genérico de Next, sin tu navegación." }];
    },
  },
];

export default reglas;
