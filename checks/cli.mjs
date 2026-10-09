#!/usr/bin/env node
// next-checks: chequeos de calidad para sitios Next.js. Ver README.md.
//
//   node checks/cli.mjs                       → análisis estático del proyecto
//   node checks/cli.mjs --url http://localhost:3000   → además revisa el sitio corriendo
//   node checks/cli.mjs init                  → agrega los scripts a package.json
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { crearContexto } from "./lib/contexto.mjs";
import { coincide } from "./lib/util.mjs";
import iconos from "./reglas/iconos.mjs";
import seo from "./reglas/seo.mjs";
import imagenes from "./reglas/imagenes.mjs";
import codigo from "./reglas/codigo.mjs";
import analytics from "./reglas/analytics.mjs";
import producto from "./reglas/producto.mjs";
import seguridad from "./reglas/seguridad.mjs";
import accesibilidad from "./reglas/accesibilidad.mjs";
import reglasUrl, { crearContextoUrl, descubrirPaginas } from "./reglas/url.mjs";

// Agrupadas por categoría (en el orden en que aparece cada una), aunque vengan de archivos distintos.
const REGLAS = agrupar([...iconos, ...seo, ...imagenes, ...codigo, ...seguridad, ...producto, ...accesibilidad, ...analytics]);
// Comentario en la línea anterior: `// next-checks-ignore` (todas) o `// next-checks-ignore alt, next-image`.
// También se respetan los eslint-disable equivalentes para no duplicar comentarios.
const ESLINT_EQUIVALENTE = { "next-image": "no-img-element", "link-interno": "no-html-link-for-pages", "console-log": "no-console" };
const lineasCache = new Map();
const raiz = process.cwd();
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const valor = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (flag("help") || flag("h")) {
  console.log(`next-checks

Uso:
  next-checks                         análisis estático
  next-checks --url <base>            además revisa el HTML del sitio corriendo
      --paginas /,/contacto           rutas a revisar (por defecto: las del sitemap, máx. 20)
      --max 20                        tope de páginas del sitemap
  next-checks init                    agrega "checks" y "checks:url" a package.json
  --json                              salida JSON (para CI o para pegarle a la IA)
  --estricto                          los avisos también hacen fallar (exit 1)
  --solo <id,id>                      correr solo esas reglas
  --lista                             listar las reglas disponibles

Config opcional: checks.config.mjs en la raíz del proyecto (ver README).`);
  process.exit(0);
}

if (args[0] === "init") {
  const pj = path.join(raiz, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pj, "utf8"));
  const dir = path.relative(raiz, path.dirname(new URL(import.meta.url).pathname)) || ".";
  pkg.scripts ??= {};
  pkg.scripts.checks ??= `node ${dir}/cli.mjs`;
  pkg.scripts["checks:url"] ??= `node ${dir}/cli.mjs --url http://localhost:3000`;
  fs.writeFileSync(pj, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`Listo: "npm run checks" y "npm run checks:url" en package.json.`);
  process.exit(0);
}

const config = await cargarConfig();

if (flag("lista")) {
  for (const r of [...REGLAS, ...reglasUrl]) console.log(`${r.id.padEnd(20)} ${r.nivel.padEnd(6)} ${r.categoria} · ${r.titulo}`);
  process.exit(0);
}

const solo = valor("solo")?.split(",");
const activa = (r) => confRegla(r.id).nivel !== "off" && (!solo || solo.includes(r.id));

const resultados = [];
const ctx = crearContexto(raiz, config);
for (const r of REGLAS.filter(activa)) resultados.push(await correr(r, ctx));

const base = valor("url") ?? config.url;
if (base) {
  const rutas = await descubrirPaginas(base, { paginas: valor("paginas")?.split(",") ?? config.paginas, max: Number(valor("max") ?? 20) });
  const ctxUrl = { ...(await crearContextoUrl(base, rutas)), estatico: ctx };
  for (const r of reglasUrl.filter(activa)) resultados.push(await correr(r, ctxUrl));
}

const hallazgos = resultados.flatMap((r) => r.hallazgos);
const errores = hallazgos.filter((h) => h.nivel === "error").length;
const avisos = hallazgos.filter((h) => h.nivel === "warn").length;

if (flag("json")) console.log(JSON.stringify({ errores, avisos, resultados }, null, 2));
else imprimir(resultados, { errores, avisos, base });

process.exit(errores || (flag("estricto") && avisos) ? 1 : 0);

