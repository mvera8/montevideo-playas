// Imágenes: formatos modernos, peso, alt y uso de next/image.
import fs from "node:fs";
import path from "node:path";
import { atributo, coincide, etiquetasJsx, recorrer } from "../lib/util.mjs";

// Archivos que por convención tienen que ser PNG/ICO (iOS no acepta WebP en apple-touch-icon).
const PNG_PERMITIDOS = /^(apple-icon|apple-touch-icon|icon|favicon|android-chrome|opengraph-image|twitter-image)[\w.-]*\.png$/i;
const ALT_GENERICO = /^(image|imagen|img|foto|photo|picture|logo|icon|icono|banner|untitled|alt)\d*$/i;

const reglas = [
  {
    id: "sin-png",
    categoria: "Imágenes",
    titulo: "Sin PNG/GIF/BMP (usar WebP o AVIF)",
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
        }));
    },
  },
  {
    id: "peso-imagenes",
    categoria: "Imágenes",
    titulo: "Imágenes livianas",
    nivel: "warn",
    run(ctx) {
      const maxKb = ctx.config.maxKbImagen ?? 400;
      return recorrer(ctx.publicDir, [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"])
        .map((f) => ({ f, kb: Math.round(fs.statSync(f).size / 1024) }))
        .filter(({ kb }) => kb > maxKb)
        .map(({ f, kb }) => ({
          msg: `${kb} KB (máximo ${maxKb} KB). Achicá la resolución o bajá la calidad.`,
          archivo: ctx.rel(f),
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
