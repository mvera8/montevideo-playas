// Código: errores típicos de vibecoding (secretos expuestos, .env commiteado, console.log, links internos).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { atributo, etiquetasJsx, lineaDe } from "../lib/util.mjs";

const reglas = [
  {
    id: "env-commiteado",
    categoria: "Seguridad",
    titulo: ".env fuera de git",
    nivel: "error",
    run(ctx) {
      const h = [];
      const gi = path.join(ctx.raiz, ".gitignore");
      const reglas = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
      if (!/^\s*\/?\.env/m.test(reglas))
        h.push({ msg: ".gitignore no ignora los .env.", archivo: ".gitignore", arreglo: "Agregá `.env*` y `!.env.example`." });
      try {
        const trackeados = execFileSync("git", ["ls-files", "--", ".env*", "**/.env*"], { cwd: ctx.raiz, encoding: "utf8" })
          .split("\n")
          .filter((f) => f && !/\.env\.(example|sample|template)$/.test(f));
        for (const f of trackeados)
          h.push({ msg: "Archivo .env commiteado: las claves quedaron en el historial de git.", archivo: f, arreglo: "git rm --cached " + f + " y rotá las claves." });
      } catch {
        // no es un repo git: nada que revisar
      }
      return h;
    },
  },
  {
    id: "secreto-publico",
    categoria: "Seguridad",
    titulo: "Secretos con NEXT_PUBLIC_",
    nivel: "error",
    run(ctx) {
      const re = /NEXT_PUBLIC_\w*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)\w*/g;
      const h = [];
      for (const a of ctx.codigo()) {
        for (const m of a.src.matchAll(re))
          h.push({
            msg: `${m[0]} se manda al navegador: cualquiera lo puede leer.`,
            archivo: a.rel,
            linea: lineaDe(a.src, m.index),
            arreglo: "Sacale el prefijo NEXT_PUBLIC_ y usalo solo en el servidor (route handler / server action).",
          });
      }
      return h;
    },
  },
  {
    id: "console-log",
    categoria: "Código",
    titulo: "Sin console.log olvidados",
    nivel: "warn",
    run(ctx) {
      const h = [];
      for (const a of ctx.codigo()) {
        for (const m of a.src.matchAll(/console\.log\(/g)) h.push({ msg: "console.log", archivo: a.rel, linea: lineaDe(a.src, m.index) });
      }
      return h;
    },
  },
  {
    id: "link-interno",
    categoria: "Código",
    titulo: "Links internos con next/link",
    nivel: "warn",
    run(ctx) {
      const h = [];
      for (const a of ctx.codigo()) {
        if (!/\.[jt]sx$/.test(a.rel)) continue;
        for (const t of etiquetasJsx(a.src, ["a"])) {
          const href = atributo(t.attrs, "href");
          if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !/\.\w{2,5}$/.test(href))
            h.push({ msg: `<a href="${href}"> recarga toda la página.`, archivo: a.rel, linea: t.linea, arreglo: "import Link from \"next/link\"" });
        }
      }
      return h;
    },
  },
];

export default reglas;