async function correr(regla, ctx) {
  const { nivel: nivelConfig, ignorar = [] } = confRegla(regla.id);
  let hallazgos;
  try {
    hallazgos = await regla.run(ctx);
  } catch (e) {
    hallazgos = [{ msg: `La regla falló: ${e.message}`, nivel: "warn" }];
  }
  hallazgos = hallazgos
    .filter((h) => !(h.archivo && coincide(h.archivo, ignorar)) && !silenciado(regla.id, h))
    // Un hallazgo puede bajar/subir su nivel, pero si la regla se configuró a mano, manda la config.
    .map((h) => ({ ...h, nivel: nivelConfig ?? h.nivel ?? regla.nivel }));
  return { id: regla.id, categoria: regla.categoria, titulo: regla.titulo, hallazgos };
}

function agrupar(reglas) {
  const orden = [...new Set(reglas.map((r) => r.categoria))];
  return [...reglas].sort((a, b) => orden.indexOf(a.categoria) - orden.indexOf(b.categoria));
}

/** `reglas: { id: "warn" }` o `reglas: { id: { nivel: "warn", ignorar: ["src/x/**"] } }`. */
function confRegla(id) {
  const c = config.reglas?.[id];
  return typeof c === "string" ? { nivel: c } : (c ?? {});
}

function silenciado(id, h) {
  if (!h.archivo || !h.linea) return false;
  if (!lineasCache.has(h.archivo)) {
    try {
      lineasCache.set(h.archivo, fs.readFileSync(path.join(raiz, h.archivo), "utf8").split("\n"));
    } catch {
      lineasCache.set(h.archivo, []);
    }
  }
  const anterior = lineasCache.get(h.archivo)[h.linea - 2] ?? "";
  const m = /next-checks-ignore\b([^*\n]*)/.exec(anterior);
  if (m) {
    const ids = m[1].split("--")[0].split(/[\s,]+/).filter(Boolean);
    if (!ids.length || ids.includes(id)) return true;
  }
  return Boolean(ESLINT_EQUIVALENTE[id] && anterior.includes("eslint-disable") && anterior.includes(ESLINT_EQUIVALENTE[id]));
}

async function cargarConfig() {
  for (const nombre of ["checks.config.mjs", "checks.config.js", "checks.config.json"]) {
    const abs = path.join(raiz, nombre);
    if (!fs.existsSync(abs)) continue;
    if (nombre.endsWith(".json")) return JSON.parse(fs.readFileSync(abs, "utf8"));
    return (await import(pathToFileURL(abs))).default ?? {};
  }
  return {};
}

function imprimir(resultados, { errores, avisos, base }) {
  const color = process.stdout.isTTY && !process.env.NO_COLOR;
  const c = (cod, s) => (color ? `\x1b[${cod}m${s}\x1b[0m` : s);
  const ICONO = { error: c(31, "✗"), warn: c(33, "!"), info: c(36, "i") };
  const PESO = { error: 0, warn: 1, info: 2 };

  console.log(c(1, `\nnext-checks · ${path.basename(raiz)}`) + (base ? c(2, `  (+ ${base})`) : ""));
  let categoria;
  for (const r of resultados) {
    if (r.categoria !== categoria) console.log(c(1, `\n${(categoria = r.categoria)}`));
    if (!r.hallazgos.length) {
      console.log(`  ${c(32, "✓")} ${c(2, r.titulo)}`);
      continue;
    }
    const peor = r.hallazgos.reduce((a, h) => (PESO[h.nivel] < PESO[a] ? h.nivel : a), "info");
    console.log(`  ${ICONO[peor]} ${r.titulo} ${c(2, `[${r.id}]`)}`);
    const visibles = r.hallazgos.slice(0, 15);
    for (const h of visibles) {
      const donde = h.archivo ? c(2, `${h.archivo}${h.linea ? `:${h.linea}` : ""}  `) : "";
      console.log(`      ${ICONO[h.nivel]} ${donde}${h.msg}`);
      if (h.arreglo) console.log(c(2, `        → ${h.arreglo}`));
    }
    if (r.hallazgos.length > visibles.length) console.log(c(2, `      … y ${r.hallazgos.length - visibles.length} más (usá --json para ver todo)`));
  }
  const ok = resultados.filter((r) => !r.hallazgos.length).length;
  console.log(
    `\n${errores ? c(31, `${errores} errores`) : c(32, "0 errores")} · ${avisos ? c(33, `${avisos} avisos`) : "0 avisos"} · ${ok}/${resultados.length} chequeos ok\n`,
  );
}
