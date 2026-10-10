// Muestra en la terminal los errores registrados en la tabla `errores` de Supabase (README → "Errores",
// src/lib/errores.ts), o los borra.
//
//   npm run errors              últimos 50, agrupados por día
//   npm run errors -detalle     además el stack, el digest y el navegador
//   npm run errors -limite=200  más filas
//   npm run errors -delete      borra todos (pide confirmación; -si para no preguntar)
//
// npm no le pasa al script los flags de un guion (`-delete`), pero los deja en `npm_config_<flag>`:
// por eso se leen de ahí. También sirve `node scripts/errores.mjs --delete`.
//
// La tabla no se puede leer con la clave publicable (RLS sin políticas), así que hace falta la clave
// secreta en .env.local: SUPABASE_SECRET_KEY=sb_secret_… (Supabase → Project Settings → API Keys →
// Secret keys). Solo para este script: nunca con prefijo NEXT_PUBLIC_ ni en Vercel.

import { createInterface } from "node:readline/promises";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SECRET_KEY;

const flag = (nombre) => process.env[`npm_config_${nombre}`] ?? argumento(nombre);
function argumento(nombre) {
  const a = process.argv.slice(2).find((x) => x.replace(/^-+/, "").split("=")[0] === nombre);
  return a && (a.split("=")[1] ?? "true");
}

const c = (codigo) => (texto) => (process.stdout.isTTY ? `\x1b[${codigo}m${texto}\x1b[0m` : String(texto));
const gris = c(90), rojo = c(31), amarillo = c(33), azul = c(36), negrita = c(1);

if (!URL_SUPABASE || !CLAVE) {
  console.error(rojo("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local."));
  console.error("La clave secreta (sb_secret_…) está en Supabase → Project Settings → API Keys → Secret keys.");
  process.exit(1);
}
// Clave mal copiada: el dashboard muestra las claves recortadas con "…", y eso rompe el header HTTP.
if (!/^[\x21-\x7e]+$/.test(CLAVE) || CLAVE.length < 20) {
  console.error(rojo("SUPABASE_SECRET_KEY parece incompleta (está recortada con “…” o es muy corta)."));
  console.error("Copiala entera con el botón de copiar en Supabase → Project Settings → API Keys → Secret keys.");
  process.exit(1);
}

const headers = { apikey: CLAVE };
const api = `${URL_SUPABASE}/rest/v1/errores`;

async function pedir(url, opciones = {}) {
  const res = await fetch(url, { ...opciones, headers: { ...headers, ...opciones.headers } });
  if (!res.ok) throw new Error(`Supabase: HTTP ${res.status} ${await res.text()}`);
  return res;
}

async function contar() {
  const res = await pedir(`${api}?select=id`, { method: "HEAD", headers: { Prefer: "count=exact" } });
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}

const hora = (iso) =>
  new Date(iso).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Montevideo" });
const fecha = (dia) => new Date(`${dia}T12:00:00`).toLocaleDateString("es-UY", { weekday: "short", day: "numeric", month: "numeric" });

async function listar() {
  const limite = Number(flag("limite")) || 50;
  const detalle = Boolean(flag("detalle"));
  const [total, res] = await Promise.all([
    contar(),
    pedir(`${api}?select=*&order=ultima.desc&limit=${limite}`),
  ]);
  const filas = await res.json();

  if (!filas.length) {
    console.log(gris("Sin errores registrados (se guardan los últimos 30 días)."));
    return;
  }

  let dia = null;
  for (const f of filas) {
    if (f.dia !== dia) {
      dia = f.dia;
      console.log(`\n${negrita(fecha(dia))}`);
    }
    const veces = f.veces > 1 ? amarillo(`×${f.veces}`.padStart(5)) : "".padStart(5);
    const origen = f.origen === "servidor" ? rojo("servidor") : azul("cliente ");
    console.log(`  ${gris(hora(f.ultima))} ${veces}  ${origen}  ${f.ruta ?? "-"}  ${gris(f.contexto ?? "")}`);
    console.log(`                  ${f.mensaje}`);
    if (detalle) {
      if (f.digest) console.log(gris(`                  digest: ${f.digest}`));
      if (f.navegador) console.log(gris(`                  ${f.navegador}`));
      if (f.stack) console.log(gris(f.stack.split("\n").map((l) => `                  ${l.trim()}`).join("\n")));
    }
  }

  const sumaVeces = filas.reduce((s, f) => s + f.veces, 0);
  console.log(
    gris(`\n${filas.length} de ${total} errores distintos (${sumaVeces} veces en total en los mostrados).`) +
      (total > filas.length ? gris(` Más: npm run errors -limite=${total}`) : "") +
      (detalle ? "" : gris(" Stack: npm run errors -detalle")),
  );
}

async function borrar() {
  const total = await contar();
  if (!total) {
    console.log(gris("No hay errores para borrar."));
    return;
  }
  if (!flag("si")) {
    if (!process.stdin.isTTY) {
      console.error(rojo(`Hay ${total} errores. Sin terminal interactiva, agregar -si para confirmar.`));
      process.exit(1);
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const resp = await rl.question(`¿Borrar los ${total} errores registrados? No se puede deshacer. (s/N) `);
    rl.close();
    if (!/^s(i|í)?$/i.test(resp.trim())) {
      console.log(gris("No se borró nada."));
      return;
    }
  }
  // PostgREST no deja borrar sin filtro: id > 0 equivale a todas las filas.
  await pedir(`${api}?id=gt.0`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  console.log(`Listo: ${total} errores borrados.`);
}

try {
  await (flag("delete") ? borrar() : listar());
} catch (e) {
  console.error(rojo(e.message));
  process.exit(1);
}
