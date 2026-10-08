# next-checks

Chequeos de calidad para sitios **Next.js (App Router)**. Sin dependencias: solo Node ≥ 18.
Pensado para copiar a cada proyecto nuevo y correr antes de publicar (o pedirle a la IA que lo corra
y arregle lo que salga).

## Instalar en un proyecto

1. Copiá la carpeta `checks/` a la raíz del proyecto.
2. Agregá los scripts a `package.json`:

   ```bash
   node checks/cli.mjs init
   ```

   Eso agrega:

   ```json
   "checks": "node checks/cli.mjs",
   "checks:url": "node checks/cli.mjs --url http://localhost:3000"
   ```

3. Correlo:

   ```bash
   npm run checks          # análisis estático del código (rápido, no necesita el sitio levantado)
   npm run checks:url      # además revisa el HTML real (con `npm run dev` o `next start` corriendo)
   ```

> Alternativa como paquete: `npm i -D ./checks` (o, si lo subís a GitHub, `npm i -D github:usuario/next-checks`)
> y el script queda `"checks": "next-checks"`.

Sale con código 1 si hay errores, así que sirve en CI o como `"prebuild": "npm run checks"`.

## Qué revisa

`node checks/cli.mjs --lista` muestra todas. Nivel por defecto entre paréntesis.

**Análisis estático**

| Regla | Qué revisa |
| --- | --- |
| `favicon` (error) | `app/favicon.ico`, `app/icon.*` o `public/favicon.ico` |
| `apple-icon` (error) | Ícono de "Agregar a inicio" del iPhone: `app/apple-icon.png` de 180×180 |
| `manifest` (warn) | `app/manifest.ts` con name, short_name, start_url, display, colores e íconos 192/512 |
| `metadata-raiz` (error) | title, description, `metadataBase`, `title.template` y largos de title (10–60) / description (50–160) |
| `metadata-paginas` (warn) | Cada `page.tsx` (o su layout) exporta metadata propia; avisa si es `"use client"` |
| `html-lang` (error) | `<html lang="...">` |
| `viewport` (info) | `export const viewport` con `themeColor` (y que no esté en metadata, deprecado) |
| `robots` / `sitemap` (warn) | `app/robots.ts` y `app/sitemap.ts` |
| `open-graph` (warn) | `app/opengraph-image.*` o `openGraph.images` |
| `not-found` (info) | `app/not-found.tsx` propio |
| `sin-png` (warn) | PNG/GIF/BMP en `public/` o `app/` → WebP/AVIF/SVG (excepto íconos que deben ser PNG); JPG de `public/` como info |
| `peso-imagenes` (warn) | Imágenes de `public/` de más de 400 KB |
| `alt` (error) | `<img>` / `<Image>` sin `alt`, o con alt genérico ("imagen", "foto.jpg") |
| `next-image` (warn) | `<img>` crudo en vez de `next/image` |
| `env-commiteado` (error) | `.env*` en `.gitignore` y ningún `.env` trackeado en git |
| `secreto-publico` (error) | `NEXT_PUBLIC_*SECRET*`, `*SERVICE_ROLE*`, `*PRIVATE*`, `*PASSWORD*` (se mandan al navegador) |
| `console-log` (warn) | `console.log` olvidados |
| `link-interno` (warn) | `<a href="/...">` en vez de `next/link` |
| `error-boundary` (warn) | `app/error.tsx` propio (y `global-error.tsx` como info) |
| `estados-carga` (info) | Páginas `async` sin `loading.tsx` ni `<Suspense>` (salvo estáticas/ISR: `revalidate`, `generateStaticParams`) |
| `responsive` (warn) | Viewport que bloquea el zoom y anchos fijos ≥ 480px (`w-[800px]`, `width: 800`) sin variante `sm:`/`md:` |
| `legales` (warn) | Páginas de términos (`/terminos`, `/terms`…) y privacidad (`/privacidad`, `/privacy`) |
| `cookies` (warn) | Si hay analytics con cookies (GA, PostHog, Clarity, Meta Pixel) o cookies propias: que la privacidad las mencione; aviso de consentimiento como info |
| `contacto` (warn) | Página de contacto o algún `mailto:`/`tel:`/`wa.me` |
| `textos-relleno` (warn) | Lorem ipsum, `[COMPLETAR]`, correos/teléfonos/dominios de ejemplo (fuera de comentarios) |
| `analytics` (warn) | Algún analytics montado (Vercel, Google, PostHog, Plausible, Umami, Fathom, Clarity, Cloudflare…) y que un paquete instalado no quede sin usar. **Error** si está montado detrás de una `NEXT_PUBLIC_*` (ID) que no tiene valor en el entorno ni en `.env`/`.env.local`/`.env.production` |
| `speed-insights` (info) | En proyectos de Vercel, `<SpeedInsights />` para medir Core Web Vitals reales |

