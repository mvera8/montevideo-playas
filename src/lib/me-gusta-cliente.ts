"use client";

// Me gusta desde el navegador. Para no cargar supabase-js (~45 kB gz) en cada visita:
// - el contador inicial viene del servidor (src/lib/me-gusta.ts);
// - si el navegador nunca dio un me gusta no tiene sesión guardada, así que sabemos sin pedir nada
//   que no le dio me gusta a ninguna playa;
// - supabase-js se importa recién al tocar ❤️, o al cargar la página si ya hay sesión (dos consultas
//   en paralelo: qué playas le gustan, para pintarlas en las tarjetas, y los totales al día).
// La cuenta es anónima (Supabase Auth, signInAnonymously): no pide datos y queda en el
// almacenamiento local del navegador. Toda la lógica (uno por persona, temporada, contador) vive
// en la base: funciones `alternar_me_gusta` y `estado_me_gusta`, y RLS sobre `me_gusta`.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TotalesMeGusta } from "./me-gusta";
import { temporadaMeGusta } from "./me-gusta-temporada";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const meGustaDisponible = Boolean(URL_SUPABASE && CLAVE);

// Estado compartido por todas las tarjetas y el detalle. `version` cambia en cada escritura.
const totales = new Map<string, TotalesMeGusta>(); // más nuevos que los del servidor
const mios = new Set<string>(); // playas que me gustan (temporada actual)
const pendientes = new Set<string>();
const errores = new Map<string, string>();
let misCargados = false; // ya sé cuáles me gustan (o que no hay sesión)
let cargandoMios = false;
let totalesFrescos = false; // `totales` tiene todas las playas con me gusta, al día
let version = 0;
const oyentes = new Set<() => void>();

function avisar() {
  version++;
  oyentes.forEach((o) => o());
}

function suscribir(o: () => void) {
  oyentes.add(o);
  return () => oyentes.delete(o);
}

const useVersion = () => useSyncExternalStore(suscribir, () => version, () => 0);

let cliente: Promise<SupabaseClient> | null = null;
function getCliente() {
  cliente ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL_SUPABASE!, CLAVE!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }),
  );
  return cliente;
}

// supabase-js guarda la sesión en localStorage con la clave `sb-<ref>-auth-token`.
function haySesion() {
  try {
    const ref = new URL(URL_SUPABASE!).hostname.split(".")[0];
    return localStorage.getItem(`sb-${ref}-auth-token`) != null;
  } catch {
    return false;
  }
}

async function sesion(crearCuenta: boolean) {
  const c = await getCliente();
  const { data } = await c.auth.getSession();
  if (data.session) return c;
  if (!crearCuenta) return null;
  const { error } = await c.auth.signInAnonymously();
  if (error) throw error;
  return c;
}

async function rpc(nombre: "estado_me_gusta" | "alternar_me_gusta", slug: string, crearCuenta: boolean) {
  const c = await sesion(crearCuenta);
  if (!c) return null;
  const { data, error } = await c.rpc(nombre, { p_playa: slug });
  if (error) throw error;
  return data as TotalesMeGusta & { meGusta: boolean };
}

const CERO: TotalesMeGusta = { temporada: 0, siempre: 0 };
function totalesDe(slug: string, inicial: TotalesMeGusta | null) {
  return totales.get(slug) ?? (inicial && totalesFrescos ? CERO : inicial);
}

function aplicar(slug: string, r: TotalesMeGusta & { meGusta: boolean }) {
  totales.set(slug, { temporada: r.temporada, siempre: r.siempre });
  if (r.meGusta) mios.add(slug);
  else mios.delete(slug);
}

// Una vez por carga: qué playas me gustan esta temporada (RLS devuelve solo las mías).
function cargarMios() {
  if (misCargados || cargandoMios || !meGustaDisponible) return;
  if (!haySesion()) {
    misCargados = true;
    avisar();
    return;
  }
  cargandoMios = true;
  sesion(false)
    .then(async (c) => {
      if (!c) return;
      // En paralelo, los totales al día: el HTML puede traerlos con hasta 5 min de atraso y no
      // queremos mostrar "te gusta" con 0.
      const temporada = temporadaMeGusta();
      const [m, t] = await Promise.all([
        c.from("me_gusta").select("playa").eq("temporada", temporada),
        c.from("me_gusta_totales").select("playa,temporada,total"),
      ]);
      if (m.error) throw m.error;
      for (const f of m.data as { playa: string }[]) mios.add(f.playa);
      if (!t.error) {
        const frescos = new Map<string, TotalesMeGusta>();
        for (const f of t.data as { playa: string; temporada: string; total: number }[]) {
          const x = frescos.get(f.playa) ?? { temporada: 0, siempre: 0 };
          x.siempre += f.total;
          if (f.temporada === temporada) x.temporada += f.total;
          frescos.set(f.playa, x);
        }
        // No pisar las que se están alternando. Las playas sin fila pasan a 0 (ver `totalesDe`).
        for (const [slug, x] of frescos) if (!pendientes.has(slug)) totales.set(slug, x);
        totalesFrescos = true;
      }
    })
    .catch(() => {})
    .finally(() => {
      misCargados = true;
      cargandoMios = false;
      avisar();
    });
}

/** Solo lectura (tarjetas y totales del detalle): totales (los del servidor hasta que haya algo más nuevo) y si me gusta. */
export function useTotalesMeGusta(slug: string, inicial: TotalesMeGusta | null) {
  useVersion();
  useEffect(cargarMios, []);
  const t = totalesDe(slug, inicial);
  return t ? { ...t, meGusta: mios.has(slug), error: errores.get(slug) ?? null } : null;
}

/** Para el detalle: estado fresco de la playa y la acción de alternar, con actualización optimista. */
export function useMeGusta(slug: string, inicial: TotalesMeGusta | null) {
  useVersion();

  useEffect(() => {
    cargarMios();
    // Con sesión, al abrir la playa traemos los totales al día (el servidor los cachea 5 min).
    if (!meGustaDisponible || !inicial || !haySesion()) return;
    rpc("estado_me_gusta", slug, false)
      .then((r) => {
        if (r && !pendientes.has(slug)) {
          aplicar(slug, r);
          avisar();
        }
      })
      .catch(() => {});
  }, [slug, inicial]);

  const alternar = useCallback(async () => {
    const base = totalesDe(slug, inicial);
    if (!base || !misCargados || pendientes.has(slug)) return;
    const antes = { ...base, meGusta: mios.has(slug) };
    const d = antes.meGusta ? -1 : 1;
    aplicar(slug, {
      meGusta: !antes.meGusta,
      temporada: Math.max(0, antes.temporada + d),
      siempre: Math.max(0, antes.siempre + d),
    });
    pendientes.add(slug);
    errores.delete(slug);
    avisar();
    try {
      aplicar(slug, (await rpc("alternar_me_gusta", slug, true))!);
    } catch {
      aplicar(slug, antes);
      errores.set(slug, "No se pudo guardar. Probá de nuevo.");
    }
    pendientes.delete(slug);
    avisar();
  }, [slug, inicial]);

  const t = totalesDe(slug, inicial);
  return {
    estado: t ? { ...t, meGusta: mios.has(slug) } : null,
    cargado: misCargados,
    error: errores.get(slug) ?? null,
    alternar,
  };
}
