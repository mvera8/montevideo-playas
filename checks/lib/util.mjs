// Utilidades compartidas: recorrer archivos, globs simples, tamaño de PNG y parseo liviano de JSX.
import fs from "node:fs";
import path from "node:path";

const DIRS_IGNORADOS = new Set(["node_modules", ".next", ".git", "out", "build", "dist", ".vercel", "checks"]);

export function existe(abs) {
  try {
    fs.accessSync(abs);
    return true;
  } catch {
    return false;
  }
}

/** Lista archivos (rutas absolutas) bajo `dir` cuya extensión esté en `exts` (o todas si no se pasa). */
export function recorrer(dir, exts) {
  const salida = [];
  if (!existe(dir)) return salida;
  const pila = [dir];
  while (pila.length) {
    const actual = pila.pop();
    for (const ent of fs.readdirSync(actual, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        if (!DIRS_IGNORADOS.has(ent.name)) pila.push(path.join(actual, ent.name));
      } else if (!exts || exts.includes(path.extname(ent.name).toLowerCase())) {
        salida.push(path.join(actual, ent.name));
      }
    }
  }
  return salida.sort();
}

/** Glob mínimo: `**` cualquier ruta, `*` cualquier cosa sin `/`. */
export function globARegex(glob) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\/?/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${re}$`);
}

export function coincide(rel, globs = []) {
  return globs.some((g) => globARegex(g).test(rel));
}

/** Ancho y alto de un PNG leyendo el header IHDR (bytes 16-23). */
export function tamanoPng(abs) {
  const fd = fs.openSync(abs, "r");
  const buf = Buffer.alloc(24);
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
}

export function lineaDe(texto, indice) {
  let n = 1;
  for (let i = 0; i < indice; i++) if (texto.charCodeAt(i) === 10) n++;
  return n;
}

/**
 * Encuentra etiquetas JSX `<Nombre ...>` y devuelve el texto de sus atributos.
 * Respeta llaves y comillas para no cortar en un `>` dentro de `{a > b}`.
 */
export function etiquetasJsx(src, nombres) {
  const re = new RegExp(`<(${nombres.join("|")})(?=[\\s/>])`, "g");
  const salida = [];
  let m;
  while ((m = re.exec(src))) {
    // `'<a href=...>'`: HTML dentro de un string (p. ej. para una librería), no es JSX.
    if (/["'`]\s*$/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue;
    let i = m.index + m[0].length;
    let llaves = 0;
    let comilla = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (comilla) {
        if (c === comilla && src[i - 1] !== "\\") comilla = null;
      } else if (c === '"' || c === "'" || c === "`") comilla = c;
      else if (c === "{") llaves++;
      else if (c === "}") llaves--;
      else if (c === ">" && llaves === 0) break;
    }
    salida.push({ nombre: m[1], attrs: src.slice(m.index + m[0].length, i), linea: lineaDe(src, m.index), indice: m.index });
  }
  return salida;
}

/** Valor literal de un atributo JSX (`alt="x"` o `alt={"x"}`), `null` si es dinámico, `undefined` si no está. */
export function atributo(attrs, nombre) {
  const m = new RegExp(`(?:^|\\s)${nombre}(\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*["'\`]([^"'\`]*)["'\`]\\s*\\}|\\{))?`).exec(attrs);
  if (!m) return undefined;
  if (!m[1]) return true; // atributo booleano
  return m[2] ?? m[3] ?? m[4] ?? null;
}

// Código sin comentarios de línea ni de bloque, para que "sumar Turnstile" en un comentario no cuente como uso.
export function sinComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/** Variables con valor en el entorno o en los .env del proyecto (como las carga Next): nombre → valor. */
export function variablesEnv(raiz) {
  const vars = new Map(Object.entries(process.env).filter(([, v]) => v));
  for (const f of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    try {
      for (const m of fs.readFileSync(path.join(raiz, f), "utf8").matchAll(/^\s*(?:export\s+)?(\w+)\s*=\s*["']?([^"'#\s]*)/gm)) if (m[2] && !vars.has(m[1])) vars.set(m[1], m[2]);
    } catch {
      // no existe
    }
  }
  return vars;
}