**Con `--url`** (revisa el HTML servido; páginas del `sitemap.xml`, máx. 20, o `--paginas /,/contacto`)

| Regla | Qué revisa |
| --- | --- |
| `url-estado` | Cada página responde 200 |
| `url-titulo` | `<title>` y meta description presentes y con buen largo |
| `url-duplicados` | Títulos y descripciones no repetidos entre páginas |
| `url-open-graph` | og:title/description/image/url, twitter:card, og:image absoluta (no localhost), canonical |
| `url-h1` | Exactamente un `<h1>` por página |
| `url-alt` | `<img>` renderizados sin alt (incluye los que vienen de librerías o CMS) |
| `url-iconos` | favicon, apple-touch-icon, manifest y og:image responden 200; manifest con 192/512; lang y viewport |
| `url-404` | Una ruta inexistente responde 404 (no 200) y no es el 404 genérico de Next |
| `url-responsive` | `<meta name="viewport">` con `width=device-width` y sin bloquear el zoom |
| `url-robots-sitemap` | `/robots.txt` y `/sitemap.xml` responden, robots apunta al sitemap y no bloquea todo |

## Opciones

```
--url <base>        revisar además el sitio corriendo
--paginas /,/x      rutas a revisar en modo --url
--max 20            tope de páginas tomadas del sitemap
--solo id,id        correr solo esas reglas
--json              salida JSON (CI, o para pegarle a la IA)
--estricto          los avisos también hacen fallar
--lista             listar reglas
```

## Silenciar un caso puntual

En la línea anterior al hallazgo:

```tsx
{/* next-checks-ignore next-image -- blob local, no pasa por next/image */}
<img src={blobUrl} alt="Vista previa" />
```

Sin ids (`next-checks-ignore`) silencia todas las reglas para esa línea. También se respetan los
`eslint-disable-next-line` equivalentes (`no-img-element`, `no-html-link-for-pages`, `no-console`).

## Config (opcional)

`checks.config.mjs` en la raíz del proyecto (ver `checks.config.example.mjs`):

```js
export default {
  reglas: {
    "console-log": "off",                                   // apagar
    "next-image": "error",                                  // cambiar nivel
    "sin-png": { ignorar: ["public/screenshots/**"] },      // ignorar archivos para una regla
  },
  ignorar: ["src/legacy/**"],    // archivos de código que ninguna regla revisa
  permitirPng: ["public/maplibre/**"],
  maxKbImagen: 400,
  url: "http://localhost:3000",  // para no pasar --url cada vez
  paginas: ["/", "/contacto"],
};
```

## Agregar una regla

Cada archivo de `reglas/` exporta un array de reglas:

```js
{
  id: "mi-regla",
  categoria: "SEO",
  titulo: "Lo que se ve en el reporte",
  nivel: "warn",                 // error | warn | info
  run(ctx) {                     // puede ser async
    return [{ msg: "Qué está mal", archivo: "src/app/x.tsx", linea: 3, arreglo: "Cómo arreglarlo" }];
  },
}
```

`ctx` trae `raiz`, `appDir`, `publicDir`, `config`, `codigo()` (archivos de código con su texto),
`layoutRaiz`, `enApp(base, exts)`, `enPublic(nombre)` y `rel(abs)`. Registrala en `cli.mjs`.

## Para la IA

Agregá al `CLAUDE.md` / `AGENTS.md` del proyecto:

```md
Antes de dar por terminado un cambio de UI, páginas o imágenes, corré `npm run checks` y arreglá los
errores. Si el sitio está levantado, también `npm run checks:url`.
```
