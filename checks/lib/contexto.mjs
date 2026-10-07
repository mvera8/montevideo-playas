// Arma el contexto que reciben las reglas estáticas: dónde está app/, public/, el código y la config.
import fs from "node:fs";
import path from "node:path";
import { coincide, existe, recorrer } from "./util.mjs";

const EXT_CODIGO = [".tsx", ".jsx", ".ts", ".js", ".mjs"];

export function crearContexto(raiz, config) {
  const appDir = ["src/app", "app"].map((d) => path.join(raiz, d)).find(existe) ?? null;
  const publicDir = path.join(raiz, "public");
  const rel = (abs) => path.relative(raiz, abs).split(path.sep).join("/");

  // Código de la app: carpetas típicas de Next, sin scripts ni config.
  const dirsCodigo = config.dirsCodigo ?? ["src", "app", "components", "lib"];
  let codigo;
  const leerCodigo = () =>
    (codigo ??= [...new Set(dirsCodigo.flatMap((d) => recorrer(path.join(raiz, d), EXT_CODIGO)))]
      .map((abs) => ({ abs, rel: rel(abs), src: fs.readFileSync(abs, "utf8") }))
      .filter((a) => !ignorado(a.rel)));

  const ignorado = (r) => coincide(r, config.ignorar);

  /** Busca `app/<base>.<ext>` y devuelve la ruta absoluta del primero que exista. */
  const enApp = (base, exts) => {
    if (!appDir) return null;
    for (const e of exts) {
      const abs = path.join(appDir, `${base}.${e}`);
      if (existe(abs)) return abs;
    }
    return null;
  };

  const layoutAbs = enApp("layout", ["tsx", "jsx", "js", "ts"]);
  const layoutRaiz = layoutAbs ? { abs: layoutAbs, rel: rel(layoutAbs), src: fs.readFileSync(layoutAbs, "utf8") } : null;

  return {
    raiz,
    appDir,
    publicDir,
    config,
    rel,
    enApp,
    enPublic: (nombre) => (existe(path.join(publicDir, nombre)) ? path.join(publicDir, nombre) : null),
    codigo: leerCodigo,
    layoutRaiz,
  };
}

/** ¿El archivo exporta metadata estática o generateMetadata? */
export function exportaMetadata(src) {
  return /export\s+(const\s+metadata\b|(async\s+)?function\s+generateMetadata\b|const\s+generateMetadata\b)/.test(src);
}
