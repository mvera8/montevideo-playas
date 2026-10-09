// Accesibilidad y experiencia: contraste de colores, formularios con label, links internos que existen
// y fuentes cargadas sin bloquear.
import fs from "node:fs";
import path from "node:path";
import { atributo, etiquetasJsx, lineaDe, recorrer } from "../lib/util.mjs";

// Paleta de Tailwind (v3; la de v4 es casi igual) para los colores donde más se falla el contraste.
const GRISES = {
  slate: "f8fafc f1f5f9 e2e8f0 cbd5e1 94a3b8 64748b 475569 334155 1e293b 0f172a 020617",
  gray: "f9fafb f3f4f6 e5e7eb d1d5db 9ca3af 6b7280 4b5563 374151 1f2937 111827 030712",
  zinc: "fafafa f4f4f5 e4e4e7 d4d4d8 a1a1aa 71717a 52525b 3f3f46 27272a 18181b 09090b",
  neutral: "fafafa f5f5f5 e5e5e5 d4d4d4 a3a3a3 737373 525252 404040 262626 171717 0a0a0a",
  stone: "fafaf9 f5f5f4 e7e5e4 d6d3d1 a8a29e 78716c 57534e 44403c 292524 1c1917 0c0a09",
};
const COLORES = {
  yellow: "fde047 facc15 eab308 ca8a04",
  amber: "fcd34d fbbf24 f59e0b d97706",
  orange: "fdba74 fb923c f97316 ea580c",
  lime: "bef264 a3e635 84cc16 65a30d",
  green: "86efac 4ade80 22c55e 16a34a",
  emerald: "6ee7b7 34d399 10b981 059669",
  teal: "5eead4 2dd4bf 14b8a6 0d9488",
  cyan: "67e8f9 22d3ee 06b6d4 0891b2",
  sky: "7dd3fc 38bdf8 0ea5e9 0284c7",
  blue: "93c5fd 60a5fa 3b82f6 2563eb",
  red: "fca5a5 f87171 ef4444 dc2626",
  pink: "f9a8d4 f472b6 ec4899 db2777",
};

