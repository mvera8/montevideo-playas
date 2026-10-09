// Código: errores típicos de vibecoding (secretos expuestos, .env commiteado, console.log, links internos).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { atributo, etiquetasJsx, lineaDe, recorrer } from "../lib/util.mjs";

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
      // Route handlers (`app/**/route.ts`): devuelven archivos, JSON o redirecciones, no páginas;
      // ahí un <a> común es lo correcto (descargas, /api/auth/logout, /feed.xml…).
      const handlers = ctx.appDir
        ? recorrer(ctx.appDir, [".ts", ".js", ".tsx", ".jsx"])
            .filter((f) => /^route\.[jt]sx?$/.test(path.basename(f)))
            .map((f) => new RegExp(`^${ctx.ruta(f).replace(/\[\[?\.\.\.[^\]]+\]\]?/g, ".*").replace(/\[[^\]]+\]/g, "[^/]+")}/?$`))
        : [];
      const h = [];
      for (const a of ctx.codigo()) {
        if (!/\.[jt]sx$/.test(a.rel)) continue;
        for (const t of etiquetasJsx(a.src, ["a"])) {
          const href = atributo(t.attrs, "href");
          if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) continue;
          // `download` / `target`: es a propósito que no navegue dentro de la app.
          if (atributo(t.attrs, "download") !== undefined || atributo(t.attrs, "target") !== undefined) continue;
          // En un template literal solo se puede juzgar la parte fija (`/api/x?${q}` → /api/x).
          const camino = href.split("${")[0].split(/[?#]/)[0];
          if (/\.\w{2,5}$/.test(camino) || /^\/api(\/|$)/.test(camino) || handlers.some((re) => re.test(camino))) continue;
          h.push({ msg: `<a href="${href}"> recarga toda la página.`, archivo: a.rel, linea: t.linea, arreglo: "import Link from \"next/link\"" });
        }
      }
      return h;
    },
  },
];

export default reglas;
