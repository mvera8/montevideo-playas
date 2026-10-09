// Seguridad: lo que un sitio hecho rápido suele dejar abierto (claves en el código, endpoints sin login
// ni límite, inyección, RLS, headers, dependencias con vulnerabilidades).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { atributo, etiquetasJsx, lineaDe, recorrer, sinComentarios } from "../lib/util.mjs";

const RUTA_PRIVADA = /(^|\/)(admin|dashboard|panel|cuenta|account|backoffice|interno|internal)(\/|$)/i;
// Alguna verificación de identidad o firma en el archivo: sesión, helper `requireX()`, secreto de cron, firma de webhook.
const AUTH = /\bauth\(|getServerSession|getSession\(|getUser\(|getClaims\(|currentUser\(|\brequire[A-Z]\w*\(|\bverify\w*\(|signature|CRON_SECRET|authorization|isAdmin|checkAuth|withAuth|clerk|lucia|betterAuth/i;
const RATE_LIMIT = /ratelimit|rate-limit|rate_limit|rateLimit|RateLimiter|@arcjet|botid/i;
// Límite hecho a mano en el propio endpoint (`if (superaLimite(ip))`, respuesta 429).
const LIMITE_PROPIO = /\b\w*l[ií]mite\w*\(|status:\s*429\b|tooManyRequests/i;
const ANTI_BOT = /turnstile|recaptcha|hcaptcha|captcha|honeypot|botid|@arcjet|checkBot/i;
const VALIDACION = /from\s+["'](zod|valibot|yup|joi|superstruct|arktype|@sinclair\/typebox|class-validator)["']|safeParse|\.parse\(|typeof\s+\w|Number\.is(Finite|Integer)|:\s*unknown\b|\.test\(|\bString\(|\bNumber\(|parseInt|parseFloat/;
const ESCRIBE_DB = /\.(insert|update|upsert|create|createMany|updateMany)\(|\.rpc\(|\bINSERT\s+INTO|\bUPDATE\s+\w+\s+SET/i;

/**
 * Endpoints que reciben datos: route handlers (con el método que exportan) y archivos "use server".
 * `ruta` es la URL (para handlers) o la carpeta (para actions); `privado` si vive bajo /admin y similares.
 */
function endpoints(ctx) {
  const salida = [];
  for (const a of ctx.codigo()) {
    const base = path.basename(a.rel);
    if (/^route\.[jt]s$/.test(base) && ctx.appDir && a.abs.startsWith(ctx.appDir)) {
      const metodos = [...a.src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
      salida.push({ ...a, tipo: "handler", ruta: ctx.ruta(a.abs), metodos, muta: metodos.some((m) => m !== "GET") });
    } else if (/^\s*["']use server["']/.test(a.src)) {
      salida.push({ ...a, tipo: "action", ruta: ctx.appDir && a.abs.startsWith(ctx.appDir) ? ctx.ruta(a.abs) : a.rel, metodos: ["action"], muta: true });
    }
  }
  return salida.map((e) => ({ ...e, privado: RUTA_PRIVADA.test(e.ruta) || RUTA_PRIVADA.test(e.rel) }));
}

/**
 * Campo trampa (honeypot) en algún formulario: `<input>` sacado del orden de tabulación y oculto
 * (`tabIndex={-1}` + `hidden`/`aria-hidden`/`sr-only`/fuera de pantalla).
 */
function tieneHoneypot(ctx) {
  return ctx.codigo().some(
    (a) =>
      /\.[jt]sx$/.test(a.rel) &&
      etiquetasJsx(a.src, ["input"]).some((t) => /tabIndex=\{?\s*["']?-1/.test(t.attrs) && (atributo(t.attrs, "aria-hidden") !== undefined || /\b(hidden|sr-only|-left-\[?\d{3,})/.test(atributo(t.attrs, "className") ?? ""))),
  );
}

/** El proxy/middleware cubre la ruta si la nombra y verifica sesión. */
function proxyProtege(ctx, ruta) {
  for (const nombre of ["proxy", "middleware"])
    for (const dir of ["src", "."])
      for (const ext of ["ts", "js"]) {
        const f = path.join(ctx.raiz, dir, `${nombre}.${ext}`);
        if (!fs.existsSync(f)) continue;
        const src = fs.readFileSync(f, "utf8");
        const seg = ruta.split("/").filter(Boolean)[0];
        if (seg && src.includes(`/${seg}`) && AUTH.test(src)) return true;
      }
  return false;
}

function dependencias(raiz) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

/** Archivos de texto trackeados en git más el código (aunque todavía no esté commiteado), para buscar claves. */
function archivosTexto(ctx) {
  const vistos = new Set();
  return [...trackeados(ctx), ...ctx.codigo()].filter((a) => !vistos.has(a.rel) && vistos.add(a.rel));
}

function trackeados(ctx) {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: ctx.raiz, encoding: "utf8", maxBuffer: 50e6 })
      .split("\0")
      .filter((f) => f && !/(^|\/)(node_modules|checks)\//.test(f) && /\.(m?[jt]sx?|json|ya?ml|toml|md|mdx|env\w*|sql|py|sh|txt|html)$|(^|\/)\.env/.test(f) && !/(package-lock|pnpm-lock|yarn)\b/.test(f))
      .map((rel) => ({ rel, abs: path.join(ctx.raiz, rel) }))
      .filter((a) => fs.existsSync(a.abs) && fs.statSync(a.abs).size < 1e6)
      .map((a) => ({ ...a, src: fs.readFileSync(a.abs, "utf8") }));
  } catch {
    return [];
  }
}

// Formatos de claves secretas reconocibles. Las públicas por diseño (Stripe pk_, anon de Supabase,
// public key de Mercado Pago) no están.
const CLAVES = [
  { nombre: "Stripe secret key", re: /\b[sr]k_live_[0-9a-zA-Z]{20,}/ },
  { nombre: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { nombre: "Clave privada", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { nombre: "Token de GitHub", re: /\bgh[pousr]_[0-9a-zA-Z]{36}\b/ },
  { nombre: "Token de Slack", re: /\bxox[baprs]-[0-9a-zA-Z-]{10,}/ },
  { nombre: "Clave de Anthropic", re: /\bsk-ant-[0-9a-zA-Z_-]{20,}/ },
  { nombre: "Clave de OpenAI", re: /\bsk-(?!ant-)(proj-)?[0-9a-zA-Z_-]{40,}/ },
  { nombre: "Access token de Mercado Pago", re: /\bAPP_USR-\d{10,}-\d{6}-[0-9a-f]{32}-\d{6,}\b/ },
  { nombre: "Clave de Resend", re: /\bre_[0-9a-zA-Z]{8}_[0-9a-zA-Z]{20,}/ },
  { nombre: "Clave de SendGrid", re: /\bSG\.[0-9a-zA-Z_-]{22}\.[0-9a-zA-Z_-]{43}\b/ },
];

/** JWT de Supabase con role service_role (salta RLS). */
function esServiceRole(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).role === "service_role";
  } catch {
    return false;
  }
}

/** Archivos de esquema de base de datos: migraciones SQL, Prisma y Drizzle. */
function esquemas(ctx) {
  const dirs = ["supabase/migrations", "migrations", "db", "prisma", "drizzle", "sql", "src/db", "src/lib/db"];
  return [...new Set(dirs.flatMap((d) => recorrer(path.join(ctx.raiz, d), [".sql", ".prisma", ".ts"])))]
    .map((abs) => ({ abs, rel: ctx.rel(abs), src: fs.readFileSync(abs, "utf8") }))
    .filter((a) => !a.rel.endsWith(".ts") || /pgTable|mysqlTable|sqliteTable/.test(a.src));
}

const reglas = [
  {
    id: "claves-en-codigo",
    categoria: "Seguridad",
    titulo: "Sin claves secretas en el código",
    nivel: "error",
    run(ctx) {
      const h = [];
      for (const a of archivosTexto(ctx)) {
        if (/\.env\.(example|sample|template)$/.test(a.rel)) continue;
        for (const { nombre, re } of CLAVES) {
          const m = new RegExp(re.source, "g").exec(a.src);
          if (m) h.push({ msg: `${nombre} escrita en el archivo: cualquiera con acceso al repo la puede usar.`, archivo: a.rel, linea: lineaDe(a.src, m.index), arreglo: "Movela a una variable de entorno (.env.local y Vercel) y rotala: ya quedó en el historial de git." });
        }
        for (const m of a.src.matchAll(/\beyJ[0-9a-zA-Z_-]{10,}\.eyJ[0-9a-zA-Z_-]{20,}\.[0-9a-zA-Z_-]{20,}/g))
          if (esServiceRole(m[0]))
            h.push({ msg: "service_role key de Supabase escrita en el archivo: salta todas las políticas RLS.", archivo: a.rel, linea: lineaDe(a.src, m.index), arreglo: "Movela a SUPABASE_SERVICE_ROLE_KEY (sin NEXT_PUBLIC_) y rotala desde el panel de Supabase." });
      }
      return h;
    },
  },
  {
    id: "env-en-historial",
    categoria: "Seguridad",
    titulo: "Sin .env en el historial de git",
    nivel: "error",
    run(ctx) {
      let salida;
      try {
        salida = execFileSync("git", ["log", "--all", "--diff-filter=A", "--name-only", "--format=%h", "--", ".env*", "**/.env*"], { cwd: ctx.raiz, encoding: "utf8" });
      } catch {
        return [];
      }
      const h = [];
      let commit;
      for (const linea of salida.split("\n").filter(Boolean)) {
        if (/^[0-9a-f]{7,}$/.test(linea)) commit = linea;
        else if (!/\.env\.(example|sample|template)$/.test(linea))
          h.push({ msg: `Estuvo commiteado en ${commit}: aunque hoy esté en .gitignore, las claves siguen en el historial.`, archivo: linea, arreglo: "Rotá todas las claves que tenía (es lo único que sirve si el repo se compartió). Opcional: limpiar el historial con git filter-repo." });
      }
      return h;
    },
  },
  {
    id: "rls",
    categoria: "Seguridad",
    titulo: "Row Level Security en todas las tablas",
    nivel: "error",
    run(ctx) {
      const sql = esquemas(ctx).filter((a) => a.rel.endsWith(".sql"));
      // Solo aplica a Supabase / Postgres expuesto por API (PostgREST).
      if (!sql.length || !(fs.existsSync(path.join(ctx.raiz, "supabase")) || dependencias(ctx.raiz)["@supabase/supabase-js"])) return [];
      const todo = sql.map((a) => a.src).join("\n");
      const h = [];
      for (const a of sql)
        for (const m of a.src.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?(\w+)"?/gi)) {
          const t = m[1];
          if (!new RegExp(`alter\\s+table\\s+(?:only\\s+)?(?:"?public"?\\.)?"?${t}"?\\s+enable\\s+row\\s+level\\s+security`, "i").test(todo))
            h.push({
              msg: `La tabla ${t} no tiene RLS: con la anon key (que está en el navegador) cualquiera la lee y la modifica.`,
              archivo: a.rel,
              linea: lineaDe(a.src, m.index),
              arreglo: `alter table public.${t} enable row level security; y políticas solo para lo que tenga que ser público.`,
            });
        }
      return h;
    },
  },
  {
    id: "auth-endpoints",
    categoria: "Seguridad",
    titulo: "Endpoints privados con login",
    nivel: "error",
    run(ctx) {
      // El layout del panel protege las páginas, pero NO las server actions ni los route handlers:
      // se pueden llamar directo. Cada uno tiene que verificar la sesión.
      return endpoints(ctx)
        .filter((e) => e.privado && !AUTH.test(e.src) && !(e.tipo === "handler" && proxyProtege(ctx, e.ruta)))
        .filter((e) => !/\/login|\/signin|\/ingresar|\/auth\//i.test(e.rel))
        .map((e) => ({
          msg: e.tipo === "action" ? "Server actions de una zona privada sin verificar la sesión: se pueden llamar sin estar logueado." : `${e.metodos.join("/")} ${e.ruta} es privado y no verifica la sesión.`,
          archivo: e.rel,
          arreglo: "Al principio de cada función: const user = await requireAdmin() (o el helper de auth del proyecto).",
        }));
    },
  },
  {
    id: "rate-limit",
    categoria: "Seguridad",
    titulo: "Límite de pedidos en endpoints públicos",
    nivel: "warn",
    run(ctx) {
      if (RATE_LIMIT.test(Object.keys(dependencias(ctx.raiz)).join(" ")) || ctx.codigo().some((a) => RATE_LIMIT.test(sinComentarios(a.src)))) return [];
      // Webhooks y crons ya verifican firma/secreto: no los puede llamar cualquiera. Los que tienen su
      // propio límite (función `superaLimite(ip)`, respuesta 429) tampoco cuentan.
      const publicos = endpoints(ctx).filter((e) => e.muta && !e.privado && !/signature|CRON_SECRET|authorization/i.test(e.src) && !LIMITE_PROPIO.test(sinComentarios(e.src)));
      if (!publicos.length) return [];
      return [
        {
          msg: `${publicos.length} endpoint(s) públicos sin límite de pedidos (${publicos.map((e) => (e.tipo === "handler" ? `${e.metodos.filter((m) => m !== "GET").join("/")} ${e.ruta}` : e.rel)).join(", ")}): un script puede llamarlos miles de veces (spam, costos, fuerza bruta en login).`,
          arreglo: "Vercel: Firewall → Rate limiting (sin código) o @upstash/ratelimit por IP en cada endpoint. Login: Supabase/Auth.js ya limitan intentos, revisá que esté activo.",
        },
      ];
    },
  },
  {
    id: "anti-bots",
    categoria: "Seguridad",
    titulo: "Formularios públicos protegidos de bots",
    nivel: "info",
    run(ctx) {
      // Sin comentarios: "si llega spam, sumar Turnstile" no es tener Turnstile.
      if (ctx.codigo().some((a) => ANTI_BOT.test(sinComentarios(a.src))) || ANTI_BOT.test(Object.keys(dependencias(ctx.raiz)).join(" ")) || tieneHoneypot(ctx)) return [];
      // Solo lo que recibe formularios (server actions o FormData); una API JSON no es un formulario.
      const publicos = endpoints(ctx).filter(
        (e) => e.muta && !e.privado && (e.tipo === "action" || /formData|FormData/.test(e.src)) && !/signature|CRON_SECRET|authorization/i.test(e.src) && !/\/login|\/signin|\/auth\//i.test(e.rel),
      );
      if (!publicos.length) return [];
      return [
        {
          msg: `Formularios públicos sin captcha ni honeypot (${publicos.map((e) => e.ruta).join(", ")}): los bots pueden llenarlos solos.`,
          arreglo: "Cloudflare Turnstile (gratis, invisible) o Vercel BotID; como mínimo un campo honeypot oculto que, si viene lleno, se descarta.",
        },
      ];
    },
  },
  {
    id: "validar-inputs",
    categoria: "Seguridad",
    titulo: "Datos validados antes de guardarlos",
    nivel: "warn",
    run(ctx) {
      const h = [];
      for (const e of endpoints(ctx)) {
        // Asignación masiva: el body entero va directo a la base (pueden mandar role, price, user_id…).
        const masiva = /\.(insert|update|upsert|create)\(\s*(?:\{\s*(?:data\s*:\s*)?\.\.\.)?\s*(await\s+\w+\.json\(\)|body|payload|input|Object\.fromEntries\()/.exec(e.src);
        if (masiva)
          h.push({
            msg: "Se guarda el body tal cual llega: alguien puede agregar campos que no debería tocar (role, precio, user_id).",
            archivo: e.rel,
            linea: lineaDe(e.src, masiva.index),
            arreglo: "Armá el objeto campo por campo, o validalo con un schema (zod: z.object({...}).strict()).",
          });
        // Webhooks y crons con firma/secreto: los datos vienen de un servicio de confianza.
        else if (/\.json\(\)|formData|FormData/.test(e.src) && ESCRIBE_DB.test(e.src) && !VALIDACION.test(e.src) && !/signature|CRON_SECRET/i.test(e.src))
          h.push({
            msg: "Recibe datos y escribe en la base sin validarlos (tipo, largo, formato).",
            archivo: e.rel,
            arreglo: "Validá con zod/valibot (safeParse) o al menos con chequeos de tipo y largo antes de guardar.",
          });
      }
      return h;
    },
  },
  {
    id: "inyeccion",
    categoria: "Seguridad",
    titulo: "Consultas parametrizadas",
    nivel: "error",
    run(ctx) {
      // SQL crudo o filtros de PostgREST (.or/.filter) armados con texto: el usuario puede meter
      // comas y paréntesis y agregar condiciones propias.
      const RE = /(\.(?:or|filter|textSearch)\(\s*`|\$(?:queryRaw|executeRaw)Unsafe\(\s*`?|\bsql\.unsafe\(\s*`?|\.(?:query|execute|raw)\(\s*`)((?:[^`\\]|\\.)*)`?/g;
      const SEGURO = /^\s*(?:[\w.]+\.toISOString\(\)|Number\([^)]*\)|\d+|[\w.]+\.length|[A-Z_]+)\s*$/;
      const h = [];
      for (const a of ctx.codigo()) {
        for (const m of a.src.matchAll(RE)) {
          // Sin backtick inicial (`$queryRawUnsafe(query)`) no hay template que mirar: el grupo 2 sería código ajeno.
          const cuerpo = m[1].endsWith("`") ? (m[2] ?? "") : "";
          const exprs = [...cuerpo.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1]);
          if (!/Unsafe|unsafe/.test(m[1]) && (!exprs.length || exprs.every((x) => SEGURO.test(x)))) continue;
          h.push({
            msg: `Consulta armada con texto (${m[1].replace(/\s+/g, "").replace(/`$/, "")}…\${${exprs[0] ?? "…"}}): si ese valor viene del usuario, puede inyectar condiciones.`,
            archivo: a.rel,
            linea: lineaDe(a.src, m.index),
            arreglo: "Usá los métodos con parámetros (.ilike(col, `%${q}%`), .eq(), sql`...${x}` con tagged template) o escapá , ( ) . y % del valor antes de meterlo en .or().",
          });
        }
      }
      return h;
    },
  },
  {
    id: "html-sin-sanitizar",
    categoria: "Seguridad",
    titulo: "HTML insertado sanitizado",
    nivel: "error",
    run(ctx) {
      const h = [];
      for (const a of ctx.codigo()) {
        for (const m of a.src.matchAll(/dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:\s*([^}]*)\}\}|\.innerHTML\s*\+?=(?!=)\s*([^;\n]+)/g)) {
          const valor = (m[1] ?? m[2]).trim();
          // JSON-LD con JSON.stringify, strings literales y valores ya sanitizados: ok.
          if (/JSON\.stringify|sanitiz|purify|DOMPurify|xss|^["'`][^$]*["'`]$/i.test(valor)) continue;
          h.push({
            msg: `HTML insertado sin sanitizar (${valor.slice(0, 40)}): si tiene texto de usuarios o de un CMS, pueden meter <script> (XSS).`,
            archivo: a.rel,
            linea: lineaDe(a.src, m.index),
            arreglo: "Pasalo por DOMPurify (isomorphic-dompurify) o renderizá el texto como JSX/markdown.",
          });
        }
      }
      return h;
    },
  },
  {
    id: "subida-archivos",
    categoria: "Seguridad",
    titulo: "Archivos subidos con tipo y tamaño controlados",
    nivel: "warn",
    run(ctx) {
      const h = [];
      for (const a of ctx.codigo()) {
        const m = /instanceof\s+File\b|\.upload\(|formData\.get\([^)]*\)\s+as\s+File|type\s*=\s*["']file["']/.exec(a.src);
        if (!m) continue;
        // En el cliente alcanza con `accept`: el tamaño solo se puede hacer cumplir en el servidor.
        const cliente = /^\s*["']use client["']/.test(a.src) || (/\.[jt]sx$/.test(a.rel) && !/^\s*["']use server["']/.test(a.src) && /type\s*=\s*["']file["']/.test(m[0]));
        if (cliente) {
          if (!/accept\s*=/.test(a.src))
            h.push({ msg: "<input type=\"file\"> sin accept: el selector deja elegir cualquier archivo.", archivo: a.rel, linea: lineaDe(a.src, m.index), nivel: "info", arreglo: 'accept="image/webp,image/jpeg" (o las extensiones que esperás). Igual validá en el servidor.' });
          continue;
        }
        const tipo = /\.type\b|mimetype|contentType|\.name\b[^\n]*(endsWith|match)|\.test\([\w.]*\.name\)/.test(a.src);
        const peso = /\.size\b|maxSize|MAX_\w*(SIZE|BYTES|MB)/.test(a.src);
        if (!tipo || !peso)
          h.push({
            msg: `Subida de archivos sin controlar ${[!tipo && "el tipo", !peso && "el tamaño"].filter(Boolean).join(" ni ")}: pueden subir ejecutables, HTML o archivos enormes.`,
            archivo: a.rel,
            linea: lineaDe(a.src, m.index),
            arreglo: "En el servidor: lista blanca de tipos (los que esperás: image/webp, .xlsx…) y tamaño máximo (file.size); en Supabase Storage también allowedMimeTypes y fileSizeLimit en el bucket.",
          });
      }
      return h;
    },
  },
  {
    id: "datos-de-mas",
    categoria: "Seguridad",
    titulo: "Devolver solo los datos necesarios",
    nivel: "info",
    run(ctx) {
      // En route handlers y componentes cliente, `select *` manda al navegador columnas que quizás no
      // tendría que ver (teléfonos, notas internas, tokens). En páginas del servidor no sale del servidor.
      const h = [];
      for (const a of ctx.codigo()) {
        const expuesto = /(^|\/)route\.[jt]s$/.test(a.rel) || /^\s*["']use client["']/.test(a.src);
        if (!expuesto) continue;
        for (const m of a.src.matchAll(/\.select\(\s*(["'`])\*\1\s*\)|\.select\(\s*\)|\.findMany\(\s*\)/g))
          h.push({
            msg: "Trae todas las columnas y esto llega al navegador: quizás expone datos que no hacen falta.",
            archivo: a.rel,
            linea: lineaDe(a.src, m.index),
            arreglo: "Pedí solo las columnas que se usan: .select(\"id, nombre, precio\").",
          });
      }
      return h;
    },
  },
  {
    id: "cookies-sesion",
    categoria: "Seguridad",
    titulo: "Cookies de sesión protegidas",
    nivel: "error",
    run(ctx) {
      const h = [];
      for (const a of ctx.codigo()) {
        // cookies().set("x", v, { ... }) / response.cookies.set(...) con opciones literales.
        for (const m of a.src.matchAll(/(?:cookies(?:\(\)\)?)?|cookieStore)\.set\(\s*["'`]([^"'`]+)["'`]\s*,([^)]*)\)/g)) {
          if (!/sess|token|auth|jwt|login|user|(^|[_.-])sid($|[_.-])/i.test(m[1])) continue;
          const faltan = ["httpOnly", "secure", "sameSite"].filter((k) => !new RegExp(`\\b${k}\\b`).test(m[2]));
          if (faltan.length)
            h.push({ msg: `La cookie "${m[1]}" no tiene ${faltan.join(", ")}: puede leerla JavaScript (XSS) o viajar sin HTTPS.`, archivo: a.rel, linea: lineaDe(a.src, m.index), arreglo: "{ httpOnly: true, secure: true, sameSite: \"lax\", path: \"/\" }" });
        }
        for (const m of a.src.matchAll(/document\.cookie\s*=\s*[^;\n]*(sess|token|auth|jwt)/gi))
          h.push({ msg: "Sesión guardada en una cookie desde JavaScript: no puede ser httpOnly, cualquier XSS la roba.", archivo: a.rel, linea: lineaDe(a.src, m.index), arreglo: "Setéala desde el servidor (route handler / server action) con httpOnly." });
        for (const m of a.src.matchAll(/localStorage\.setItem\(\s*["'`][^"'`]*(token|jwt|session|auth)[^"'`]*["'`]/gi))
          h.push({ msg: "Token de sesión en localStorage: cualquier script de la página lo puede leer.", archivo: a.rel, linea: lineaDe(a.src, m.index), nivel: "warn", arreglo: "Usá una cookie httpOnly seteada desde el servidor." });
      }
      return h;
    },
  },
  {
    id: "contrasenas",
    categoria: "Seguridad",
    titulo: "Contraseñas hasheadas",
    nivel: "error",
    run(ctx) {
      const h = [];
      const hashea = /bcrypt|argon2|scrypt|pbkdf2/i.test(Object.keys(dependencias(ctx.raiz)).join(" ")) || ctx.codigo().some((a) => /bcrypt|argon2|scrypt|pbkdf2|hashPassword/i.test(a.src));
      for (const a of esquemas(ctx)) {
        const m = /\b(password|contrasena|contraseña|clave)\s*(?:"|:)?\s*(text|varchar|String|character varying|text\()/i.exec(a.src);
        if (m && !hashea)
          h.push({ msg: `Columna "${m[1]}" y ninguna librería de hash: si se guarda tal cual, una filtración expone todas las contraseñas.`, archivo: a.rel, linea: lineaDe(a.src, m.index), arreglo: "Usá el login del proveedor (Supabase Auth, Auth.js, Clerk) o hasheá con argon2/bcrypt; nunca guardes la contraseña." });
      }
      for (const a of ctx.codigo())
        for (const m of a.src.matchAll(/\b[\w.]*(password|contrasena)\w*\s*={2,3}\s*[\w.]+|[\w.]+\s*={2,3}\s*\w*\.(password|contrasena)\b/gi)) {
          // `password === confirmPassword` (repetir la contraseña en el registro) o `.length`: no es comparar contra la guardada.
          const izq = m[0].split(/={2,3}/)[0].trim();
          if (/confirm|repet/i.test(m[0]) || /\.length$/.test(izq)) continue;
          h.push({ msg: "Contraseña comparada como texto: significa que está guardada sin hashear.", archivo: a.rel, linea: lineaDe(a.src, m.index), arreglo: "await argon2.verify(hash, password) / bcrypt.compare(password, hash)." });
        }
      return h;
    },
  },
  {
    id: "datos-sensibles",
    categoria: "Seguridad",
    titulo: "Datos sensibles cifrados o no guardados",
    nivel: "info",
    run(ctx) {
      const RE = /\b(card_?number|numero_?tarjeta|tarjeta|cvv|cvc|ssn|cedula|documento|dni|passport|pasaporte|cbu|iban|account_number|cuenta_bancaria)\b\s*(?:"|:)?\s*(text|varchar|String|character varying|bigint|integer|text\()/gi;
      const h = [];
      for (const a of esquemas(ctx))
        for (const m of a.src.matchAll(RE))
          h.push({
            msg: `Se guarda "${m[1]}": si se filtra la base queda expuesto.`,
            archivo: a.rel,
            linea: lineaDe(a.src, m.index),
            arreglo: /card|tarjeta|cvv|cvc/i.test(m[1])
              ? "Las tarjetas no se guardan nunca: que las maneje la pasarela (Mercado Pago, Stripe)."
              : "Guardalo solo si hace falta, cifrado (pgcrypto / Supabase Vault) y con RLS restrictiva.",
          });
      return h;
    },
  },
  {
    id: "headers-seguridad",
    categoria: "Seguridad",
    titulo: "Headers de seguridad",
    nivel: "warn",
    run(ctx) {
      const fuentes = ["next.config.ts", "next.config.mjs", "next.config.js", "vercel.json", "src/proxy.ts", "proxy.ts", "src/middleware.ts", "middleware.ts"]
        .map((f) => path.join(ctx.raiz, f))
        .filter((f) => fs.existsSync(f))
        .map((f) => fs.readFileSync(f, "utf8"))
        .join("\n");
      const HEADERS = [
        ["X-Content-Type-Options", "nosniff"],
        ["Referrer-Policy", "strict-origin-when-cross-origin"],
        ["X-Frame-Options", "DENY"], // o frame-ancestors en la CSP: evita que metan el sitio en un iframe (clickjacking)
        ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
      ];
      const faltan = HEADERS.filter(([n]) => !new RegExp(n, "i").test(fuentes) && !(n === "X-Frame-Options" && /frame-ancestors/i.test(fuentes)));
      const h = faltan.length
        ? [
            {
              msg: `Faltan headers de seguridad: ${faltan.map(([n]) => n).join(", ")}.`,
              arreglo: `En next.config: async headers() { return [{ source: "/(.*)", headers: [${faltan.map(([n, v]) => `{ key: "${n}", value: "${v}" }`).join(", ")}] }] }`,
            },
          ]
        : [];
      // Solo Report-Only: avisa en la consola pero no bloquea (paso previo recomendado, no para quedarse).
      if (/Content-Security-Policy-Report-Only/i.test(fuentes) && !/(?:key["']?\s*:\s*|\.set\(\s*)["'`]Content-Security-Policy["'`]/i.test(fuentes))
        h.push({ msg: "Content-Security-Policy en modo solo reporte: avisa en la consola del navegador pero todavía no bloquea nada.", nivel: "info", arreglo: "Cuando en producción no aparezcan avisos \"[Report Only] Refused to…\" usando el sitio, cambiá el header a Content-Security-Policy." });
      else if (!/Content-Security-Policy/i.test(fuentes))
        h.push({ msg: "Sin Content-Security-Policy: es la defensa más fuerte contra XSS, pero hay que ajustarla a los scripts que usa el sitio.", nivel: "info", arreglo: "Ver la guía de Next: node_modules/next/dist/docs (Content Security Policy). Empezá con Content-Security-Policy-Report-Only." });
      return h;
    },
  },
  {
    id: "https",
    categoria: "Seguridad",
    titulo: "Todo por HTTPS",
    nivel: "warn",
    run(ctx) {
      const h = [];
      const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w.-]+\.(local|test|localhost))(:|\/|$)/;
      const ESPACIO_NOMBRES = /^http:\/\/(www\.)?(w3\.org|schemas\.|purl\.org|ns\.adobe\.com|xmlns)/;
      for (const a of ctx.codigo()) {
        for (const m of a.src.matchAll(/["'`(](http:\/\/[^"'`\s)]+)/g)) {
          if (LOCAL.test(m[1]) || ESPACIO_NOMBRES.test(m[1])) continue;
          const inicio = a.src.lastIndexOf("\n", m.index) + 1;
          if (/^\s*(\/\/|\*|\/\*)/.test(a.src.slice(inicio, m.index))) continue;
          h.push({ msg: `URL con http:// (${m[1].slice(0, 60)}): el navegador la bloquea o marca el sitio como inseguro.`, archivo: a.rel, linea: lineaDe(a.src, m.index), arreglo: "Cambiala a https://." });
        }
      }
      return h;
    },
  },
  {
    id: "dependencias",
    categoria: "Seguridad",
    titulo: "Dependencias sin vulnerabilidades conocidas",
    nivel: "warn",
    run(ctx) {
      const gestor = fs.existsSync(path.join(ctx.raiz, "pnpm-lock.yaml")) ? "pnpm" : fs.existsSync(path.join(ctx.raiz, "package-lock.json")) ? "npm" : null;
      if (!gestor) return [];
      let out;
      try {
        out = execFileSync(gestor, ["audit", "--json", gestor === "npm" ? "--omit=dev" : "--prod"], { cwd: ctx.raiz, encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] });
      } catch (e) {
        out = e.stdout; // audit sale con código 1 cuando encuentra algo
      }
      let v;
      try {
        const j = JSON.parse(out);
        v = j.metadata?.vulnerabilities;
      } catch {
        return [{ msg: `No se pudo correr ${gestor} audit (¿sin conexión?).`, nivel: "info" }];
      }
      if (!v) return [];
      const graves = (v.critical ?? 0) + (v.high ?? 0);
      const h = [];
      if (graves)
        h.push({ msg: `${v.critical ?? 0} vulnerabilidades críticas y ${v.high ?? 0} altas en dependencias de producción.`, nivel: v.critical ? "error" : "warn", arreglo: `${gestor} audit para ver cuáles; ${gestor === "npm" ? "npm audit fix" : "pnpm update"} (sin --force) arregla las que no rompen versiones.` });
      if (v.moderate)
        h.push({ msg: `${v.moderate} vulnerabilidades moderadas en dependencias de producción.`, nivel: "info", arreglo: `${gestor} audit ${gestor === "npm" ? "--omit=dev" : "--prod"}` });
      return h;
    },
  },
];

export default reglas;
