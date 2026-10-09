// Analytics: que el sitio mida visitas, y que el paquete instalado esté realmente montado.
import fs from "node:fs";
import path from "node:path";
import { variablesEnv } from "../lib/util.mjs";

// paquete → cómo se ve en el código cuando está montado. `null` en paquete = se carga con un <script>.
export const PROVEEDORES = [
  { nombre: "Vercel Analytics", paquete: "@vercel/analytics", uso: /from\s+["']@vercel\/analytics[^"']*["']/ },
  { nombre: "Google Analytics (@next/third-parties)", paquete: "@next/third-parties", uso: /<Google(Analytics|TagManager)\b/ },
  { nombre: "PostHog", paquete: "posthog-js", uso: /posthog\.init\(|PostHogProvider/ },
  { nombre: "Plausible", paquete: "next-plausible", uso: /PlausibleProvider|plausible\.io\/js/ },
  { nombre: "Umami", paquete: null, uso: /umami\.is|data-website-id/ },
  { nombre: "Google Analytics (gtag)", paquete: null, uso: /googletagmanager\.com\/(gtag|gtm)/ },
  { nombre: "Fathom", paquete: "fathom-client", uso: /usefathom\.com|Fathom\.load\(/ },
  { nombre: "Microsoft Clarity", paquete: null, uso: /clarity\.ms/ },
  { nombre: "Cloudflare Web Analytics", paquete: null, uso: /static\.cloudflareinsights\.com/ },
  { nombre: "Simple Analytics", paquete: null, uso: /simpleanalyticscdn\.com/ },
];

function dependencias(raiz) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

const reglas = [
  {
    id: "analytics",
    categoria: "Analytics",
    titulo: "Medición de visitas",
    nivel: "warn",
    run(ctx) {
      const deps = dependencias(ctx.raiz);
      const codigo = ctx.codigo();
      const montados = PROVEEDORES.filter((p) => codigo.some((a) => p.uso.test(a.src)));
      const sinMontar = PROVEEDORES.filter((p) => p.paquete && deps[p.paquete] && !montados.includes(p));

      const h = sinMontar.map((p) => ({
        msg: `${p.nombre} está instalado (${p.paquete}) pero no se usa en el código: no mide nada.`,
        archivo: "package.json",
        arreglo:
          p.paquete === "@vercel/analytics"
            ? 'En app/layout.tsx: import { Analytics } from "@vercel/analytics/next" y <Analytics /> dentro de <body>.'
            : "Montalo en app/layout.tsx según la guía del proveedor.",
      }));
      // Montado pero condicionado a una variable (p. ej. {GA_ID && <GoogleAnalytics />}) que no está
      // definida: el código está, pero en este entorno no mide nada.
      const env = variablesEnv(ctx.raiz);
      for (const p of montados) {
        for (const a of codigo.filter((a) => p.uso.test(a.src))) {
          const faltan = [...new Set([...a.src.matchAll(/process\.env\.(NEXT_PUBLIC_\w+)/g)].map((m) => m[1]))].filter(
            (v) => /ID|KEY|TOKEN|SITE|DOMAIN|ANALYTICS|GA|GTM|POSTHOG|UMAMI|PLAUSIBLE|CLARITY/.test(v) && !env.has(v),
          );
          for (const v of faltan)
            h.push({
              msg: `${p.nombre} está montado pero ${v} no tiene valor: no se carga y no mide nada.`,
              archivo: a.rel,
              nivel: "error",
              arreglo: `Definí ${v} en .env.local y en las variables de entorno del hosting (Production), y volvé a hacer el deploy. Si ya está en el hosting, sumalo a .env.local para que este chequeo lo vea.`,
            });
        }
      }
      if (!montados.length && !sinMontar.length) {
        h.push({
          msg: "El sitio no tiene analytics: no vas a saber cuántas visitas tiene ni de dónde llegan.",
          arreglo:
            'Google Analytics 4: npm i @next/third-parties; en app/layout.tsx {process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />} (import de "@next/third-parties/google"); NEXT_PUBLIC_GA_ID=G-XXXXXXX en .env.local y en el hosting. GA usa cookies: mencionalo en las políticas de privacidad y de cookies.',
        });
      }
      // Lo que el código no puede saber: si el proveedor está activado. Eso lo confirma url-analytics.
      for (const p of montados.filter((p) => p.nombre === "Vercel Analytics"))
        h.push({ msg: `${p.nombre} no usa ID: mide solo si está activado en el panel de Vercel.`, nivel: "info", arreglo: "Confirmalo con npm run checks -- --url https://tu-sitio (regla url-analytics)." });
      return h;
    },
  },
];

export default reglas;