function paleta(ctx) {
  const p = { white: "#ffffff", black: "#000000" };
  for (const [n, v] of Object.entries(GRISES)) v.split(" ").forEach((hex, i) => (p[`${n}-${[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950][i]}`] = `#${hex}`));
  for (const [n, v] of Object.entries(COLORES)) v.split(" ").forEach((hex, i) => (p[`${n}-${[300, 400, 500, 600][i]}`] = `#${hex}`));
  // Colores propios: `--color-x: #hex` (Tailwind v4) en cualquier CSS del proyecto.
  const css = ["src", "app", "styles"].flatMap((d) => recorrer(path.join(ctx.raiz, d), [".css"])).map((f) => fs.readFileSync(f, "utf8"));
  for (const src of css) for (const m of src.matchAll(/--color-([\w-]+)\s*:\s*(#[0-9a-f]{3,8})\b/gi)) p[m[1]] = m[2];
  return { p, css: css.join("\n") };
}

function rgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const mezclar = (a, b, alfa) => a.map((c, i) => Math.round(c * alfa + b[i] * (1 - alfa)));
function luminancia([r, g, b]) {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Color de una clase `text-x`, `text-x/70`, `text-[#hex]` o `bg-…` (solo las clases base, sin hover:/md:). */
function colorDe(clases, prefijo, p) {
  for (const c of clases) {
    const m = new RegExp(`^${prefijo}-(?:\\[(#[0-9a-fA-F]{3,6})\\]|([a-z]+(?:-[a-z]+)*(?:-\\d{2,3})?))(?:/(\\d{1,3}))?$`).exec(c);
    if (!m) continue;
    const hex = m[1] ?? p[m[2]];
    if (hex) return { hex, alfa: m[3] ? Number(m[3]) / 100 : 1, clase: c };
  }
  return null;
}

/** Rutas de la app (páginas y route handlers) como regex, más los archivos de public/. */
function rutasExistentes(ctx) {
  if (!ctx.appDir) return null;
  const res = recorrer(ctx.appDir, [".tsx", ".jsx", ".ts", ".js", ".md", ".mdx"])
    .filter((f) => /^(page|route)\.(m?[jt]sx?|mdx?)$/.test(path.basename(f)))
    .map((f) => new RegExp(`^${ctx.ruta(f).replace(/\/\[\[\.\.\.[^\]]+\]\]/g, "(/.*)?").replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+")}/?$`));
  // Generados por convención de metadata.
  res.push(/^\/(sitemap\.xml|robots\.txt|manifest\.(webmanifest|json)|favicon\.ico|icon[\w-]*\.\w+|apple-icon[\w-]*\.\w+|opengraph-image[\w-]*(\.\w+)?|twitter-image[\w-]*(\.\w+)?)$/);
  const publicos = new Set(recorrer(ctx.publicDir).map((f) => "/" + path.relative(ctx.publicDir, f).split(path.sep).join("/")));
  // Redirects / rewrites del next.config: lo que empiece con su `source` fijo existe.
  const conf = ["next.config.ts", "next.config.mjs", "next.config.js"].map((f) => path.join(ctx.raiz, f)).find((f) => fs.existsSync(f));
  const prefijos = conf ? [...fs.readFileSync(conf, "utf8").matchAll(/source\s*:\s*["'`](\/[^"'`:(*]*)/g)].map((m) => m[1]).filter((s) => s !== "/") : [];
  return (ruta) => res.some((re) => re.test(ruta)) || publicos.has(ruta) || prefijos.some((s) => ruta.startsWith(s));
}

/**
 * Clases posibles de un template literal: la parte fija más cada string de las interpolaciones
 * (`base ${activo ? "bg-a text-b" : "bg-c"}` → "base bg-a text-b", "base bg-c"). Sin mezclar ramas.
 */
function combinaciones(tpl) {
  let fija = "";
  const ramas = [];
  for (let i = 0; i < tpl.length; i++) {
    if (tpl[i] === "$" && tpl[i + 1] === "{") {
      let prof = 0;
      let j = i + 1;
      for (; j < tpl.length; j++) {
        if (tpl[j] === "{") prof++;
        else if (tpl[j] === "}" && --prof === 0) break;
      }
      for (const s of tpl.slice(i + 2, j).matchAll(/["'`]([^"'`]*)["'`]/g)) ramas.push(s[1]);
      fija += " ";
      i = j;
    } else fija += tpl[i];
  }
  return ramas.length ? ramas.map((r) => `${fija} ${r}`) : [fija];
}

const reglas = [
  {
    id: "contraste",
    categoria: "Accesibilidad",
    titulo: "Contraste de texto suficiente",
    nivel: "warn",
    run(ctx) {
      const { p, css } = paleta(ctx);
      // Fondo de la página: `body { background: … }` en CSS o bg-… en el <body> del layout raíz.
      const bodyCss = /body\s*\{[^}]*background(?:-color)?\s*:\s*(?:var\(--color-([\w-]+)\)|(#[0-9a-f]{3,6}))/i.exec(css);
      const bodyJsx = ctx.layoutRaiz && /<body[^>]*className=["'`{][^>]*\bbg-([\w-]+)/.exec(ctx.layoutRaiz.src);
      const fondoPagina = (bodyJsx && p[bodyJsx[1]]) || (bodyCss && (bodyCss[2] ?? p[bodyCss[1]])) || "#ffffff";
      const h = [];
      for (const a of ctx.codigo()) {
        if (!/\.[jt]sx$/.test(a.rel) || /(opengraph-image|twitter-image|icon|apple-icon)\.[jt]sx$/.test(a.rel)) continue;
        // Si el archivo no pone ningún fondo, el texto se ve sobre el de la página. Cuentan también los
        // degradados (`bg-gradient-*`, `bg-linear-*`).
        const sinFondos = !/(^|[\s"'`])bg-(?!opacity|clip|cover|center|no-repeat|fixed|contain|repeat|top|bottom|left|right)/.test(a.src);
        for (const m of a.src.matchAll(/className=(?:"([^"]*)"|'([^']*)'|\{`((?:[^`\\]|\\.)*)`\})/g))
          for (const combinacion of combinaciones(m[1] ?? m[2] ?? m[3])) {
            // Íconos (<svg>, <IconX>, <XIcon>): decorativos con aria-hidden no se miden; si no, 3:1 (WCAG 1.4.11).
            const tag = /<([\w.]+)((?:[^<>]|\{[^}]*\})*)$/.exec(a.src.slice(Math.max(0, m.index - 400), m.index));
            const icono = tag && /^(svg|path|Icon\w*|\w+Icon)$/.test(tag[1]);
            if (icono && /aria-hidden/.test(a.src.slice(m.index, a.src.indexOf(">", m.index + m[0].length) + 1) + tag[2])) continue;
            const clases = combinacion.split(/\s+/).filter((c) => c && !c.includes(":"));
            // Deshabilitado o tachado: WCAG no exige contraste.
            if (clases.some((c) => /^(cursor-not-allowed|line-through|pointer-events-none|sr-only)$/.test(c))) continue;
            const texto = colorDe(clases, "text", p);
            if (!texto) continue;
            const fondo = colorDe(clases, "bg", p);
            if (fondo && fondo.alfa < 1) continue; // fondo translúcido: depende de lo que hay detrás
            if (!fondo && !sinFondos) continue;
            const hexFondo = fondo?.hex ?? fondoPagina;
            const r = contraste(mezclar(rgb(texto.hex), rgb(hexFondo), texto.alfa), rgb(hexFondo));
            const grande = clases.some((c) => /^text-([2-9]xl)$/.test(c)) || (clases.some((c) => /^text-(lg|xl)$/.test(c)) && clases.some((c) => /^font-(bold|extrabold|black|semibold)$/.test(c)));
            const minimo = grande || icono ? 3 : 4.5;
            if (r >= minimo) continue;
            // Casi invisible contra el fondo supuesto (text-white sin fondo en el archivo): en realidad está
            // sobre un fondo que pone el padre o una prop (`claro`), que desde acá no se ve.
            if (!fondo && r < 1.5) continue;
            h.push({
              msg: `${icono ? "Ícono " : ""}${texto.clase} sobre ${fondo?.clase ?? `el fondo de la página (${hexFondo})`}: contraste ${r.toFixed(1)}:1 (mínimo ${minimo}:1${icono ? " para íconos" : grande ? " para texto grande" : ""}).`,
              archivo: a.rel,
              linea: lineaDe(a.src, m.index),
              nivel: r < 3 ? "warn" : "info",
              arreglo: texto.alfa < 1 ? `Subí la opacidad (${texto.clase.replace(/\/\d+$/, "/80")} o más) o usá un tono más oscuro.` : "Usá un tono más oscuro (o más claro sobre fondo oscuro).",
            });
          }
      }
      // La misma clase repetida en varias ramas da el mismo hallazgo.
      return h.filter((x, i) => h.findIndex((y) => y.archivo === x.archivo && y.linea === x.linea && y.msg === x.msg) === i);
    },
  },
  {
    id: "formularios",
    categoria: "Accesibilidad",
    titulo: "Formularios con label y tipos correctos",
    nivel: "warn",
    run(ctx) {
      const h = [];
      for (const a of ctx.codigo()) {
        if (!/\.[jt]sx$/.test(a.rel)) continue;
        for (const t of etiquetasJsx(a.src, ["input", "textarea", "select"])) {
          if (/\{\s*\.\.\./.test(t.attrs)) continue;
          const tipo = atributo(t.attrs, "type");
          if (["hidden", "submit", "button", "reset", "image"].includes(tipo)) continue;
          // Fuera del árbol de accesibilidad: campo trampa (aria-hidden) o input oculto que abre un botón
          // (`className="hidden"` en un type="file"). sr-only sí se lee, así que ese sigue necesitando label.
          if (atributo(t.attrs, "aria-hidden") !== undefined && atributo(t.attrs, "aria-hidden") !== "false") continue;
          if (/(^|\s)hidden(\s|$)/.test(atributo(t.attrs, "className") ?? "")) continue;
          const id = atributo(t.attrs, "id");
          const antes = a.src.slice(0, t.indice);
          const dentroDeLabel = antes.lastIndexOf("<label") > antes.lastIndexOf("</label>");
          const conLabel =
            atributo(t.attrs, "aria-label") !== undefined ||
            atributo(t.attrs, "aria-labelledby") !== undefined ||
            atributo(t.attrs, "title") !== undefined ||
            dentroDeLabel ||
            (typeof id === "string" && new RegExp(`htmlFor=["'{]\\s*["'\`]?${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]?`).test(a.src)) ||
            (id === null && /htmlFor=\{/.test(a.src)); // id dinámico (useId): confío en el htmlFor dinámico
          if (!conLabel)
            h.push({
              msg: `<${t.nombre}> sin label${atributo(t.attrs, "placeholder") !== undefined ? " (el placeholder no cuenta: desaparece al escribir y muchos lectores de pantalla no lo leen)" : ""}.`,
              archivo: a.rel,
              linea: t.linea,
              arreglo: "<label htmlFor=\"x\">Nombre</label> + id=\"x\", o envolvé el input en <label>, o aria-label si no hay texto visible.",
            });
          // Tipo de teclado en el celular y autocompletado.
          const nombre = String(atributo(t.attrs, "name") ?? id ?? atributo(t.attrs, "autoComplete") ?? "");
          if (t.nombre === "input" && (!tipo || tipo === "text")) {
            if (/e-?mail|correo/i.test(nombre))
              h.push({ msg: `Campo de email sin type="email": en el celular no aparece el teclado con @ y no se valida el formato.`, archivo: a.rel, linea: t.linea, nivel: "info", arreglo: 'type="email" autoComplete="email"' });
            else if (/phone|tel|celular|whatsapp|movil/i.test(nombre))
              h.push({ msg: `Campo de teléfono sin type="tel": en el celular aparece el teclado de letras.`, archivo: a.rel, linea: t.linea, nivel: "info", arreglo: 'type="tel" autoComplete="tel" inputMode="tel"' });
          }
        }
      }
      return h;
    },
  },
  {
    id: "enlaces-rotos",
    categoria: "Experiencia",
    titulo: "Links internos que existen",
    nivel: "error",
    run(ctx) {
      const existe = rutasExistentes(ctx);
      if (!existe) return [];
      const h = [];
      for (const a of ctx.codigo()) {
        if (!/\.[jt]sx?$/.test(a.rel)) continue;
        const hrefs = [
          ...(/\.[jt]sx$/.test(a.rel) ? etiquetasJsx(a.src, ["a", "Link"]).map((t) => ({ href: atributo(t.attrs, "href"), linea: t.linea })) : []),
          ...[...a.src.matchAll(/\b(?:redirect|permanentRedirect|router\.(?:push|replace))\(\s*["'`](\/[^"'`]*)["'`]/g)].map((m) => ({ href: m[1], linea: lineaDe(a.src, m.index) })),
        ];
        for (const { href, linea } of hrefs) {
          if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) continue;
          const camino = href.split("${")[0].split(/[?#]/)[0];
          if (href.includes("${") && !camino.endsWith("/")) continue; // `/x${y}`: no se puede saber
          const ruta = (camino.replace(/\/$/, "") || "/") + (href.includes("${") ? "/x" : "");
          if (!existe(ruta) && !existe(camino))
            h.push({ msg: `Link a ${camino} y no hay ninguna página en esa ruta: da 404.`, archivo: a.rel, linea, arreglo: "Corregí el href o creá la página." });
        }
      }
      return h;
    },
  },
  {
    id: "fuentes",
    categoria: "Experiencia",
    titulo: "Fuentes sin bloquear la carga",
    nivel: "warn",
    run(ctx) {
      const h = [];
      for (const a of ctx.codigo()) {
        const m = /fonts\.googleapis\.com|use\.typekit\.net|fonts\.bunny\.net/.exec(a.src);
        if (m)
          h.push({
            msg: "Fuente cargada desde un servidor externo: bloquea el primer render, el texto salta al cargar y Google recibe la IP de cada visita.",
            archivo: a.rel,
            linea: lineaDe(a.src, m.index),
            arreglo: 'import { Inter } from "next/font/google" (la descarga en el build y la sirve desde tu dominio) o next/font/local.',
          });
      }
      return h;
    },
  },
];

export default reglas;
