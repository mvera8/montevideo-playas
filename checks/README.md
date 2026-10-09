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
| `metadata-paginas` (warn) | Cada `page.tsx` (o su layout) exporta metadata propia, salvo la home (también dentro de un route group); avisa si es `"use client"` |
| `html-lang` (error) | `<html lang="...">` |
| `viewport` (info) | `export const viewport` con `themeColor` (y que no esté en metadata, deprecado) |
| `robots` / `sitemap` (warn) | `app/robots.ts` y `app/sitemap.ts` |
| `open-graph` (warn) | `app/opengraph-image.*` o `openGraph.images` |
| `not-found` (info) | `app/not-found.tsx` propio |
| `sin-png` (warn) | PNG/GIF/BMP en `public/` o `app/` → WebP/AVIF/SVG (excepto íconos que deben ser PNG); JPG de `public/` como info |
| `peso-imagenes` (warn) | Imágenes de `public/` de más de 400 KB |
| `imagenes-sin-uso` (info) | Imágenes de `public/` que no aparecen en el código, CSS ni config (cuenta la carpeta si el nombre es dinámico) |
| `alt` (error) | `<img>` / `<Image>` sin `alt`, o con alt genérico ("imagen", "foto.jpg") |
| `next-image` (warn) | `<img>` crudo en vez de `next/image` |
| `env-commiteado` (error) | `.env*` en `.gitignore` y ningún `.env` trackeado en git |
| `secreto-publico` (error) | `NEXT_PUBLIC_*SECRET*`, `*SERVICE_ROLE*`, `*PRIVATE*`, `*PASSWORD*` (se mandan al navegador) |
| `claves-en-codigo` (error) | Claves secretas escritas en archivos (Stripe, AWS, GitHub, OpenAI, Anthropic, Mercado Pago, Resend, service_role de Supabase, claves privadas) |
| `env-en-historial` (error) | `.env` que alguna vez se commiteó (las claves siguen en el historial aunque hoy esté ignorado) |
| `rls` (error) | Supabase: cada `create table` de las migraciones tiene `enable row level security` |
| `auth-endpoints` (error) | Server actions y route handlers bajo `/admin`, `/dashboard`, `/cuenta`… que no verifican la sesión (el layout no los protege) |
| `rate-limit` (warn) | Endpoints públicos que reciben datos sin límite de pedidos (Upstash, Arcjet, BotID…, o uno propio: `superaLimite(ip)`, respuesta 429); ignora webhooks y crons con firma/secreto |
| `anti-bots` (info) | Formularios públicos (server actions o `FormData`) sin captcha (Turnstile, reCAPTCHA, hCaptcha), BotID ni honeypot (`<input tabIndex={-1}>` oculto); no cuentan las menciones en comentarios |
| `validar-inputs` (warn) | Body guardado tal cual (asignación masiva) o datos que llegan y se escriben sin ninguna validación |
| `inyeccion` (error) | SQL o filtros de PostgREST (`.or()`, `.filter()`) armados con template literals; `$queryRawUnsafe`, `sql.unsafe` |
| `html-sin-sanitizar` (error) | `dangerouslySetInnerHTML` / `innerHTML` sin DOMPurify (JSON-LD con `JSON.stringify` vale) |
| `subida-archivos` (warn) | Subidas de archivos sin controlar tipo y tamaño |
| `datos-de-mas` (info) | `select("*")` en route handlers y componentes cliente (llega al navegador) |
| `cookies-sesion` (error) | Cookies de sesión sin `httpOnly`/`secure`/`sameSite`, sesión en `document.cookie` o tokens en `localStorage` |
| `contrasenas` (error) | Columna de contraseña sin librería de hash, o contraseñas comparadas como texto (salvo "repetir contraseña") |
| `datos-sensibles` (info) | Columnas de tarjeta, CVV, cédula, documento, CBU/IBAN… en el esquema |
| `headers-seguridad` (warn) | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` (next.config, vercel.json o proxy); CSP como info |
| `https` (warn) | URLs `http://` en el código (contenido mixto), salvo localhost y namespaces XML |
| `dependencias` (warn) | `npm audit` / `pnpm audit` de producción: críticas como error, altas como aviso, moderadas como info |
| `console-log` (warn) | `console.log` olvidados |
| `link-interno` (warn) | `<a href="/...">` en vez de `next/link` (salvo `/api/`, route handlers, archivos, `download` o `target`) |
| `error-boundary` (warn) | `app/error.tsx` propio (y `global-error.tsx` como info) |
| `estados-carga` (info) | Páginas `async` sin `loading.tsx` ni `<Suspense>` (salvo estáticas/ISR: `revalidate`, `generateStaticParams`); agrupadas por layout |
| `responsive` (warn) | Viewport que bloquea el zoom y anchos fijos ≥ 480px (`w-[800px]`, `width: 800`) sin variante `sm:`/`md:` |
| `contraste` (warn) | Texto y fondo en el mismo `className` (o sobre el fondo de la página si el archivo no pone fondos) con contraste < 4.5:1 (3:1 texto grande). Entiende colores propios (`--color-x` de Tailwind v4), la paleta de Tailwind, `/opacidad` y ramas de ternarios. Íconos: 3:1 (los `aria-hidden` no se miden). Texto casi invisible sobre el fondo supuesto (p. ej. `text-white` sin fondo en el archivo) se ignora: el fondo lo pone el padre |
| `formularios` (warn) | `<input>`/`<textarea>`/`<select>` sin label (el placeholder no cuenta; los `hidden` y `aria-hidden` no se piden); email y teléfono sin `type` como info |
| `enlaces-rotos` (error) | `href`, `redirect()` y `router.push()` a rutas internas que no existen (páginas, route handlers, `public/` y redirects del next.config) |
| `fuentes` (warn) | Fuentes de Google Fonts / Typekit por `<link>` en vez de `next/font` |
| `legales` (warn) | Páginas de términos (`/terminos`, `/terms`…) y privacidad (`/privacidad`, `/privacy`) |
| `cookies` (warn) | Si hay analytics con cookies (GA, PostHog, Clarity, Meta Pixel) o cookies propias: que la privacidad las mencione; aviso de consentimiento como info |
| `contacto` (warn) | Página de contacto o algún `mailto:`/`tel:`/`wa.me` |
| `textos-relleno` (warn) | Lorem ipsum, `[COMPLETAR]`, correos/teléfonos/dominios de ejemplo (fuera de comentarios) |
| `analytics` (warn) | Algún analytics montado (recomienda Google Analytics 4 con `@next/third-parties`; reconoce también Vercel, PostHog, Plausible, Umami, Fathom, Clarity, Cloudflare…) y que un paquete instalado no quede sin usar. **Error** si está montado detrás de una `NEXT_PUBLIC_*` (ID) que no tiene valor en el entorno ni en `.env`/`.env.local`/`.env.production` |

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
| `url-headers` | Headers de seguridad en la respuesta real, HSTS si es https, `X-Powered-By` |
| `url-https` | http:// redirige a https:// y no hay recursos por http:// (contenido mixto) |
| `url-enlaces` | Los links internos de las páginas revisadas responden (máx. 50) |
| `url-velocidad` | Tiempo de respuesta y peso del HTML comprimido (con `next dev` solo avisa que no es medible) |
| `url-analytics` | El analytics del código carga de verdad: Google Analytics con su ID en la página (si falta la variable en el build no mide); Vercel Analytics activado en el proyecto |
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
`layoutRaiz` (app/layout o el de un route group con `<html>`), `enApp(base, exts)`, `enPublic(nombre)`, `rel(abs)` y
`ruta(abs)` (ruta pública sin route groups: `src/app/(site)/page.tsx` → `/`). Registrala en `cli.mjs`.

## Para la IA

Agregá al `CLAUDE.md` / `AGENTS.md` del proyecto:

```md
Antes de dar por terminado un cambio de UI, páginas o imágenes, corré `npm run checks` y arreglá los
errores. Si el sitio está levantado, también `npm run checks:url`.
```
