// Imágenes: formatos modernos, peso, alt y uso de next/image.
import fs from "node:fs";
import path from "node:path";
import { atributo, coincide, etiquetasJsx, recorrer } from "../lib/util.mjs";

// Archivos que por convención tienen que ser PNG/ICO (iOS no acepta WebP en apple-touch-icon).
const PNG_PERMITIDOS = /^(apple-icon|apple-touch-icon|icon|favicon|android-chrome|opengraph-image|twitter-image)[\w.-]*\.png$/i;
const ALT_GENERICO = /^(image|imagen|img|foto|photo|picture|logo|icon|icono|banner|untitled|alt)\d*$/i;

// Los navegadores los piden solos en la raíz, aunque ningún código los mencione.
const AUTO_PEDIDOS = /^(favicon\.ico|apple-touch-icon[\w-]*\.png)$/i;

/**
 * Imágenes de public/ que no aparecen en el código, CSS ni config. Cuenta como usada si se nombra el
 * archivo o su carpeta (`/productos/${slug}.webp` usa todo public/productos/).
 */
function imagenesSinUso(ctx) {
  const textos = [
    ...ctx.codigo().map((a) => a.src),
    ...(ctx.config.dirsCodigo ?? ["src", "app", "styles"]).flatMap((d) => recorrer(path.join(ctx.raiz, d), [".css", ".scss", ".sass", ".mdx", ".md", ".json"])).map((f) => fs.readFileSync(f, "utf8")),
    ...fs.readdirSync(ctx.raiz).filter((f) => /^next\.config\.|\.webmanifest$/.test(f)).map((f) => fs.readFileSync(path.join(ctx.raiz, f), "utf8")),
  ].join("\n");
  return new Set(
    recorrer(ctx.publicDir, [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico"]).filter((f) => {
      const enPublic = path.relative(ctx.publicDir, f).split(path.sep).join("/");
      if (AUTO_PEDIDOS.test(enPublic)) return false;
      if (textos.includes(path.basename(f))) return false;
      const carpeta = path.dirname(enPublic);
      return carpeta === "." || !textos.includes(`/${carpeta}/`);
    }),
  );
}

const reglas = [
  {
    id: "sin-png",
    categoria: "Imágenes",
    titulo: "Imágenes en WebP/AVIF",
    nivel: "warn",
    run(ctx) {
      const dirs = [ctx.publicDir, ctx.appDir].filter(Boolean);
      const archivos = dirs.flatMap((d) => recorrer(d, [".png", ".gif", ".bmp", ".tif", ".tiff"]));
      return archivos
        .filter((f) => !PNG_PERMITIDOS.test(path.basename(f)) && !coincide(ctx.rel(f), ctx.config.permitirPng))
        .map((f) => ({
          msg: `Imagen ${path.extname(f).slice(1).toUpperCase()}: pasala a WebP/AVIF (o SVG si es un dibujo/logo).`,
          archivo: ctx.rel(f),
          arreglo: `npx sharp-cli -i ${ctx.rel(f)} -o ${path.dirname(ctx.rel(f))} -f webp  (y actualizá las referencias)`,
        }))
        .concat(
          // JPG: next/image ya los sirve en WebP/AVIF, pero si se usan en CSS, <img> o og:image van tal cual.
          recorrer(ctx.publicDir, [".jpg", ".jpeg"]).map((f) => ({
            msg: "JPG: si no pasa siempre por next/image, pasalo a WebP (pesa ~30% menos).",
            archivo: ctx.rel(f),
            nivel: "info",
            arreglo: `npx sharp-cli -i ${ctx.rel(f)} -o ${path.dirname(ctx.rel(f))} -f webp -q 80`,
          })),
        );
    },
  },
  {
    id: "peso-imagenes",
    categoria: "Imágenes",
    titulo: "Imágenes livianas",
    nivel: "warn",
    run(ctx) {
      const maxKb = ctx.config.maxKbImagen ?? 400;
      const sinUso = imagenesSinUso(ctx);
      return recorrer(ctx.publicDir, [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"])
        .map((f) => ({ f, kb: Math.round(fs.statSync(f).size / 1024) }))
        .filter(({ kb }) => kb > maxKb)
        .map(({ f, kb }) => ({
          msg: `${kb} KB (máximo ${maxKb} KB). Achicá la resolución o bajá la calidad.`,
          archivo: ctx.rel(f),
          arreglo: sinUso.has(f) ? "No la encontré usada en el código: si sobra, borrala." : undefined,
        }));
    },
  },
  {
    id: "imagenes-sin-uso",
    categoria: "Imágenes",
    titulo: "Imágenes de public/ en uso",
    nivel: "info",
    run(ctx) {
      return [...imagenesSinUso(ctx)].map((f) => ({
        msg: "No aparece en el código: se publica igual y suma peso al deploy.",
        archivo: ctx.rel(f),
        arreglo: "Si sobra, borrala. Si se usa desde un CMS/base de datos, sumala a `reglas[\"imagenes-sin-uso\"].ignorar` en checks.config.mjs.",
      }));
    },
  },
  {
    id: "alt",
    categoria: "Imágenes",
    titulo: "Imágenes con alt",
    nivel: "error",
    run(ctx) {
      const h = [];
      for (const a of ctx.codigo()) {
        if (!/\.[jt]sx$/.test(a.rel)) continue;
        for (const t of etiquetasJsx(a.src, ["img", "Image"])) {
          if (/\{\s*\.\.\./.test(t.attrs)) continue; // {...props}: no se puede saber
          const alt = atributo(t.attrs, "alt");
          if (alt === undefined) {
            h.push({
              msg: `<${t.nombre}> sin alt.`,
              archivo: a.rel,
              linea: t.linea,
              arreglo: "Describí lo que muestra; si es decorativa, alt=\"\".",
            });
          } else if (typeof alt === "string" && (ALT_GENERICO.test(alt.trim()) || /\.(png|jpe?g|webp|avif|svg)$/i.test(alt))) {
            h.push({ msg: `alt="${alt}" no describe nada.`, archivo: a.rel, linea: t.linea, nivel: "warn" });
          }
        }
      }
      return h;
    },
  },
  {
    id: "next-image",
    categoria: "Imágenes",
    titulo: "Usar next/image en vez de <img>",
    nivel: "warn",
    run(ctx) {
      const h = [];
      for (const a of ctx.codigo()) {
        // Las imágenes generadas con ImageResponse (og, íconos) solo aceptan <img>.
        if (!/\.[jt]sx$/.test(a.rel) || /(^|\/)(opengraph-image|twitter-image|icon|apple-icon)\.[jt]sx$/.test(a.rel)) continue;
        for (const t of etiquetasJsx(a.src, ["img"])) {
          h.push({
            msg: "<img> crudo: sin lazy loading, sin tamaños responsivos ni conversión a WebP/AVIF.",
            archivo: a.rel,
            linea: t.linea,
            arreglo: "import Image from \"next/image\" (si es a propósito: `{/* next-checks-ignore next-image */}` en la línea anterior).",
          });
        }
      }
      return h;
    },
  },
];

export default reglas;
