// Analytics: que el sitio mida visitas, y que el paquete instalado esté realmente montado.
import fs from "node:fs";
import path from "node:path";

// paquete → cómo se ve en el código cuando está montado. `null` en paquete = se carga con un <script>.
const PROVEEDORES = [
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

/** Variables definidas con valor en el entorno o en los .env del proyecto (como las carga Next). */
function envDefinidas(raiz) {
  const vars = new Set(Object.keys(process.env).filter((k) => process.env[k]));
  for (const f of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    try {
      for (const m of fs.readFileSync(path.join(raiz, f), "utf8").matchAll(/^\s*(?:export\s+)?(\w+)\s*=\s*["']?([^"'#\s]*)/gm)) if (m[2]) vars.add(m[1]);
    } catch {
      // no existe
    }
  }
  return vars;
}

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
      const env = envDefinidas(ctx.raiz);
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
              arreglo: `Definí ${v} en .env.local y en Vercel (Settings → Environment Variables, Production). Si ya está en Vercel, sumalo a .env.local para que este chequeo lo vea.`,
            });
        }
      }
      if (!montados.length && !sinMontar.length) {
        h.push({
          msg: "El sitio no tiene analytics: no vas a saber cuántas visitas tiene ni de dónde llegan.",
          arreglo:
            'En Vercel: npm i @vercel/analytics y en app/layout.tsx <Analytics /> (import de "@vercel/analytics/next"); activalo en el panel del proyecto. Sumá también @vercel/speed-insights para medir Core Web Vitals. Acordate de mencionarlo en la política de privacidad.',
        });
      }
      return h;
    },
  },
  {
    id: "speed-insights",
    categoria: "Analytics",
    titulo: "Rendimiento real (Core Web Vitals)",
    nivel: "info",
    run(ctx) {
      // Solo tiene sentido sugerirlo en sitios que ya usan Vercel Analytics o van a Vercel.
      const enVercel = dependencias(ctx.raiz)["@vercel/analytics"] || fs.existsSync(path.join(ctx.raiz, ".vercel")) || fs.existsSync(path.join(ctx.raiz, "vercel.json"));
      if (!enVercel) return [];
      if (ctx.codigo().some((a) => /from\s+["']@vercel\/speed-insights[^"']*["']/.test(a.src))) return [];
      return [
        {
          msg: "Sin Speed Insights: no ves cómo carga el sitio en los celulares de la gente.",
          arreglo: 'npm i @vercel/speed-insights y <SpeedInsights /> (import de "@vercel/speed-insights/next") en app/layout.tsx.',
        },
      ];
    },
  },
];

export default reglas;
