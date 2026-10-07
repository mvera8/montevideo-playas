// Iconos: favicon, ícono de inicio del iPhone (apple-icon) y manifest para "Agregar a inicio".
import fs from "node:fs";
import { tamanoPng } from "../lib/util.mjs";

const reglas = [
  {
    id: "favicon",
    categoria: "Iconos",
    titulo: "Favicon",
    nivel: "error",
    run(ctx) {
      const archivo = ctx.enApp("favicon", ["ico"]) ?? ctx.enApp("icon", ["svg", "png", "ico", "tsx", "ts", "js"]) ?? ctx.enPublic("favicon.ico");
      if (archivo) return [];
      return [
        {
          msg: "No hay favicon.",
          arreglo: "Poné `favicon.ico` (32×32) en app/ y, mejor aún, un `icon.svg` que se vea bien chico. Next genera los <link> solo.",
        },
      ];
    },
  },
  {
    id: "apple-icon",
    categoria: "Iconos",
    titulo: "Ícono de inicio del iPhone",
    nivel: "error",
    run(ctx) {
      const archivo =
        ctx.enApp("apple-icon", ["png", "jpg", "jpeg", "tsx", "ts", "js"]) ?? ctx.enPublic("apple-touch-icon.png");
      if (!archivo) {
        return [
          {
            msg: "Falta el ícono para \"Agregar a pantalla de inicio\" en iPhone.",
            arreglo: "Agregá `app/apple-icon.png` de 180×180, fondo opaco (iOS pinta de negro la transparencia) y sin esquinas redondeadas (iOS las redondea).",
          },
        ];
      }
      if (!archivo.endsWith(".png")) return [];
      const t = tamanoPng(archivo);
      if (t && (t.ancho !== 180 || t.alto !== 180)) {
        return [{ msg: `apple-icon mide ${t.ancho}×${t.alto}; iOS espera 180×180.`, archivo: ctx.rel(archivo), nivel: "warn" }];
      }
      return [];
    },
  },
  {
    id: "manifest",
    categoria: "Iconos",
    titulo: "Web app manifest",
    nivel: "warn",
    run(ctx) {
      const archivo =
        ctx.enApp("manifest", ["ts", "js", "json", "webmanifest"]) ??
        ctx.enPublic("manifest.webmanifest") ??
        ctx.enPublic("manifest.json");
      if (!archivo) {
        return [
          {
            msg: "No hay manifest (nombre, colores e íconos al instalar el sitio en Android/iOS).",
            arreglo: "Creá `app/manifest.ts` exportando `MetadataRoute.Manifest` con name, short_name, start_url, display: \"standalone\", theme_color, background_color e íconos de 192 y 512.",
          },
        ];
      }
      const src = fs.readFileSync(archivo, "utf8");
      const faltan = ["name", "short_name", "start_url", "display", "theme_color", "background_color", "icons"].filter(
        (k) => !new RegExp(`["']?${k}["']?\\s*:`).test(src),
      );
      const hallazgos = faltan.length ? [{ msg: `Al manifest le falta: ${faltan.join(", ")}.`, archivo: ctx.rel(archivo) }] : [];
      for (const tam of ["192", "512"]) {
        if (!src.includes(tam)) hallazgos.push({ msg: `El manifest no declara un ícono de ${tam}×${tam}.`, archivo: ctx.rel(archivo) });
      }
      return hallazgos;
    },
  },
];

export default reglas;
